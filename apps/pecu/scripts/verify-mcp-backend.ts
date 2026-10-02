import assert from "node:assert/strict";
import { Database, type SQLQueryBindings } from "bun:sqlite";
import { mkdir } from "node:fs/promises";
import { PecuAgent } from "../src/agent";
import { evmTxParameterSchemas, parseUnits, type EvmPlanResult } from "../src/evm";
import { executePecuMcpTool } from "../src/mcp-execution";
import { mcpExecutionInstructions } from "../src/mcp-catalog";
import { mcpBackendRequestSchema, type McpBackendRequest } from "../src/mcp-contract";
import { ChainDataService } from "../src/integrations/chain-data";
import { TwitterService } from "../src/integrations/twitter";
import { digest, planDigest } from "../src/plan-digest";
import { Store } from "../src/store";
import { eventProcessingLeaseMs } from "../src/state";
import { TaskControl } from "../src/task-control";
import { TaskStore } from "../src/tasks";
import { WebAgent, type WebSql } from "../src/web";
import { webConversation } from "../src/web-identity";
import { services, unusedEvm } from "../tests/fixtures/agent-services";

const directory = process.argv[2] ?? "/tmp/pecu-mcp-backend-verification";
const alice = { userId: "user_McpAlice", senderId: "web-user_McpAlice" };
const bob = { userId: "user_McpBob", senderId: "web-user_McpBob" };
const wallet = "0x1111111111111111111111111111111111111111";
const otherWallet = "0x2222222222222222222222222222222222222222";
const recipient = "0x3333333333333333333333333333333333333333";
const checks: { name: string; ok: boolean; error?: string }[] = [];
const counters = { wallets: 0, balances: 0, proposals: 0, prepared: 0, approvals: 0, transactionReads: 0, networkRequests: 0 };
const db = new Database(":memory:");
const store = new Store(":memory:");
const sql: WebSql = {
  exec: <Row extends Record<string, SqlStorageValue>>(query: string, ...params: SqlStorageValue[]) => {
    const rows = db.query<Row, SQLQueryBindings[]>(query).all(...params.map(value => value instanceof ArrayBuffer ? new Uint8Array(value) : value));
    return { toArray: () => rows };
  },
};
const denyNetwork: typeof fetch = Object.assign(async () => {
  counters.networkRequests++;
  throw new Error("External network access is disabled during backend verification.");
}, { preconnect() {} });
const externalServices = {
  chainData: new ChainDataService(denyNetwork),
  twitter: new TwitterService(undefined, denyNetwork),
};
const taskStore = new TaskStore(sql);
const taskControl = new TaskControl(taskStore, store);
const agent = new PecuAgent(
  { enableMainnetExecution: true, maxSlippageBps: 100, quoteTtlSeconds: 120, depositRelayMaxUsd: 500, depositRelayDailyMaxUsd: 2000 },
  store,
  {
    getOrCreate: async senderId => {
      counters.wallets++;
      const address = senderId === alice.senderId ? wallet : otherWallet;
      store.saveWallet(senderId, address, address);
      return { address };
    },
    balances: async () => { counters.balances++; return "ETH: 1\nUSDC: 5\nAERO: 0"; },
    usdcBalanceUnits: async () => 5_000_000n,
    prepare: async () => { counters.prepared++; throw new Error("Signing is disabled in verification."); },
    prepareBatch: async () => { counters.prepared++; throw new Error("Signing is disabled in verification."); },
    approve: async () => { counters.approvals++; throw new Error("Signing is disabled in verification."); },
    transaction: async () => { counters.transactionReads++; throw new Error("Signing is disabled in verification."); },
  },
  services({
    tasks: taskControl,
    evm: {
      ...unusedEvm,
      propose: async (from, action, raw) => {
        counters.proposals++;
        assert.equal(action, "transfer");
        const parameters = evmTxParameterSchemas.transfer.parse(raw);
        assert.equal(parameters.token, "ETH");
        const plan: EvmPlanResult = {
          kind: "transaction", action: "transfer", parameters,
          summary: `Send ${parameters.amount} ETH to ${parameters.to}`,
          context: {},
          calls: [{ role: "action", from, to: parameters.to, data: "0x", value: parseUnits(parameters.amount, 18).toString() }],
        };
        return plan;
      },
    },
  }),
  { respond: async () => { throw new Error("MCP must not invoke model inference."); } },
);
const web = new WebAgent(agent, store, sql);
const request = (name: string, arguments_: McpBackendRequest["arguments"], identity = alice, clientId = "mcp-verification-client", requestId: string = crypto.randomUUID(), scopes = ["pecu:read", "pecu:write"]) =>
  mcpBackendRequestSchema.parse({ name, arguments: arguments_, identity, clientId, requestId, scopes });
const scopeFor = async (input: McpBackendRequest) => ({ ...input.identity, threadId: `mcp-${(await digest(input.clientId)).slice(0, 32)}` });
const execute = (input: McpBackendRequest) => executePecuMcpTool(agent, web, sql, input, externalServices);
const interruptSavedResult = async (input: McpBackendRequest) => {
  const eventId = `${webConversation(await scopeFor(input))}:${input.requestId}`;
  store.db.query("UPDATE inbox_events SET status='processing',reply_text=NULL,updated_at=? WHERE event_id=?").run(Date.now() - eventProcessingLeaseMs - 1, eventId);
  sql.exec("UPDATE basedbot_mcp_calls SET completed=0 WHERE event_id=?", eventId);
  return eventId;
};
const check = async (name: string, verify: () => void | Promise<void>) => {
  try { await verify(); checks.push({ name, ok: true }); }
  catch (error) { checks.push({ name, ok: false, error: error instanceof Error ? error.message : String(error) }); }
};

let previewCode: string | undefined;
let verifiedThread: string | undefined;
try {
  const addressRequest = request("wallet_address", {});
  const addressResult = await execute(addressRequest);
  await check("Authenticated web identity provisions and reads its existing backend wallet", () => {
    assert.equal(addressResult.isError, false);
    assert.match(addressResult.text, new RegExp(wallet));
    assert.equal(store.wallet(alice.senderId)?.address, wallet);
    assert.equal(counters.wallets, 1);
  });

  const proposal = request("evm_transfer", { to: recipient, amount: "0.000001", token: "ETH" });
  const scope = await scopeFor(proposal);
  verifiedThread = scope.threadId;
  const conversationId = webConversation(scope);
  store.setYolo(alice.senderId, conversationId, true);
  const result = await execute(proposal);
  const eventId = `${conversationId}:${proposal.requestId}`;
  const intent = store.intentForSource(eventId);
  previewCode = result.text.match(/\/confirm ([A-Z0-9]{6})/)?.[1];
  await check("Direct MCP transfer creates one exact persisted unsigned plan with confirmation", async () => {
    assert.equal(result.isError, false);
    assert(previewCode);
    assert(intent);
    assert.equal(intent.state, "pending");
    assert.equal(intent.senderId, alice.senderId);
    assert.equal(intent.conversationId, conversationId);
    const steps = store.steps(intent.id);
    assert.equal(steps.length, 1);
    assert.equal(steps[0]?.call.to, recipient);
    assert.equal(steps[0]?.call.value, "1000000000000");
    assert.equal(await planDigest(steps.map(step => step.call)), intent.planDigest);
    assert.equal(store.intentForCode(await digest(previewCode), alice.senderId, conversationId)?.id, intent.id);
  });
  await check("Existing YOLO does not submit or prepare any MCP transaction", () => {
    assert.equal(store.yoloEnabled(alice.senderId, conversationId), true);
    assert.equal(intent?.state, "pending");
    assert.equal(counters.prepared, 0);
    assert.equal(counters.approvals, 0);
    assert.equal(counters.transactionReads, 0);
  });
  await check("Real web history exposes the MCP thread and its usable confirmation card", () => {
    const state = web.state(scope);
    assert.equal(state.threadId, scope.threadId);
    assert(web.threads(alice).some(thread => thread.id === scope.threadId));
    const message = state.messages.find(message => message.id === eventId);
    assert.equal(message?.reply?.preview?.code, previewCode);
    assert.equal(message?.reply?.preview?.state, "pending");
    assert.equal(message?.reply?.preview?.plan?.steps[0]?.kind, "transfer");
    assert.equal(message?.canRetry, false);
  });
  await check("Identical request replay survives WebAgent reconstruction without another proposal", async () => {
    const replay = await executePecuMcpTool(agent, new WebAgent(agent, store, sql), sql, proposal, externalServices);
    assert.deepEqual(replay, result);
    assert.equal(counters.proposals, 1);
    assert.equal(web.state(scope).messages.filter(message => message.id === eventId).length, 1);
  });
  await check("Canonical object ordering preserves replay identity", async () => {
    const replay = await execute({ ...proposal, arguments: { token: "ETH", amount: "0.000001", to: recipient } });
    assert.deepEqual(replay, result);
    assert.equal(counters.proposals, 1);
  });
  await check("Reusing a request ID for different arguments is rejected before another preview", async () => {
    await assert.rejects(execute({ ...proposal, arguments: { ...proposal.arguments, amount: "0.000002" } }), /already belongs to another tool call/);
    assert.equal(counters.proposals, 1);
  });
  await check("Reusing a request ID for a different tool is rejected", async () => {
    await assert.rejects(execute({ ...proposal, name: "wallet_balances", arguments: {} }), /already belongs to another/);
    assert.equal(counters.balances, 0);
  });
  await check("Different OAuth clients get isolated threads and cannot find another client's code", async () => {
    const otherClient = request("wallet_address", {}, alice, "mcp-other-client", proposal.requestId);
    const otherScope = await scopeFor(otherClient);
    assert.notEqual(otherScope.threadId, scope.threadId);
    const other = await execute(otherClient);
    assert.equal(other.isError, false);
    assert.match(other.text, new RegExp(wallet));
    assert(previewCode);
    assert.equal(store.intentForCode(await digest(previewCode), alice.senderId, webConversation(otherScope)), undefined);
    assert.equal(web.state(otherScope).messages.some(message => message.reply?.preview?.code === previewCode), false);
  });
  await check("Different signed-in accounts share no wallet, history or confirmation authority", async () => {
    const otherAccount = request("wallet_address", {}, bob, proposal.clientId, proposal.requestId);
    const otherScope = await scopeFor(otherAccount);
    const other = await execute(otherAccount);
    assert.equal(other.isError, false);
    assert.match(other.text, new RegExp(otherWallet));
    assert.notEqual(store.wallet(bob.senderId)?.address, store.wallet(alice.senderId)?.address);
    assert.equal(web.state(otherScope).messages.some(message => message.reply?.preview), false);
    assert(previewCode);
    assert.equal(store.intentForCode(await digest(previewCode), bob.senderId, webConversation(otherScope)), undefined);
  });
  await check("Read-only scope rejects direct transaction tools before invoking EVM", async () => {
    const denied = await execute(request("evm_transfer", proposal.arguments, alice, proposal.clientId, crypto.randomUUID(), ["pecu:read"]));
    assert.equal(denied.isError, true);
    assert.match(denied.text, /permission/);
    assert.equal(counters.proposals, 1);
  });
  await check("Read-only run_tools cannot call a nested write", async () => {
    const deniedRequest = request("run_tools", { code: `return await tools.evm_transfer(${JSON.stringify(proposal.arguments)});` }, alice, proposal.clientId, crypto.randomUUID(), ["pecu:read"]);
    const denied = await execute(deniedRequest);
    assert.equal(denied.isError, true);
    assert.equal(counters.proposals, 1);
    assert.equal(store.intentForSource(`${conversationId}:${deniedRequest.requestId}`), undefined);
  });
  await check("Read-only run_tools can call a permitted wallet read", async () => {
    const read = await execute(request("run_tools", { code: "return await tools.wallet_balances({});" }, alice, proposal.clientId, crypto.randomUUID(), ["pecu:read"]));
    assert.equal(read.isError, false);
    assert.match(read.text, /ETH: 1/);
    assert.equal(counters.balances, 1);
  });
  await check("Nested script transaction keeps its preview available and does not inherit YOLO", async () => {
    const scripted = request("run_tools", { code: `return await tools.evm_transfer(${JSON.stringify(proposal.arguments)});` });
    const scriptedResult = await execute(scripted);
    assert.equal(scriptedResult.isError, false);
    const message = web.state(scope).messages.find(message => message.id === `${conversationId}:${scripted.requestId}`);
    assert.equal(message?.reply?.preview?.state, "pending");
    assert.equal(message?.reply?.preview?.plan?.steps[0]?.kind, "transfer");
    assert.equal(counters.proposals, 2);
    assert.equal(counters.prepared, 0);
    assert.equal(counters.approvals, 0);
  });
  await check("A script cannot hide a saved transaction preview by omitting its return value", async () => {
    const scripted = request("run_tools", { code: `await tools.evm_transfer(${JSON.stringify(proposal.arguments)}); return "Prepared";` });
    const scriptedResult = await execute(scripted);
    assert.equal(scriptedResult.isError, false);
    assert.match(scriptedResult.text, /\/confirm [A-Z0-9]{6}/);
    const message = web.state(scope).messages.find(message => message.id === `${conversationId}:${scripted.requestId}`);
    assert.equal(message?.reply?.preview?.state, "pending");
    assert.equal(message?.reply?.preview?.plan?.steps[0]?.kind, "transfer");
    assert.equal(counters.proposals, 3);
  });
  await check("A failed script retains completed proposal evidence and its web confirmation card", async () => {
    const scripted = request("run_tools", { code: `await tools.evm_transfer(${JSON.stringify(proposal.arguments)}); throw new Error("Deliberate verification failure after preview");` });
    const scriptedResult = await execute(scripted);
    assert.equal(scriptedResult.isError, true);
    assert.match(scriptedResult.text, /\/confirm [A-Z0-9]{6}/);
    const message = web.state(scope).messages.find(message => message.id === `${conversationId}:${scripted.requestId}`);
    assert.equal(message?.reply?.preview?.state, "pending");
    assert.equal(counters.proposals, 4);
    assert.equal(counters.prepared, 0);
    assert.equal(counters.approvals, 0);
  });
  await check("An interrupted task creation is never repeated after its processing lease expires", async () => {
    const create = request("task_create", { title: "Verification reminder", mode: "remind", instruction: "Review this fixture", trigger: { kind: "once", in_minutes: 10 } });
    const created = await execute(create);
    assert.equal(created.isError, false);
    assert.equal(taskStore.list(alice.senderId).length, 1);
    const interrupted = await interruptSavedResult(create);
    const recovered = await execute(create);
    assert.equal(recovered.isError, true);
    assert.match(recovered.text, /previous attempt started/);
    assert.equal(taskStore.list(alice.senderId).length, 1);
    assert.deepEqual(await execute(create), recovered);
    assert.equal(taskStore.list(alice.senderId).length, 1);
    assert.equal(sql.exec<{ completed: number }>("SELECT completed FROM basedbot_mcp_calls WHERE event_id=?", interrupted).toArray()[0]?.completed, 1);
  });
  await check("An interrupted run_tools write cannot repeat its completed nested side effect", async () => {
    const create = request("run_tools", { code: 'return await tools.task_create({title:"Script reminder",mode:"remind",instruction:"Review this fixture",trigger:{kind:"once",in_minutes:10}});' });
    const created = await execute(create);
    assert.equal(created.isError, false);
    assert.equal(taskStore.list(alice.senderId).length, 2);
    await interruptSavedResult(create);
    const recovered = await execute(create);
    assert.equal(recovered.isError, true);
    assert.match(recovered.text, /did not repeat any writes/);
    assert.equal(taskStore.list(alice.senderId).length, 2);
  });
  await check("An interrupted read can recover after lease expiry and then replays its saved result", async () => {
    const read = request("wallet_balances", {});
    const first = await execute(read);
    assert.equal(first.isError, false);
    const before = counters.balances;
    await interruptSavedResult(read);
    const recovered = await execute(read);
    assert.equal(recovered.isError, false);
    assert.deepEqual(recovered, first);
    assert.equal(counters.balances, before + 1);
    assert.deepEqual(await execute(read), recovered);
    assert.equal(counters.balances, before + 1);
  });
  await check("Loaded chat skills begin with the authoritative MCP preview-only execution boundary", async () => {
    const loaded = await execute(request("load_skills", { names: ["wallet", "aerodrome", "aave"] }));
    assert.equal(loaded.isError, false);
    assert.equal(loaded.text.startsWith(mcpExecutionInstructions), true);
    assert.match(loaded.text, /take precedence over chat execution rules/);
    assert.match(loaded.text, /All supported Pecu tools are already available/);
    assert.equal(counters.prepared, 0);
    assert.equal(counters.approvals, 0);
  });
  await check("Aave workflow guidance applies the same MCP override directly and inside run_tools", async () => {
    const direct = await execute(request("aave_skill", { name: "safe-transactions" }));
    assert.equal(direct.isError, false);
    assert.equal(direct.text.startsWith(mcpExecutionInstructions), true);
    assert.match(direct.text, /take precedence over chat execution rules/);
    assert.match(direct.text, /aave_schema/);
    const scripted = await execute(request("run_tools", { code: 'return await tools.aave_skill({name:"safe-transactions"});' }));
    assert.equal(scripted.isError, false);
    assert.equal(scripted.text.includes(mcpExecutionInstructions), true);
    assert.match(scripted.text, /take precedence over chat execution rules/);
    assert.equal(counters.prepared, 0);
    assert.equal(counters.approvals, 0);
  });
  await check("Browser and automation thread locks reject a colliding MCP request", async () => {
    const release = web.lock(conversationId);
    assert(release);
    try { await assert.rejects(execute(request("wallet_address", {})), /finishing a request/); }
    finally { release(); }
  });
  await check("Existing X wallet policy refuses MCP provisioning for an unknown X sender", async () => {
    const before = counters.wallets;
    await assert.rejects(execute(request("wallet_address", {}, { userId: "user_McpX", senderId: "987654321" })), /Send \/wallet to Pecu on X first/);
    assert.equal(counters.wallets, before);
  });
  await check("MCP has no transaction-confirm, YOLO-enable or allowance-approve tool", async () => {
    for (const name of ["confirm", "yolo_on", "task_allow"]) {
      const unsupported = await execute(request(name, {}));
      assert.equal(unsupported.isError, true);
      assert.match(unsupported.text, /not available/);
    }
    assert.equal(counters.prepared, 0);
    assert.equal(counters.approvals, 0);
  });
  await check("The verification never contacted financial services or signed a transaction", () => {
    assert.equal(counters.networkRequests, 0);
    assert.equal(counters.prepared, 0);
    assert.equal(counters.approvals, 0);
    assert.equal(counters.transactionReads, 0);
  });
} catch (error) {
  checks.push({ name: "Backend verification completed", ok: false, error: error instanceof Error ? error.message : String(error) });
} finally {
  await mkdir(directory, { recursive: true });
  const report = {
    verifiedAt: new Date().toISOString(),
    scope: "Real PecuAgent, WebAgent, shared tool registrations, SQLite storage and MCP backend execution. External wallet and EVM service responses are fixtures. No network, signing or production-account proof.",
    ok: checks.every(check => check.ok), passed: checks.filter(check => check.ok).length,
    failed: checks.filter(check => !check.ok).length, checks, counters,
    preview: { threadId: verifiedThread, confirmationCode: previewCode },
  };
  await Bun.write(`${directory}/report.json`, JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify({ ok: report.ok, passed: report.passed, failed: report.failed, report: `${directory}/report.json` }));
  db.close();
  store.close();
  if (!report.ok) process.exitCode = 1;
}
