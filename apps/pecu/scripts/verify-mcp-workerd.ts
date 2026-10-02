import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { z } from "zod";
import { mcpToolCatalog } from "../src/mcp-catalog";
import { jsonObjectSchema, type JsonObject } from "../src/json-contract";

const directory = process.argv[2] ?? "/tmp/pecu-mcp-workerd-verification";
const checks: { name: string; ok: boolean; error?: string }[] = [];
const clients: Client[] = [];
const readinessSchema = z.object({ fixture: z.literal("pecu-mcp-workerd"), tools: z.number() });
const dispatchSchema = z.object({ dispatches: z.number() });
const toolResponseSchema = z.object({ result: z.object({ isError: z.boolean().optional(), content: z.array(z.object({ type: z.literal("text"), text: z.string() })) }) });
const resultSchema = z.object({ senderId: z.string(), name: z.string(), arguments: jsonObjectSchema, requestId: z.string().uuid() });
const cwd = fileURLToPath(new URL("../", import.meta.url));

function reservePort(): number {
  const listener = Bun.listen({ hostname: "127.0.0.1", port: 0, socket: { data() {} } });
  const port = listener.port;
  listener.stop(true);
  return port;
}
const port = reservePort();
const inspectorPort = reservePort();
const origin = `http://127.0.0.1:${port}`;
const resource = `${origin}/mcp`;
const worker = Bun.spawn({
  cmd: ["bunx", "wrangler", "dev", "--config", "tests/fixtures/wrangler.mcp-workerd.jsonc", "--local", "--ip", "127.0.0.1", "--port", String(port), "--inspector-port", String(inspectorPort), "--var", `MCP_FIXTURE_RESOURCE:${resource}`, "--persist-to", `${directory}/runtime`, "--show-interactive-dev-session=false"],
  cwd,
  env: { ...process.env, WRANGLER_SEND_METRICS: "false", WRANGLER_WRITE_LOGS: "false", WRANGLER_REGISTRY_PATH: `${directory}/registry` },
  stdout: "pipe", stderr: "pipe",
});
const logs = new Response(worker.stdout).text();
const errors = new Response(worker.stderr).text();
let id = 1;

async function check(name: string, run: () => Promise<void>): Promise<void> {
  try {
    await run();
    checks.push({ name, ok: true });
    console.log(`PASS ${name}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    checks.push({ name, ok: false, error: message });
    console.error(`FAIL ${name}: ${message}`);
  }
}
async function dispatchCount(): Promise<number> {
  return dispatchSchema.parse(await (await fetch(`${origin}/dispatches`)).json()).dispatches;
}
async function post(name: string, args: JsonObject, token = "oat_fixture_read", overrides: HeadersInit = {}): Promise<Response> {
  const headers = new Headers({ "Content-Type": "application/json", Accept: "application/json, text/event-stream", Authorization: `Bearer ${token}`, "MCP-Protocol-Version": "2026-07-28", "Mcp-Method": "tools/call", "Mcp-Name": name });
  new Headers(overrides).forEach((value, key) => headers.set(key, value));
  return fetch(resource, { method: "POST", headers, body: JSON.stringify({
    jsonrpc: "2.0", id: id++, method: "tools/call", params: { name, arguments: args, _meta: {
      "io.modelcontextprotocol/protocolVersion": "2026-07-28",
      "io.modelcontextprotocol/clientInfo": { name: "pecu-workerd-verification", version: "1.0.0" },
      "io.modelcontextprotocol/clientCapabilities": {},
    } },
  }) });
}
async function connect(mode: "auto" | "legacy"): Promise<Client> {
  const client = new Client({ name: `pecu-workerd-${mode}`, version: "1.0.0" }, { versionNegotiation: { mode } });
  clients.push(client);
  await client.connect(new StreamableHTTPClientTransport(new URL(resource), { requestInit: { headers: { Authorization: "Bearer oat_fixture_read" } } }));
  return client;
}

try {
  let ready = false;
  for (const deadline = Date.now() + 45_000; Date.now() < deadline;) {
    try {
      const response = await fetch(`${origin}/healthz`, { signal: AbortSignal.timeout(2000) });
      const value = readinessSchema.parse(await response.json());
      assert.equal(value.tools, mcpToolCatalog.length);
      ready = true;
      break;
    } catch {
      if (worker.exitCode !== null) break;
      await Bun.sleep(150);
    }
  }
  assert.ok(ready, "The isolated MCP Workerd fixture did not start.");

  await check("MCP code and the complete catalog start inside Workerd", async () => {
    assert.equal(worker.exitCode, null);
    assert.equal(readinessSchema.parse(await (await fetch(`${origin}/healthz`)).json()).tools, mcpToolCatalog.length);
  });
  await check("Workerd serves protected resource metadata and OAuth challenges", async () => {
    const metadataResponse = await fetch(`${origin}/.well-known/oauth-protected-resource/mcp`);
    assert.equal(metadataResponse.status, 200);
    const metadata = z.object({ resource: z.string(), authorization_servers: z.array(z.string()) }).parse(await metadataResponse.json());
    assert.equal(metadata.resource, resource);
    assert.deepEqual(metadata.authorization_servers, ["https://clerk-mcp-fixture.example"]);
    const response = await fetch(resource, { method: "POST", body: "{}", headers: { "Content-Type": "application/json" } });
    assert.equal(response.status, 401);
    assert.ok(response.headers.get("WWW-Authenticate")?.includes("oauth-protected-resource/mcp"));
  });

  const modern = await connect("auto");
  await check("The official HTTP client negotiates 2026-07-28 with Workerd", async () => {
    assert.equal(modern.getNegotiatedProtocolVersion(), "2026-07-28");
  });
  const catalog = await modern.listTools();
  await Bun.write(`${directory}/tools.json`, JSON.stringify(catalog, null, 2));
  await check("Workerd lists every Pecu schema with modern cache hints", async () => {
    assert.deepEqual(catalog.tools.map(tool => tool.name).sort(), mcpToolCatalog.map(tool => tool.name).sort());
    for (const expected of mcpToolCatalog) {
      const actual = catalog.tools.find(tool => tool.name === expected.name);
      assert.ok(actual);
      assert.deepEqual(actual.inputSchema, expected.inputSchema, `${expected.name} schema differs in Workerd.`);
    }
    assert.equal(catalog.cacheScope, "private");
    assert.equal(catalog.ttlMs, 30_000);
  });
  await check("A validated read dispatches successfully in Workerd", async () => {
    const result = await modern.callTool({ name: "wallet_address", arguments: {} });
    assert.equal(result.isError, false);
    const first = result.content[0];
    assert.ok(first?.type === "text");
    const decoded = resultSchema.parse(JSON.parse(first.text));
    assert.equal(decoded.senderId, "web-user_McpWorkerd");
    assert.equal(decoded.name, "wallet_address");
  });
  await check("The Worker JSON schema validator rejects identity spoofing before dispatch", async () => {
    const before = await dispatchCount();
    const response = await post("wallet_address", { senderId: "attacker" });
    assert.equal(response.status, 200);
    assert.equal(toolResponseSchema.parse(await response.json()).result.isError, true);
    assert.equal(await dispatchCount(), before);
  });
  await check("Read-only OAuth connections cannot dispatch writes in Workerd", async () => {
    const before = await dispatchCount();
    const response = await post("evm_transfer", { to: "0x1111111111111111111111111111111111111111", amount: "0.000001" });
    assert.equal(response.status, 403);
    const scopes = /\bscope="([^"]*)"/.exec(response.headers.get("WWW-Authenticate") ?? "")?.[1].split(/\s+/) ?? [];
    assert.ok(scopes.includes("pecu:read"));
    assert.ok(scopes.includes("pecu:write"));
    assert.equal(await dispatchCount(), before);
  });
  await check("Authorized write requests dispatch validated arguments in Workerd", async () => {
    const response = await post("evm_transfer", { to: "0x1111111111111111111111111111111111111111", amount: "0.000001" }, "oat_fixture_write");
    assert.equal(response.status, 200);
    assert.equal(toolResponseSchema.parse(await response.json()).result.isError, false);
  });
  const liquidity = { selection: { kind: "discover", token0: "ETH", token1: "USDC" }, funding_token: "ETH", budget: { kind: "amount", amount: "1" } };
  const defaultExamples: { name: string; arguments: JsonObject; expected: JsonObject; token: string }[] = [
    { name: "research_start", arguments: { chain: "base" }, expected: { chain: "base", window: "7d" }, token: "oat_fixture_write" },
    { name: "nansen_wallet_pnl_breakdown", arguments: {}, expected: { chain: "base", days: 30 }, token: "oat_fixture_read" },
    { name: "aero_liquidity", arguments: liquidity, expected: { ...liquidity, slippage: 0.005 }, token: "oat_fixture_write" },
  ];
  for (const example of defaultExamples) {
    await check(`${example.name} accepts omitted fields and applies shared defaults inside Workerd`, async () => {
      const before = await dispatchCount();
      const response = await post(example.name, example.arguments, example.token);
      assert.equal(response.status, 200);
      const result = toolResponseSchema.parse(await response.json()).result;
      assert.equal(result.isError, false);
      assert.equal(await dispatchCount(), before + 1);
      assert.deepEqual(resultSchema.parse(JSON.parse(result.content[0].text)).arguments, example.expected);
    });
  }
  await check("Workerd preserves arbitrary nested JSON arguments", async () => {
    const examples: { name: string; arguments: JsonObject; token: string }[] = [
      { name: "aave_call", arguments: { name: "supply", arguments: { market: "fixture", amount: "1", extras: { senderId: "calldata-value", values: [1, true, null] } } }, token: "oat_fixture_write" },
      { name: "evm_read", arguments: { address: "0x1111111111111111111111111111111111111111", signatures: ["function inspect((string senderId, bool enabled) value) view returns (uint256)"], functionName: "inspect", args: [{ senderId: "calldata-value", enabled: true }] }, token: "oat_fixture_read" },
    ];
    for (const example of examples) {
      const response = await post(example.name, example.arguments, example.token);
      const result = toolResponseSchema.parse(await response.json()).result;
      assert.equal(result.isError, false);
      assert.deepEqual(resultSchema.parse(JSON.parse(result.content[0].text)).arguments, example.arguments);
    }
  });
  await check("Workerd rejects unknown identity fields in fixed nested argument objects", async () => {
    const before = await dispatchCount();
    const response = await post("aero_liquidity", { ...liquidity, selection: { ...liquidity.selection, senderId: "attacker" } }, "oat_fixture_write");
    assert.equal(toolResponseSchema.parse(await response.json()).result.isError, true);
    assert.equal(await dispatchCount(), before);
  });
  await check("Workerd rejects mismatched MCP headers before dispatch", async () => {
    const before = await dispatchCount();
    const response = await post("wallet_address", {}, "oat_fixture_read", { "Mcp-Name": "wallet_balances" });
    assert.equal(response.status, 400);
    assert.equal(await dispatchCount(), before);
  });
  await check("Workerd rejects cross-origin requests before dispatch", async () => {
    const before = await dispatchCount();
    const response = await post("wallet_address", {}, "oat_fixture_read", { Origin: "https://attacker.example" });
    assert.equal(response.status, 403);
    assert.equal(await dispatchCount(), before);
  });
  await check("Stateless Workerd transport cannot create GET sessions", async () => {
    const response = await fetch(resource, { headers: { Authorization: "Bearer oat_fixture_read" } });
    assert.equal(response.status, 405);
    assert.equal(response.headers.get("MCP-Session-Id"), null);
  });
  await check("Legacy official clients retain catalog and reads in Workerd", async () => {
    const legacy = await connect("legacy");
    const tools = await legacy.listTools();
    assert.deepEqual(tools.tools.map(tool => tool.name).sort(), catalog.tools.map(tool => tool.name).sort());
    assert.equal(tools.ttlMs, undefined);
    const result = await legacy.callTool({ name: "wallet_address", arguments: {} });
    assert.equal(result.isError, false);
    const first = result.content[0];
    assert.ok(first?.type === "text");
    assert.equal(resultSchema.parse(JSON.parse(first.text)).senderId, "web-user_McpWorkerd");
  });
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  checks.push({ name: "Workerd HTTP verification completes", ok: false, error: message });
  console.error(`FAIL Workerd HTTP verification completes: ${message}`);
} finally {
  await Promise.allSettled(clients.map(client => client.close()));
  if (worker.exitCode === null) worker.kill();
  await worker.exited;
  await Bun.write(`${directory}/wrangler.stdout.log`, await logs);
  await Bun.write(`${directory}/wrangler.stderr.log`, await errors);
  const failures = checks.filter(check => !check.ok).length;
  await Bun.write(`${directory}/report.json`, JSON.stringify({ checkedAt: new Date().toISOString(), verification: "Workerd HTTP end-to-end with fixture OAuth and execution", protocol: "2026-07-28", toolCount: mcpToolCatalog.length, checks, failures, limitations: ["Clerk introspection and tool execution use explicit fixtures. No live OAuth, wallet provisioning, signing or funds movement."] }, null, 2));
  console.log(`${checks.length} checks, ${failures} failures. Workerd evidence: ${directory}`);
  if (failures) process.exitCode = 1;
}
