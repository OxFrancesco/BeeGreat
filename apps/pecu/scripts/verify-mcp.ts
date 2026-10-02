import assert from "node:assert/strict";
import { Client, StreamableHTTPClientTransport, type CallToolResult } from "@modelcontextprotocol/client";
import { z } from "zod";
import { createPecuMcpEndpoint } from "../src/mcp";
import {
  McpAuthError, mcpBearerToken, mcpResourceMetadataUrl, mcpVerifiedClerkAuthorization,
  type PecuMcpPrincipal,
} from "../src/mcp-auth";
import type { McpToolCall } from "../src/mcp-contract";
import { mcpInputSchema, mcpToolCatalog, mcpToolDescription } from "../src/mcp-catalog";
import { jsonObjectSchema, type JsonObject, type JsonValue } from "../src/json-contract";
import { registerPecuTools } from "../src/tool-catalog";
import { webSenderId } from "../src/web-identity";

const directory = process.argv[2] ?? "/tmp/pecu-mcp-verification";
const issuer = "https://clerk-mcp-fixture.example";
const readToken = "oat_fixture_read";
const writeToken = "oat_fixture_write";
const secondToken = "oat_fixture_second";
const checks: { name: string; ok: boolean; error?: string }[] = [];
const dispatches: { principal: PecuMcpPrincipal; input: McpToolCall }[] = [];
const exchanges: { method: string; rpcMethod: string | null; protocol: string | null; session: string | null; status: number; responseSession: string | null }[] = [];
const clients: Client[] = [];
const rpcMethodSchema = z.object({ method: z.string() });
const errorResponseSchema = z.object({ error: z.object({ code: z.number(), message: z.string() }) });
const toolResponseSchema = z.object({ result: z.object({ isError: z.boolean().optional(), content: z.array(z.object({ type: z.literal("text"), text: z.string() })) }) });
const identityResultSchema = z.object({ userId: z.string(), senderId: z.string(), clientId: z.string(), requestId: z.string().uuid() });
const inputResultSchema = z.object({ arguments: jsonObjectSchema });
const expectedTools: { name: string; description: string; inputSchema: ReturnType<typeof mcpInputSchema> }[] = [];
registerPecuTools(tool => expectedTools.push({ name: tool.name, description: tool.description, inputSchema: mcpInputSchema(tool.input) }), {
  capabilities: () => { throw new Error("Verification catalog must not execute tools."); },
  loadSkills: async () => { throw new Error("Verification catalog must not execute tools."); },
});

let serveRequest = async (_request: Request): Promise<Response> => new Response("Starting fixture", { status: 503 });
// Port zero asks the OS for an unused port without replacing a project server.
const http = Bun.serve({
  hostname: "127.0.0.1",
  port: 0,
  async fetch(request) {
    let rpcMethod = request.headers.get("Mcp-Method");
    if (!rpcMethod && request.method === "POST") {
      try {
        const decoded = rpcMethodSchema.safeParse(await request.clone().json());
        if (decoded.success) rpcMethod = decoded.data.method;
      } catch {}
    }
    const response = await serveRequest(request);
    exchanges.push({ method: request.method, rpcMethod, protocol: request.headers.get("MCP-Protocol-Version"), session: request.headers.get("MCP-Session-Id"), status: response.status, responseSession: response.headers.get("MCP-Session-Id") });
    return response;
  },
});
const resource = new URL("/mcp", http.url).href;
const config = { resource, issuer };
const validVerification = {
  id: "fixture-token", object: "clerk_idp_oauth_access_token", client_id: "fixture-client", subject: "user_McpFixtureOne",
  scopes: ["pecu:read"], revoked: false, expired: false,
  expiration: Math.floor(Date.now() / 1000) + 3600, aud: resource,
};
const tokens = new Map<string, JsonObject>([
  [readToken, validVerification],
  [writeToken, { ...validVerification, id: "fixture-write", scopes: ["pecu:read", "pecu:write"] }],
  [secondToken, { ...validVerification, id: "fixture-second", client_id: "fixture-second-client", subject: "user_McpFixtureTwo" }],
  ["oat_fixture_expired", { ...validVerification, expiration: Math.floor(Date.now() / 1000) - 10 }],
  ["oat_fixture_revoked", { ...validVerification, revoked: true }],
  ["oat_fixture_wrong_resource", { ...validVerification, aud: "https://another-service.example/mcp" }],
  ["oat_fixture_no_expiration", { ...validVerification, expiration: null }],
  ["oat_fixture_wrong_subject", { ...validVerification, subject: "attacker-supplied-sender" }],
  ["oat_fixture_wrong_object", { ...validVerification, object: "clerk_session" }],
  ["oat_fixture_no_scope", { ...validVerification, scopes: [] }],
  ["oat_fixture_expired_principal", validVerification],
  ["oat_fixture_wrong_resource_principal", validVerification],
]);
const withoutAudience: JsonObject = { ...validVerification };
delete withoutAudience.aud;
tokens.set("oat_fixture_missing_audience", withoutAudience);
let backendFails = false;
let backendThrows = false;
const endpoint = createPecuMcpEndpoint({
  resource,
  issuer,
  async authenticate(request) {
    const token = mcpBearerToken(request);
    if (token === "oat_fixture_null") return null;
    if (token === "oat_fixture_provider_failure") throw new Error("Private fixture provider diagnostics.");
    const verified = tokens.get(token);
    if (!verified) throw new McpAuthError(401, "Unknown fixture token.");
    const authorization = mcpVerifiedClerkAuthorization(verified, resource);
    return {
      ...authorization, token, senderId: webSenderId(authorization.userId, []),
      resource: token === "oat_fixture_wrong_resource_principal" ? "https://another-service.example/mcp" : resource,
      expiresAt: token === "oat_fixture_expired_principal" ? 1 : authorization.expiresAt,
    };
  },
  async execute(principal, input) {
    dispatches.push({ principal, input });
    if (backendThrows) throw new Error("Private fixture backend diagnostics.");
    if (backendFails) return { text: "The fixture backend is unavailable.", isError: true };
    const tool = mcpToolCatalog.find(tool => tool.name === input.name);
    assert.ok(tool);
    const argumentsValue = jsonObjectSchema.parse(tool.input.parse(input.arguments));
    return { text: JSON.stringify({ userId: principal.userId, senderId: principal.senderId, clientId: principal.clientId, requestId: input.requestId, arguments: argumentsValue }), isError: false };
  },
});
serveRequest = endpoint.fetch;
let nextId = 1;

function body(method: string, params: JsonObject = {}): JsonObject {
  return {
    jsonrpc: "2.0", id: nextId++, method,
    params: { ...params, _meta: {
      "io.modelcontextprotocol/protocolVersion": "2026-07-28",
      "io.modelcontextprotocol/clientInfo": { name: "pecu-http-verification", version: "1.0.0" },
      "io.modelcontextprotocol/clientCapabilities": {},
    } },
  };
}

async function post(payload: JsonObject, token = readToken, overrides: HeadersInit = {}): Promise<Response> {
  const headers = new Headers({ "Content-Type": "application/json", Accept: "application/json, text/event-stream", Authorization: `Bearer ${token}`, "MCP-Protocol-Version": "2026-07-28" });
  const method = z.string().parse(payload.method);
  headers.set("Mcp-Method", method);
  const params = jsonObjectSchema.parse(payload.params);
  if (method === "tools/call") headers.set("Mcp-Name", z.string().parse(params.name));
  new Headers(overrides).forEach((value, key) => headers.set(key, value));
  return fetch(resource, { method: "POST", headers, body: JSON.stringify(payload) });
}

function call(name: string, args: JsonObject = {}): JsonObject {
  return body("tools/call", { name, arguments: args });
}

function text(result: CallToolResult): string {
  return result.content.filter(block => block.type === "text").map(block => block.text).join("\n");
}

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

async function connect(mode: "auto" | "legacy", token: string): Promise<Client> {
  const client = new Client({ name: `pecu-fixture-${mode}`, version: "1.0.0" }, { versionNegotiation: { mode } });
  clients.push(client);
  await client.connect(new StreamableHTTPClientTransport(new URL(resource), { requestInit: { headers: { Authorization: `Bearer ${token}` } } }));
  return client;
}

async function rejectsWithoutDispatch(payload: JsonObject, status: number, token = readToken, overrides: HeadersInit = {}): Promise<Response> {
  const before = dispatches.length;
  const response = await post(payload, token, overrides);
  assert.equal(response.status, status);
  assert.equal(dispatches.length, before, "Rejected request reached the backend.");
  return response;
}

try {
  await check("OAuth discovery identifies the same resource and Clerk issuer", async () => {
    const response = await fetch(mcpResourceMetadataUrl(config));
    assert.equal(response.status, 200);
    const metadata = z.object({ resource: z.string(), authorization_servers: z.array(z.string()), scopes_supported: z.array(z.string()), bearer_methods_supported: z.array(z.string()) }).parse(await response.json());
    assert.equal(metadata.resource, resource);
    assert.deepEqual(metadata.authorization_servers, [issuer]);
    assert.ok(metadata.scopes_supported.includes("pecu:read"));
    assert.deepEqual(metadata.bearer_methods_supported, ["header"]);
  });

  await check("Missing authentication returns the OAuth discovery challenge", async () => {
    const before = dispatches.length;
    const response = await fetch(resource, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body("tools/list")) });
    assert.equal(response.status, 401);
    assert.ok(response.headers.get("WWW-Authenticate")?.includes(`resource_metadata="${mcpResourceMetadataUrl(config)}"`));
    assert.equal(response.headers.get("Cache-Control"), "no-store");
    assert.equal(dispatches.length, before);
  });

  for (const token of ["oat_fixture_forged", "oat_fixture_expired", "oat_fixture_revoked", "oat_fixture_wrong_resource", "oat_fixture_missing_audience", "oat_fixture_wrong_subject", "oat_fixture_wrong_object"]) {
    await check(`OAuth boundary rejects ${token.replace("oat_fixture_", "")} credentials before dispatch`, async () => {
      await rejectsWithoutDispatch(call("wallet_address"), 401, token);
    });
  }
  await check("A non-expiring Clerk token is accepted only after active introspection", async () => {
    const response = await post(call("wallet_address"), "oat_fixture_no_expiration");
    assert.equal(response.status, 200);
    const result = toolResponseSchema.parse(await response.json());
    assert.equal(identityResultSchema.parse(JSON.parse(result.result.content[0].text)).senderId, "web-user_McpFixtureOne");
  });
  for (const token of ["oat_fixture_null", "oat_fixture_expired_principal", "oat_fixture_wrong_resource_principal"]) {
    await check(`Endpoint rejects ${token.replace("oat_fixture_", "")} authentication results`, async () => {
      await rejectsWithoutDispatch(call("wallet_address"), 401, token);
    });
  }
  await check("Account provider failures return a redacted HTTP 503 without dispatch", async () => {
    const response = await rejectsWithoutDispatch(call("wallet_address"), 503, "oat_fixture_provider_failure");
    assert.equal(response.headers.get("WWW-Authenticate"), null);
    assert.ok(!(await response.text()).includes("Private fixture"));
  });

  await check("Browser session JWTs cannot authenticate an MCP connection", async () => {
    const encoded = (value: JsonValue) => btoa(JSON.stringify(value)).replaceAll("=", "").replaceAll("+", "-").replaceAll("/", "_");
    const token = `${encoded({ alg: "HS256", typ: "JWT" })}.${encoded({ sub: "user_McpFixtureOne" })}.fixturesignature`;
    await rejectsWithoutDispatch(call("wallet_address"), 401, token);
  });

  await check("Read permission is required before any tool dispatch", async () => {
    const response = await rejectsWithoutDispatch(call("wallet_address"), 403, "oat_fixture_no_scope");
    assert.ok(response.headers.get("WWW-Authenticate")?.includes('scope="pecu:read"'));
  });

  const modern = await connect("auto", readToken);
  await check("Official client negotiates the 2026-07-28 stateless protocol", async () => {
    assert.equal(modern.getNegotiatedProtocolVersion(), "2026-07-28");
    assert.ok(exchanges.some(exchange => exchange.rpcMethod === "server/discover"));
    assert.ok(!exchanges.some(exchange => exchange.rpcMethod === "initialize"));
    assert.ok(exchanges.every(exchange => exchange.session === null && exchange.responseSession === null));
  });

  const catalog = await modern.listTools();
  await Bun.write(`${directory}/tools.json`, JSON.stringify(catalog, null, 2));
  await check("MCP lists every shared Pecu tool and the JavaScript runner", async () => {
    assert.deepEqual(catalog.tools.map(tool => tool.name).sort(), [...expectedTools.map(tool => tool.name), "run_tools"].sort());
    assert.equal(new Set(catalog.tools.map(tool => tool.name)).size, catalog.tools.length);
    for (const expected of expectedTools) {
      const actual = catalog.tools.find(tool => tool.name === expected.name);
      assert.ok(actual, `${expected.name} is missing.`);
      assert.equal(actual.description, mcpToolDescription(expected.name, expected.description));
      assert.deepEqual(actual.inputSchema, expected.inputSchema, `${expected.name} schema differs from chat.`);
    }
    assert.equal(catalog.cacheScope, "private");
    assert.equal(catalog.ttlMs, 30_000);
    assert.equal(catalog.tools.find(tool => tool.name === "wallet_balances")?.annotations?.readOnlyHint, true);
    assert.equal(catalog.tools.find(tool => tool.name === "evm_transfer")?.annotations?.readOnlyHint, false);
    assert.ok(!catalog.tools.some(tool => /^(?:confirm|yolo|task_allow)/.test(tool.name)));
    assert.ok(catalog.tools.find(tool => tool.name === "load_skills")?.description?.includes("stores no session state"));
    for (const tool of catalog.tools.filter(tool => tool._meta?.["app.pecu/requiredScope"] === "pecu:write")) {
      assert.ok(tool.description?.includes("MCP never signs or submits a transaction"), `${tool.name} does not explain its MCP confirmation boundary.`);
      assert.ok(!tool.description?.includes("may execute when YOLO is on"));
      assert.ok(!tool.description?.includes("can execute when YOLO is enabled"));
    }
  });

  await check("A read reaches the backend with the server-verified account", async () => {
    const result = await modern.callTool({ name: "wallet_address", arguments: {} });
    const identity = identityResultSchema.parse(JSON.parse(text(result)));
    assert.equal(identity.userId, "user_McpFixtureOne");
    assert.equal(identity.senderId, "web-user_McpFixtureOne");
    assert.equal(identity.clientId, "fixture-client");
    assert.equal(result.isError, false);
  });

  const transfer = { to: "0x1111111111111111111111111111111111111111", amount: "0.000001", token: "ETH" };
  await check("A read-only connection cannot create transaction previews", async () => {
    const response = await rejectsWithoutDispatch(call("evm_transfer", transfer), 403);
    const challenge = response.headers.get("WWW-Authenticate") ?? "";
    const scopes = /\bscope="([^"]*)"/.exec(challenge)?.[1].split(/\s+/) ?? [];
    assert.ok(scopes.includes("pecu:read"));
    assert.ok(scopes.includes("pecu:write"));
    assert.ok(challenge.includes('error="insufficient_scope"'));
  });

  await check("Write permission reaches preview dispatch with the exact supplied arguments", async () => {
    const response = await post(call("evm_transfer", transfer), writeToken);
    assert.equal(response.status, 200);
    const result = toolResponseSchema.parse(await response.json());
    assert.notEqual(result.result.isError, true);
    const last = dispatches.at(-1);
    assert.ok(last);
    assert.equal(last.input.name, "evm_transfer");
    assert.deepEqual(last.input.arguments, transfer);
    assert.equal(last.principal.senderId, "web-user_McpFixtureOne");
  });

  const liquidity = { selection: { kind: "discover", token0: "ETH", token1: "USDC" }, funding_token: "ETH", budget: { kind: "amount", amount: "1" } };
  const defaultExamples: { name: string; arguments: JsonObject; expected: JsonObject; token: string }[] = [
    { name: "research_start", arguments: { chain: "base" }, expected: { chain: "base", window: "7d" }, token: writeToken },
    { name: "nansen_wallet_pnl_breakdown", arguments: {}, expected: { chain: "base", days: 30 }, token: readToken },
    { name: "aero_liquidity", arguments: liquidity, expected: { ...liquidity, slippage: 0.005 }, token: writeToken },
  ];
  for (const example of defaultExamples) {
    await check(`${example.name} accepts omitted input fields and applies shared defaults`, async () => {
      const before = dispatches.length;
      const response = await post(call(example.name, example.arguments), example.token);
      assert.equal(response.status, 200);
      const result = toolResponseSchema.parse(await response.json()).result;
      assert.equal(result.isError, false);
      assert.equal(dispatches.length, before + 1);
      assert.deepEqual(dispatches.at(-1)?.input.arguments, example.arguments);
      assert.deepEqual(inputResultSchema.parse(JSON.parse(result.content[0].text)).arguments, example.expected);
    });
  }
  await check("Open JSON arguments retain arbitrary nested properties", async () => {
    const examples: { name: string; arguments: JsonObject; token: string }[] = [
      { name: "aave_call", arguments: { name: "supply", arguments: { market: "fixture", amount: "1", extras: { senderId: "calldata-value", values: [1, true, null] } } }, token: writeToken },
      { name: "evm_read", arguments: { address: transfer.to, signatures: ["function inspect((string senderId, bool enabled) value) view returns (uint256)"], functionName: "inspect", args: [{ senderId: "calldata-value", enabled: true }] }, token: readToken },
    ];
    for (const example of examples) {
      const response = await post(call(example.name, example.arguments), example.token);
      const result = toolResponseSchema.parse(await response.json()).result;
      assert.equal(result.isError, false);
      assert.deepEqual(inputResultSchema.parse(JSON.parse(result.content[0].text)).arguments, example.arguments);
    }
  });
  await check("Fixed nested argument objects reject unknown identity fields", async () => {
    const before = dispatches.length;
    const response = await post(call("aero_liquidity", { ...liquidity, selection: { ...liquidity.selection, senderId: "attacker" } }), writeToken);
    assert.equal(toolResponseSchema.parse(await response.json()).result.isError, true);
    assert.equal(dispatches.length, before);
  });

  for (const key of ["senderId", "userId", "wallet", "conversationId", "identity"]) {
    await check(`Tool schemas reject caller-supplied ${key} before dispatch`, async () => {
      const before = dispatches.length;
      const response = await post(call("wallet_address", { [key]: "attacker" }));
      assert.equal(response.status, 200);
      assert.equal(toolResponseSchema.parse(await response.json()).result.isError, true);
      assert.equal(dispatches.length, before);
    });
  }

  await check("Malformed transaction amounts fail validation before backend dispatch", async () => {
    const before = dispatches.length;
    const response = await post(call("evm_transfer", { ...transfer, amount: "-1" }), writeToken);
    assert.equal(toolResponseSchema.parse(await response.json()).result.isError, true);
    assert.equal(dispatches.length, before);
  });

  await check("Independent modern requests isolate two authenticated accounts without initialization", async () => {
    for (const token of [secondToken, readToken, secondToken]) {
      const response = await post(call("wallet_address"), token);
      assert.equal(response.status, 200);
      const result = toolResponseSchema.parse(await response.json());
      const identity = identityResultSchema.parse(JSON.parse(result.result.content[0].text));
      const expected = token === secondToken ? "user_McpFixtureTwo" : "user_McpFixtureOne";
      assert.equal(identity.userId, expected);
      assert.equal(identity.senderId, `web-${expected}`);
      assert.equal(response.headers.get("MCP-Session-Id"), null);
    }
  });
  await check("Protocol client metadata cannot select a different Pecu account", async () => {
    const payload = call("wallet_address");
    const params = jsonObjectSchema.parse(payload.params);
    const metadata = jsonObjectSchema.parse(params._meta);
    metadata["io.modelcontextprotocol/clientInfo"] = { name: "user_McpFixtureTwo", version: "1.0.0" };
    metadata["app.pecu/identity"] = { userId: "user_McpFixtureTwo", senderId: "web-user_McpFixtureTwo" };
    params._meta = metadata;
    payload.params = params;
    const response = await post(payload);
    assert.equal(response.status, 200);
    const result = toolResponseSchema.parse(await response.json());
    assert.equal(identityResultSchema.parse(JSON.parse(result.result.content[0].text)).userId, "user_McpFixtureOne");
  });
  await check("A UUID idempotency key survives repeated HTTP calls to the backend", async () => {
    const requestId = crypto.randomUUID();
    for (let index = 0; index < 2; index++) {
      const response = await post(call("wallet_address"), readToken, { "Idempotency-Key": requestId });
      assert.equal(response.status, 200);
      const result = toolResponseSchema.parse(await response.json());
      assert.equal(identityResultSchema.parse(JSON.parse(result.result.content[0].text)).requestId, requestId);
      assert.equal(dispatches.at(-1)?.input.requestId, requestId);
    }
  });
  await check("An invalid idempotency key is rejected before backend dispatch", async () => {
    await rejectsWithoutDispatch(call("wallet_address"), 400, readToken, { "Idempotency-Key": "not-a-uuid" });
  });

  for (const origin of ["https://attacker.example", "null", "not-an-origin"]) {
    await check(`Origin validation rejects ${origin} before backend dispatch`, async () => {
      await rejectsWithoutDispatch(call("wallet_address"), 403, readToken, { Origin: origin });
    });
  }
  await check("Host validation rejects a DNS rebinding request", async () => {
    await rejectsWithoutDispatch(call("wallet_address"), 403, readToken, { Host: "attacker.example" });
  });
  await check("The configured resource origin is accepted", async () => {
    const response = await post(call("wallet_address"), readToken, { Origin: new URL(resource).origin });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("Access-Control-Allow-Origin"), new URL(resource).origin);
    assert.ok(response.headers.get("Access-Control-Expose-Headers")?.includes("WWW-Authenticate"));
  });
  await check("CORS preflight permits the OAuth and MCP request headers", async () => {
    const before = dispatches.length;
    const response = await fetch(resource, { method: "OPTIONS", headers: { Origin: new URL(resource).origin, "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "authorization,mcp-protocol-version,mcp-method,mcp-name,idempotency-key" } });
    assert.equal(response.status, 204);
    assert.equal(dispatches.length, before);
    const allowed = response.headers.get("Access-Control-Allow-Headers")?.toLowerCase();
    for (const name of ["authorization", "mcp-protocol-version", "mcp-method", "mcp-name", "idempotency-key"]) assert.ok(allowed?.includes(name));
  });

  for (const [header, value] of [["MCP-Protocol-Version", "2025-11-25"], ["Mcp-Method", "tools/list"], ["Mcp-Name", "wallet_balances"]]) {
    await check(`MCP rejects mismatched ${header} headers`, async () => {
      const headers = new Headers([[header, value]]);
      const response = await rejectsWithoutDispatch(call("wallet_address"), 400, readToken, headers);
      assert.equal(errorResponseSchema.parse(await response.json()).error.code, -32020);
    });
  }
  await check("An unknown modern RPC method returns HTTP 404 and method-not-found", async () => {
    const response = await rejectsWithoutDispatch(body("fixture/unknown"), 404);
    assert.equal(errorResponseSchema.parse(await response.json()).error.code, -32601);
  });
  await check("A malformed modern metadata envelope is rejected", async () => {
    const payload = body("tools/list");
    payload.params = { _meta: { "io.modelcontextprotocol/protocolVersion": "2026-07-28" } };
    await rejectsWithoutDispatch(payload, 400);
  });
  await check("An unsupported modern revision returns the supported protocol list", async () => {
    const payload = body("tools/list");
    const params = jsonObjectSchema.parse(payload.params);
    const metadata = jsonObjectSchema.parse(params._meta);
    metadata["io.modelcontextprotocol/protocolVersion"] = "2099-01-01";
    params._meta = metadata;
    payload.params = params;
    const response = await rejectsWithoutDispatch(payload, 400, readToken, { "MCP-Protocol-Version": "2099-01-01" });
    assert.ok((await response.text()).includes("2026-07-28"));
  });
  await check("Oversized HTTP requests are rejected before backend dispatch", async () => {
    await rejectsWithoutDispatch(call("run_tools", { code: "x".repeat(5 * 1024 * 1024) }), 413, writeToken);
  });
  for (const method of ["GET", "DELETE"]) {
    await check(`${method} cannot open or remove a protocol session`, async () => {
      const response = await fetch(resource, { method, headers: { Authorization: `Bearer ${readToken}` } });
      assert.equal(response.status, 405);
      assert.equal(response.headers.get("MCP-Session-Id"), null);
    });
  }

  await check("Backend failures return isError instead of a successful tool result", async () => {
    backendFails = true;
    try {
      const result = await modern.callTool({ name: "wallet_balances", arguments: {} });
      assert.equal(result.isError, true);
      assert.equal(text(result), "The fixture backend is unavailable.");
    } finally {
      backendFails = false;
    }
  });
  await check("Unexpected backend exceptions return a redacted failed tool result", async () => {
    backendThrows = true;
    try {
      const result = await modern.callTool({ name: "wallet_balances", arguments: {} });
      assert.equal(result.isError, true);
      assert.ok(!text(result).includes("Private fixture"));
    } finally {
      backendThrows = false;
    }
  });

  await check("Legacy official clients use the same catalog and authenticated tool dispatch", async () => {
    const legacy = await connect("legacy", readToken);
    const listed = await legacy.listTools();
    assert.deepEqual(listed.tools.map(tool => tool.name).sort(), catalog.tools.map(tool => tool.name).sort());
    assert.equal(listed.ttlMs, undefined);
    assert.equal(listed.cacheScope, undefined);
    const result = await legacy.callTool({ name: "wallet_address", arguments: {} });
    assert.equal(identityResultSchema.parse(JSON.parse(text(result))).senderId, "web-user_McpFixtureOne");
    assert.ok(exchanges.some(exchange => exchange.rpcMethod === "initialize"));
    assert.ok(exchanges.every(exchange => exchange.session === null && exchange.responseSession === null));
  });
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  checks.push({ name: "HTTP verification completes", ok: false, error: message });
  console.error(`FAIL HTTP verification completes: ${message}`);
} finally {
  await Promise.allSettled(clients.map(client => client.close()));
  await endpoint.close();
  await http.stop(true);
  const failures = checks.filter(result => !result.ok).length;
  await Bun.write(`${directory}/report.json`, JSON.stringify({
    checkedAt: new Date().toISOString(), verification: "fixture-backed HTTP end-to-end",
    protocol: "2026-07-28", toolCount: expectedTools.length + 1, failures, checks,
    limitations: ["Clerk verification records and Pecu backend execution are fixtures.", "No production OAuth connection, wallet provisioning, transaction plan, signing or on-chain execution was performed."],
  }, null, 2));
  await Bun.write(`${directory}/http-exchanges.json`, JSON.stringify(exchanges, null, 2));
  console.log(`${checks.length} checks, ${failures} failures. Fixture-backed HTTP evidence: ${directory}`);
  if (failures) process.exitCode = 1;
}
