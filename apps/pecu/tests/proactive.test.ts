import { Database, type SQLQueryBindings } from "bun:sqlite";
import { afterEach, describe, expect, test } from "bun:test";
import { abis, getChainSettings, setupPlanner, type Quote, type Token } from "@beegreat/sugar";
import { concatHex, encodeFunctionData, getAddress, maxUint256, type Address } from "viem";
import { PecuAgent, type AgentServices } from "../src/agent";
import type { StockBasketPlanResult } from "../src/aerodrome";
import type { PlannedCall } from "../src/domain";
import type { AgentCapabilities, AgentHarness } from "../src/harness";
import { ProactiveRunner, quietHeartbeat, type PushMessage } from "../src/proactive";
import { Store } from "../src/store";
import { triggerFromInput, type Trigger } from "../src/task-contract";
import { TaskControl, type TaskCreateInput } from "../src/task-control";
import { grantDecision } from "../src/task-grant";
import { describeTrigger, nextOccurrence } from "../src/task-schedule";
import { TaskStore } from "../src/tasks";
import { WebAgent, type WebSql } from "../src/web";
import { webConversation } from "../src/web-identity";
import { awaitingApproval, confirmedOutcome, services, submittedTransaction } from "./fixtures/agent-services";

const base = getChainSettings(8453);
const wallet: Address = "0x1111111111111111111111111111111111111111";
const usdcAddress: Address = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const nvda: Address = "0xb20000000000000000000078ee7ce2fe4908108c";
const permit2: Address = "0x000000000022D473030F116dDEE9F6B43aC78BA3";
const identity = { userId: "user_alice", senderId: "web-user_alice" };
const conversation = webConversation(identity);
const token = (symbol: string, tokenAddress: string, decimals: number): Token => ({ chainId: 8453, chainName: "Base", symbol, tokenAddress, decimals, listed: true, emerging: false });

/** A stock purchase paying `usdc` raw units, built by the SDK's own planner. */
function stockPlan(usdc: bigint): StockBasketPlanResult {
  const quote: Quote = {
    input: { fromToken: token("USDC", usdcAddress, 6), toToken: token("NVDAc", nvda, 18), amountIn: usdc, path: [{ pool: { chainId: 8453, chainName: "Base", lp: "0x4444444444444444444444444444444444444444", type: 100, token0Address: usdcAddress, token1Address: nvda, factory: base.slipstreamFactoryAddress, isCl: true, isStable: false, isBasic: false }, reversed: false }] },
    amountOut: 10n ** 17n,
  };
  const plan = setupPlanner(quote, 0.005, wallet, base.swapperContractAddress, { newFactory: base.slipstreamFactoryAddress });
  const calls: PlannedCall[] = [
    { role: "approval", from: wallet, to: usdcAddress, data: encodeFunctionData({ abi: abis.erc20, functionName: "approve", args: [permit2, maxUint256] }), value: "0" },
    { role: "action", from: wallet, to: getAddress(base.swapperContractAddress), data: encodeFunctionData({ abi: abis.swapper, functionName: "execute", args: [concatHex([plan.commands]), plan.inputs] }), value: "0" },
  ];
  return { kind: "transaction", action: "stock_basket", parameters: { trades: [{ side: "buy", stock: "NVDAc", amount: String(Number(usdc) / 1e6) }], slippage: 0.005 }, context: {}, calls };
}

const open: Array<{ close(): void }> = [];
afterEach(() => { for (const handle of open.splice(0)) handle.close(); });

type Options = Readonly<{ respond?: AgentHarness["respond"]; basket?: StockBasketPlanResult; price?: () => number }>;

function fixture(options: Options = {}) {
  const db = new Database(":memory:");
  const store = new Store(":memory:");
  open.push(db, store);
  const sql: WebSql = {
    exec: <Row extends Record<string, SqlStorageValue>>(query: string, ...params: SqlStorageValue[]) => {
      const rows = db.query<Row, SQLQueryBindings[]>(query).all(...params.map((p) => (p instanceof ArrayBuffer ? new Uint8Array(p) : p)));
      return { toArray: () => rows };
    },
  };
  store.saveWallet(identity.senderId, wallet, wallet);
  store.saveWallet("123", "x-wallet-locator", wallet);
  let now = Date.now();
  const clock = () => now;
  const tasks = new TaskStore(sql);
  const control = new TaskControl(tasks, store, clock);
  const approved: string[] = [];
  const prompts: string[] = [];
  const records = new Map<string, ReturnType<typeof awaitingApproval>>();
  const aerodrome: AgentServices["aerodrome"] = {
    run: async (_wallet, action) => {
      if (action !== "quote") throw new Error(`unexpected ${action}`);
      return { kind: "read", action: "quote", parameters: {}, output: { from_price_usd: options.price?.() ?? 1, amount_out_decimal: options.price?.() ?? 1 } };
    },
    basket: async () => { if (!options.basket) throw new Error("unexpected basket"); return options.basket; },
    liquidity: async () => { throw new Error("unexpected liquidity"); },
  };
  const agent = new PecuAgent(
    { enableMainnetExecution: true, maxSlippageBps: 100, quoteTtlSeconds: 600, depositRelayMaxUsd: 500, depositRelayDailyMaxUsd: 2000 },
    store,
    {
      getOrCreate: async () => ({ address: wallet }),
      balances: async () => "",
      usdcBalanceUnits: async () => 0n,
      prepareBatch: async () => { throw new Error("unexpected batch"); },
      prepare: async () => {
        const id = `tx-${records.size + 1}`;
        records.set(id, awaitingApproval(id, wallet));
        return { transactionId: id };
      },
      approve: async (_sender, id) => {
        approved.push(id);
        records.set(id, submittedTransaction(id, wallet, `0x${approved.length.toString().padStart(64, "0")}`));
        return { hash: records.get(id)?.hash };
      },
      transaction: async (_sender, id) => records.get(id)!,
    },
    { ...services({ aerodrome, verifyUserOperation: async (reference) => confirmedOutcome(reference.hash) }), tasks: control },
    {
      respond: async (message, capabilities, mode, progress) => {
        prompts.push(message.text);
        if (!options.respond) throw new Error("unexpected model call");
        return options.respond(message, capabilities, mode, progress);
      },
    },
  );
  const web = new WebAgent(agent, store, sql);
  const pushed: PushMessage[] = [];
  const runner = new ProactiveRunner({ tasks, agent, chat: store, web, push: { send: async (_tokens, message) => { pushed.push(message); return []; } }, clock });
  tasks.registerDevice(identity.senderId, "device-token-0123456789", "android", now);
  const create = (input: TaskCreateInput, target = { senderId: identity.senderId, conversationId: conversation, encodedEvent: "" }) =>
    control.create({ ...target, eventId: crypto.randomUUID(), text: "" }, input);
  return {
    store, tasks, control, agent, web, runner, pushed, approved, prompts, create,
    advance: (ms: number) => { now += ms; },
    now: () => now,
    messages: () => web.state(identity).messages,
  };
}

describe("schedules", () => {
  test("calendar triggers keep their wall-clock time across the October DST change", () => {
    const monday: Trigger = { kind: "calendar", time: "09:00", weekdays: [1], timezone: "Europe/Rome" };
    expect(new Date(nextOccurrence(monday, Date.parse("2026-10-18T12:00:00Z"))!).toISOString()).toBe("2026-10-19T07:00:00.000Z");
    expect(new Date(nextOccurrence(monday, Date.parse("2026-10-25T12:00:00Z"))!).toISOString()).toBe("2026-10-26T08:00:00.000Z");
    expect(describeTrigger(monday)).toBe("Mon 09:00 Europe/Rome");
  });

  test("intervals stay on their grid, one-time triggers finish, and inputs convert once", () => {
    const every30: Trigger = { kind: "interval", everyMinutes: 30, startAt: 1_000_000 };
    expect(nextOccurrence(every30, 1_000_000)).toBe(1_000_000 + 1_800_000);
    expect(nextOccurrence(every30, 1_000_000 + 1_800_000 * 5 + 7)).toBe(1_000_000 + 1_800_000 * 6);
    expect(nextOccurrence({ kind: "once", at: 50 }, 60)).toBeNull();
    expect(triggerFromInput({ kind: "once", in_minutes: 10 }, 0)).toEqual({ kind: "once", at: 600_000 });
    expect(triggerFromInput({ kind: "calendar", time: "08:30", weekdays: ["fri", "mon", "mon"], timezone: "UTC" }, 0)).toEqual({ kind: "calendar", time: "08:30", weekdays: [1, 5], timezone: "UTC" });
    expect(() => triggerFromInput({ kind: "once", at: "2020-01-01T00:00:00Z" }, Date.now())).toThrow("already passed");
    expect(quietHeartbeat("HEARTBEAT_OK")).toBe(true);
    expect(quietHeartbeat("All fine.\nHEARTBEAT_OK")).toBe(true);
    expect(quietHeartbeat("Your AERO position is out of range.")).toBe(false);
  });
});

describe("task control", () => {
  test("only the user can approve an allowance, and editing the work sends it back for approval", () => {
    const f = fixture();
    const task = f.create({ title: "Weekly index", mode: "run", instruction: "Rebalance my index to NVDAc=50,AAPLc=50", trigger: { kind: "interval", every_minutes: 10_080 }, grant: { scopes: ["trade"], max_usd_per_run: 50 } });
    expect(task.grant).toMatchObject({ state: "requested", active: false });
    expect(() => f.control.act(identity.senderId, { code: task.code, kind: "allow" }, "model")).toThrow("Only you");
    expect(f.control.update(identity.senderId, { code: task.code, action: "pause" }).task.state).toBe("paused");
    const allowed = f.control.act(identity.senderId, { code: task.code, kind: "allow", maxUsd: 25 }, "user");
    expect(allowed.task.grant).toMatchObject({ state: "approved", maxUsdPerRun: 25, active: true });
    expect(allowed.message).toContain("YOLO is off");
    const edited = f.control.update(identity.senderId, { code: task.code, action: "edit", instruction: "Rebalance to NVDAc=100" });
    expect(edited.task.grant?.state).toBe("requested");
    expect(f.control.update(identity.senderId, { code: task.code, action: "delete" }).task.state).toBe("cancelled");
    expect(f.control.list(identity.senderId)).toEqual([]);
  });

  test("/tasks lists and approves from a verified chat message, never from a task run", async () => {
    const f = fixture();
    const task = f.create({ title: "Buy AERO", mode: "run", instruction: "Buy $5 of AERO", trigger: { kind: "calendar", time: "09:00", weekdays: ["mon"], timezone: "Europe/Rome" }, grant: { scopes: ["trade"], max_usd_per_run: 10 } }, { senderId: "123", conversationId: "dm", encodedEvent: "event" });
    const send = (text: string) => f.agent.handle({ eventId: crypto.randomUUID(), senderId: "123", conversationId: "dm", encodedEvent: "event", text });
    expect(await send("/tasks")).toContain(`${task.code} · Buy AERO · Mon 09:00 Europe/Rome`);
    expect(await send(`/tasks allow ${task.code} 8`)).toContain("up to $8 per run");
    expect(await send("/tasks pause ZZZZZZ")).toContain("No automation ZZZZZZ");
  });
});

describe("grant decisions", () => {
  const plan = stockPlan(20_000_000n);
  const grant = { scopes: ["trade" as const], maxUsdPerRun: 25, days: 30, state: "approved" as const, approvedAt: 1, expiresAt: Date.now() + 86_400_000 };
  const decide = (overrides: Partial<Parameters<typeof grantDecision>[0]>) => grantDecision({
    intent: { family: "stocks", action: "stock_basket", parameters: plan.parameters }, calls: plan.calls, grant, yolo: true,
    executionEnabled: true, linked: false, spentUsd: 0, now: Date.now(), price: async () => undefined, ...overrides,
  });

  test("executes only inside YOLO, scope, expiry and the per-run cap", async () => {
    expect(await decide({})).toEqual({ execute: true, usd: 20 });
    expect(await decide({ yolo: false })).toMatchObject({ execute: false, reason: "YOLO is off in this chat." });
    expect(await decide({ spentUsd: 10 })).toMatchObject({ execute: false, reason: "It moves about $30.00, above the $25 allowance per run." });
    expect(await decide({ grant: { ...grant, scopes: ["liquidity"] } })).toMatchObject({ execute: false });
    expect(await decide({ grant: { ...grant, expiresAt: Date.now() - 1 } })).toMatchObject({ reason: "Its spending allowance expired." });
    expect(await decide({ grant: { ...grant, state: "requested" } })).toMatchObject({ reason: "Its spending allowance is waiting for your approval." });
    expect(await decide({ intent: { family: "evm", action: "transfer", parameters: { to: wallet, amount: "1", token: "USDC" } } })).toMatchObject({ reason: "This kind of transaction always needs your confirmation." });
  });
});

describe("proactive runner", () => {
  test("a reminder lands in its web thread, notifies the phone with a stable tag, and advances", async () => {
    const f = fixture();
    const task = f.create({ title: "Trade AERO", mode: "remind", instruction: "Check AERO and decide whether to trade", trigger: { kind: "interval", every_minutes: 30 } });
    await f.runner.sweep();
    expect(f.messages()).toEqual([]);
    f.advance(30 * 60_000);
    await f.runner.sweep();
    const [message] = f.messages();
    expect(message).toMatchObject({ text: "Trade AERO", origin: { kind: "task", code: task.code, mode: "remind" }, canRetry: false, reply: { text: "Reminder: Check AERO and decide whether to trade" } });
    expect(f.pushed).toEqual([expect.objectContaining({ kind: "reminder", title: "Trade AERO", tag: `task:${task.code}:${task.nextRunAt}`, channel: "web", threadId: null })]);
    expect(f.tasks.notifications(identity.senderId)[0]).toMatchObject({ kind: "reminder", readAt: null });
    expect(f.control.list(identity.senderId)[0]).toMatchObject({ runCount: 1, nextRunAt: task.nextRunAt! + 30 * 60_000, lastOutcome: "Reminder sent" });
    await f.runner.sweep();
    expect(f.messages()).toHaveLength(1);
  });

  test("a quiet heartbeat stays silent and an alert reaches the user", async () => {
    let reply = "HEARTBEAT_OK";
    const f = fixture({ respond: async () => reply });
    f.create({ title: "Positions check", mode: "heartbeat", instruction: "Tell me if a position is out of range", trigger: { kind: "interval", every_minutes: 60 } });
    f.advance(60 * 60_000);
    await f.runner.sweep();
    expect(f.messages()).toEqual([]);
    expect(f.pushed).toEqual([]);
    expect(f.prompts[0]).toContain("reply exactly HEARTBEAT_OK");
    reply = "Position 123 is out of range.";
    f.advance(60 * 60_000);
    await f.runner.sweep();
    expect(f.messages().map((message) => message.reply?.text)).toEqual(["Position 123 is out of range."]);
    expect(f.pushed.map((message) => message.kind)).toEqual(["alert"]);
  });

  test("a run inside an approved allowance with YOLO on executes without the user", async () => {
    const f = fixture({ basket: stockPlan(20_000_000n), respond: async (_message, capabilities) => capabilities.stockTrades([{ side: "buy", stock: "NVDAc", amount: "20" }]) });
    const task = f.create({ title: "Buy NVDA", mode: "run", instruction: "Buy $20 of NVDAc", trigger: { kind: "interval", every_minutes: 1440 }, grant: { scopes: ["trade"], max_usd_per_run: 25 } });
    f.control.act(identity.senderId, { code: task.code, kind: "allow" }, "user");
    f.store.setYolo(identity.senderId, conversation, true);
    f.advance(1440 * 60_000);
    await f.runner.sweep();
    expect(f.approved).toEqual(["tx-1", "tx-2"]);
    const [message] = f.messages();
    expect(message?.reply?.text).toContain("Executed within this automation's allowance.");
    expect(message?.reply?.preview).toMatchObject({ state: "succeeded" });
    expect(f.pushed.map((push) => [push.kind, push.title])).toEqual([["executed", "Buy NVDA: done"]]);
  });

  test("without YOLO or above the cap the run stops at a preview and asks for approval", async () => {
    let spend = "20";
    const f = fixture({ basket: stockPlan(20_000_000n), respond: async (_message, capabilities) => capabilities.stockTrades([{ side: "buy", stock: "NVDAc", amount: spend }]) });
    const task = f.create({ title: "Buy NVDA", mode: "run", instruction: "Buy $20 of NVDAc", trigger: { kind: "interval", every_minutes: 60 }, grant: { scopes: ["trade"], max_usd_per_run: 10 } });
    f.control.act(identity.senderId, { code: task.code, kind: "allow" }, "user");
    f.advance(60 * 60_000);
    await f.runner.sweep();
    expect(f.approved).toEqual([]);
    expect(f.messages()[0]?.reply?.preview).toMatchObject({ state: "pending" });
    expect(f.pushed[0]).toMatchObject({ kind: "approval", title: "Buy NVDA: confirm the transaction" });
    expect(f.pushed[0]?.body).toContain("YOLO is off in this chat.");
    f.store.setYolo(identity.senderId, conversation, true);
    spend = "20";
    f.advance(60 * 60_000);
    await f.runner.sweep();
    expect(f.approved).toEqual([]);
    expect(f.pushed[1]?.body).toContain("preview expired");
    expect(f.pushed[2]?.body).toContain("above the $10 allowance per run");
  });

  test("a run chains steps within one allowance and stops at the first step that needs the user", async () => {
    const outcomes: string[] = [];
    const f = fixture({
      basket: stockPlan(10_000_000n),
      respond: async (_message, capabilities) => {
        for (let step = 0; step < 4; step++) {
          outcomes.push(await capabilities.stockTrades([{ side: "buy", stock: "NVDAc", amount: "10" }]).then((text) => text.includes("Executed") ? "executed" : "waiting", (error: Error) => error.message));
        }
        return "Bought twice; the third buy needs your approval.";
      },
    });
    const task = f.create({ title: "Pool rebalance", mode: "run", instruction: "Buy $10 of NVDAc three times", trigger: { kind: "interval", every_minutes: 30 }, grant: { scopes: ["trade"], max_usd_per_run: 25 } });
    f.control.act(identity.senderId, { code: task.code, kind: "allow" }, "user");
    f.store.setYolo(identity.senderId, conversation, true);
    f.advance(30 * 60_000);
    await f.runner.sweep();
    expect(outcomes).toEqual(["executed", "executed", "waiting", "A step of this automated run is waiting for the user's approval. Stop and summarize it."]);
    expect(f.messages()[0]?.reply?.preview).toMatchObject({ state: "pending" });
    expect(f.pushed.map((push) => push.kind)).toEqual(["approval"]);
  });

  test("a price alert checks until the condition holds, runs once and finishes", async () => {
    let price = 1.2;
    const f = fixture({ price: () => price });
    const task = f.create({ title: "AERO under $1", mode: "remind", instruction: "AERO is below $1", trigger: { kind: "price", token: "AERO", direction: "below", price_usd: "1", check_minutes: 5 } });
    await f.runner.sweep();
    expect(f.messages()).toEqual([]);
    expect(f.control.list(identity.senderId)[0]).toMatchObject({ lastOutcome: "Checked at $1.20", nextRunAt: f.now() + 300_000 });
    price = 0.97;
    f.advance(300_000);
    await f.runner.sweep();
    expect(f.messages().map((message) => message.reply?.text)).toEqual(["Reminder: AERO is below $1"]);
    expect(f.control.list(identity.senderId)[0]).toMatchObject({ code: task.code, state: "completed", nextRunAt: null });
  });

  test("a busy thread defers the run and retries it a minute later", async () => {
    const f = fixture({ respond: async () => "Your index is balanced." });
    f.create({ title: "Index check", mode: "run", instruction: "Check my index", trigger: { kind: "interval", every_minutes: 60 } });
    const release = f.web.lock(conversation)!;
    f.advance(60 * 60_000);
    await f.runner.sweep();
    expect(f.messages()).toEqual([]);
    release();
    f.advance(60_000);
    await f.runner.sweep();
    expect(f.messages().map((message) => message.reply?.text)).toEqual(["Your index is balanced."]);
  });

  test("X chats get the run through the outbox, and a run can delete itself once its goal is met", async () => {
    let listed = "";
    const f = fixture({
      respond: async (message, capabilities: AgentCapabilities) => {
        listed = await capabilities.taskList();
        const code = /automation ([A-Z2-9]{6})/.exec(message.text)![1]!;
        await capabilities.taskUpdate({ code, action: "delete" });
        return "You hold 100 AERO, so I stopped the daily buy.";
      },
    });
    const task = f.create({ title: "Daily AERO buy", mode: "run", instruction: "Buy $5 of AERO every day until I hold 100 AERO", trigger: { kind: "interval", every_minutes: 1440 } }, { senderId: "123", conversationId: "dm", encodedEvent: "verified-event" });
    f.advance(1440 * 60_000);
    await f.runner.sweep();
    expect(f.prompts[0]).toContain(`call task_update on ${task.code}`);
    expect(JSON.parse(listed)).toEqual([expect.objectContaining({ code: task.code, instruction: "Buy $5 of AERO every day until I hold 100 AERO", chat: "this chat", mode: "run" })]);
    expect(f.control.list("123")).toEqual([]);
    expect(f.store.pendingReplies().map((reply) => [reply.conversationId, reply.replyToEvent, reply.text])).toEqual([["dm", "verified-event", "Daily AERO buy\n\nYou hold 100 AERO, so I stopped the daily buy."]]);
  });

  test("the agent creates, finds, edits and deletes automations from chat", async () => {
    const f = fixture();
    const message = { eventId: crypto.randomUUID(), senderId: identity.senderId, conversationId: conversation, encodedEvent: "", text: "" };
    const tools = f.agent.capabilitiesFor(message);
    const created = await tools.taskCreate({ title: "AERO reminder", mode: "remind", instruction: "Check AERO", trigger: { kind: "calendar", time: "09:00", weekdays: ["mon"], timezone: "Europe/Rome" } });
    const code = /Created ([A-Z2-9]{6})/.exec(created)![1]!;
    expect(created).toContain("Mon 09:00 Europe/Rome");
    expect(JSON.parse(await tools.taskList())[0]).toMatchObject({ code, title: "AERO reminder", schedule: "Mon 09:00 Europe/Rome", chat: "this chat" });
    const edited = await tools.taskUpdate({ code, action: "edit", mode: "run", instruction: "Buy $5 of AERO", trigger: { kind: "calendar", time: "10:30", weekdays: ["fri"], timezone: "Europe/Rome" }, grant: { scopes: ["trade"], max_usd_per_run: 5 } });
    expect(edited).toContain("Fri 10:30 Europe/Rome");
    expect(edited).toContain("needs your approval");
    expect(f.control.list(identity.senderId)[0]).toMatchObject({ mode: "run", instruction: "Buy $5 of AERO", grant: { state: "requested", maxUsdPerRun: 5 } });
    expect(await tools.taskUpdate({ code, action: "edit", remove_grant: true })).toContain("allowance was removed");
    expect(await tools.taskUpdate({ code, action: "pause" })).toContain("Paused");
    expect(await tools.taskUpdate({ code, action: "delete" })).toContain("Deleted AERO reminder");
    expect(await tools.taskList()).toBe("The user has no automations.");
  });
});

test("approval resumes the saved automation after a runner restart without resetting its allowance", async () => {
  let turns = 0;
  const f = fixture({ basket: stockPlan(10_000_000n), respond: async (message, capabilities) => {
    turns++;
    if (turns === 1) {
      await capabilities.stockTrades([{ side: "buy", stock: "NVDAc", amount: "10" }]);
      await capabilities.stockTrades([{ side: "buy", stock: "NVDAc", amount: "10" }]);
    } else expect(message.text).toContain("Total allowance already used this run: $20");
    return capabilities.stockTrades([{ side: "buy", stock: "NVDAc", amount: "10" }]);
  } });
  const task = f.create({ title: "Four purchases", mode: "run", instruction: "Buy $10 of NVDAc four times", trigger: { kind: "once", in_minutes: 1 } });
  expect(() => f.control.act(identity.senderId, { code: task.code, kind: "allow" }, "user")).toThrow("Choose the allowed actions");
  f.control.act(identity.senderId, { code: task.code, kind: "allow", scopes: ["trade"], maxUsd: 25, days: 7 }, "user");
  f.store.setYolo(identity.senderId, conversation, true);
  f.advance(60_000);
  await f.runner.sweep();
  expect(f.control.list(identity.senderId)[0]).toMatchObject({ state: "active", runCount: 0, run: { state: "awaiting_approval" } });
  expect(f.approved).toHaveLength(4);
  const code = f.messages().at(-1)!.reply!.preview!.code;
  await f.agent.handle({ eventId: crypto.randomUUID(), senderId: identity.senderId, conversationId: conversation, encodedEvent: "", text: `/confirm ${code}` });
  expect(f.approved).toHaveLength(6);
  const resumed = new ProactiveRunner({ tasks: f.tasks, agent: f.agent, chat: f.store, web: f.web, clock: f.now });
  await resumed.sweep();
  expect(turns).toBe(2);
  expect(f.approved).toHaveLength(6);
  expect(f.messages().at(-1)!.reply!.text).toContain("above the $25 allowance per run");
  expect(f.control.list(identity.senderId)[0]?.run?.steps).toHaveLength(4);
  await resumed.sweep();
  expect(turns).toBe(2);
  expect(f.approved).toHaveLength(6);
});
