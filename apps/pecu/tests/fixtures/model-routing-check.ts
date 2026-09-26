import { unusedCapabilities } from "./agent-services";
import type { JsonFields } from "../../src/json-contract";
import { expect, mock } from "bun:test";
import { Store } from "../../src/store";
import { z } from "zod";

const created: string[] = [];
const switched: { sessionID: string; model: { providerID: string; id: string; variant: string } }[] = [];
const prompts: string[] = [];
const toolCatalogs: string[][] = [];
const contextQueue: JsonFields[] = [];
const answer = { type: "assistant", time: { created: 2 }, content: [{ type: "text", text: "answer" }] };
let directPreview = false;
let interrupts = 0;
let streamGate: Promise<void> | undefined;
let streamReady: (() => void) | undefined;
let streamObserved: (() => void) | undefined;
let streamDone: Promise<void> | undefined;
const client = {
  events: { async *subscribe({ signal }: { signal: AbortSignal }) {
    yield { type: "server.connected" };
    await streamGate;
    if (signal.aborted) return;
    if (directPreview) {
      yield { type: "session.tool.input.started", data: { sessionID: "session", id: "liquidity-call", name: "aero_liquidity" } };
      yield { type: "session.tool.success", data: { sessionID: "session", id: "liquidity-call", content: [{ type: "text", text: "Verified preview. /confirm ABC123" }], metadata: { pecu_direct_reply: true } } };
      streamObserved?.();
      return;
    }
    yield { type: "session.text.delta", data: { sessionID: "session", assistantMessageID: "stream-answer", ordinal: 0, delta: "First paragraph.\n\nLast para" } };
    streamObserved?.();
    await new Promise<void>((resolve) => signal.addEventListener("abort", () => resolve(), { once: true }));
  } },
  sessions: {
    interrupt: async () => { interrupts++; },
    get: async () => ({ id: "session" }),
    create: async (input: { model: { id: string } }) => { created.push(input.model.id); return { id: "session" }; },
    switchModel: async (input: (typeof switched)[number]) => { switched.push(input); },
    prompt: async (input: { sessionID: string; text: string }) => {
      prompts.push(input.text);
      streamReady?.();
      const event = { sessionID: input.sessionID, tools: Object.fromEntries(registered) };
      await hooks.get("context")!(event);
      toolCatalogs.push(Object.keys(event.tools));
      return { timeCreated: 1 };
    },
    wait: async () => { await streamDone; },
    context: async () => { throw new Error("Reply extraction must not load the conversation"); },
  },
  message: { list: async (input: { limit: number; order: string }) => {
    expect(input).toMatchObject({ limit: 1, order: "desc" });
    return { data: [contextQueue.length ? contextQueue.shift() : answer] };
  } },
  integration: { list: async () => ({ data: [{ id: "openai", connections: [{ type: "credential", id: "cred" }], methods: [] }] }) },
};
type Model = { providerID: string; id: string; variant: string };
type Decision = { retry: false } | { retry: true; delay: number };
type Tool = { execute(input: JsonFields, context: { sessionID: string }): Promise<{ content: string }> };
type HookEvents = {
  "context": { sessionID: string; tools: Record<string, Partial<Tool>> };
  "model.request": { model: Model; headers: Record<string, string> };
  "http.request": { agent: string; sessionID: string; model: Model; request: Request };
  "http.response": { model: Model; request: Request; response: Response };
  "retry": { sessionID: string; model: Model; attempt: number; error: { type: string; message: string; status: number }; decision: Decision };
  "execute.after": { tool: string; status: string; result: { content: string; metadata?: JsonFields } };
};
type HookRegistry = { [K in keyof HookEvents]?: (event: HookEvents[K]) => Promise<void> };
class Hooks {
  private readonly entries: HookRegistry = {};
  set<K extends keyof HookEvents>(name: K, fn: (event: HookEvents[K]) => Promise<void>) {
    // SAFETY: the same generic key selects the event input and registry slot; TypeScript loses that correlation in a mapped-type write.
    this.entries[name] = fn as HookRegistry[K];
  }
  get<K extends keyof HookEvents>(name: K) { return this.entries[name]; }
}
const hooks = new Hooks();
const registered = new Map<string, Tool>();
type ToolDraft = { list(): { id: string }[]; remove(id: string): void; add(tool: Tool & { name: string; input: z.ZodType }): void };
type AgentDraft = { default(name: string): void; list(): { id: string }[] };
type CreateOptions = { config?: { providers?: Record<string, { settings?: JsonFields }> }; plugins: { setup(context: typeof pluginContext): Promise<void> }[] };
const creates: CreateOptions[] = [];
let plugin: CreateOptions["plugins"][number] | undefined;
mock.module("@opencode-ai/sdk/workerd", () => ({ OpenCodeWorkerd: { create: async (options: CreateOptions) => { creates.push(options); plugin = options.plugins[0]; return client; } } }));
mock.module("@opencode-ai/plugin", () => ({ Plugin: { define: <T>(value: T) => value } }));
const { OpenCodeHarness } = await import("../../src/cloudflare/opencode");
const store = new Store(":memory:");
const values = new Map<string, unknown>();
const storage = { get: async (key: string) => values.get(key), put: async <T>(key: string, value: T) => { values.set(key, value); }, delete: async (key: string) => values.delete(key) };
const openai = { providerID: "openai", id: "gpt-6-sol", variant: "medium" };
const openrouter = { providerID: "openrouter", id: "openai/gpt-6-sol", variant: "medium" };
const openrouterSmall = { providerID: "openrouter", id: "openai/gpt-6-luna", variant: "low" };
const pluginContext = {
  integration: { connection: { active: async () => ({ id: "connection" }), resolve: async () => ({ type: "oauth", methodID: "chatgpt-headless", metadata: { accountID: "account-test" } }) } },
  session: { hook: async <K extends keyof HookEvents>(name: K, fn: (event: HookEvents[K]) => Promise<void>) => { hooks.set(name, fn); } },
  tool: { hook: async <K extends keyof HookEvents>(name: K, fn: (event: HookEvents[K]) => Promise<void>) => { hooks.set(name, fn); }, transform: async (fn: (draft: ToolDraft) => void) => fn({ list: () => [], remove() {}, add(tool: Tool & { name: string; input: z.ZodType }) { z.toJSONSchema(tool.input); registered.set(tool.name,tool); } }) },
  agent: { transform: async (fn: (draft: AgentDraft) => void) => fn({ default() {}, list: () => [] }) },
};
try {
  const capabilities = unusedCapabilities;
  let bound = true;
  // SAFETY: the mocked SDK never accesses storage; the harness only uses this fixture’s get/put/delete methods without analytics.
  const harness = await OpenCodeHarness.create(storage as DurableObjectStorage, store, () => { if (!bound) throw new Error("Turn is no longer bound"); return capabilities; });
  expect(creates.at(-1)!.config?.providers?.openrouter).toBeUndefined();
  expect(harness.fallbackConfigured).toBe(false);
  await plugin!.setup(pluginContext);
  const subscriptionRequest = { model: openai, headers: {} };
  await hooks.get("model.request")!(subscriptionRequest);
  expect(subscriptionRequest.headers).toEqual({ "chatgpt-account-id": "account-test" });
  const fallbackRequest = { model: openrouter, headers: {} };
  await hooks.get("model.request")!(fallbackRequest);
  expect(fallbackRequest.headers).toEqual({});
  const inventoryProcess = Bun.spawn([process.execPath, new URL("../../scripts/command-inventory.ts", import.meta.url).pathname], { stdout: "pipe", stderr: "pipe" });
  const [inventoryText, inventoryError, inventoryExit] = await Promise.all([new Response(inventoryProcess.stdout).text(), new Response(inventoryProcess.stderr).text(), inventoryProcess.exited]);
  expect({ inventoryError, inventoryExit }).toEqual({ inventoryError: "", inventoryExit: 0 });
  const inventory = JSON.parse(inventoryText);
  expect(inventory.modelTools.map((tool: { name: string }) => tool.name)).toEqual([...registered.keys()].sort());
  const toolReply = {tool:"polymarket_search",status:"completed",result:{content:JSON.stringify({data:{private:"not telemetry"},presentation:{source_bytes:155870,partial:false}})}};
  await hooks.get("execute.after")!(toolReply);
  expect(toolReply.result).toMatchObject({metadata:{pecu_source_bytes:155870,pecu_output_partial:false,pecu_output_bytes:Buffer.byteLength(toolReply.result.content)}});
  const message = { eventId: "1", senderId: "sender", conversationId: "chat", text: "Explain slippage", encodedEvent: "verified" };
  store.saveAgentSession("sender","catalog-chat","catalog");
  const catalog = () => ({sessionID:"catalog",tools:{polymarket_search:{},polymarket_midpoint:{},polymarket_positions:{},ask_user:{},enable_all_tools:{},evm_transfer:{},nansen_token_flows:{}}});
  store.saveAgentTurn("catalog", {...message,conversationId:"catalog-chat",eventId:"catalog-turn",text:"Compare Polymarket odds, then check my wallet"});
  const scoped=catalog(); const originalTools=scoped.tools; await hooks.get("context")!(scoped);
  expect(originalTools).toHaveProperty("evm_transfer");
  expect(Object.keys(scoped.tools)).toEqual(["polymarket_search","polymarket_midpoint","ask_user","enable_all_tools"]);
  await registered.get("enable_all_tools")!.execute({}, {sessionID:"catalog"});
  const expanded=catalog(); await hooks.get("context")!(expanded);
  expect(expanded.tools).toHaveProperty("evm_transfer");
  expect(expanded.tools).toHaveProperty("polymarket_positions");
  store.saveAgentTurn("catalog", {...message,conversationId:"catalog-chat",eventId:"next-turn",text:"Check Polymarket odds"});
  const isolated=catalog(); await hooks.get("context")!(isolated);
  expect(isolated.tools).not.toHaveProperty("evm_transfer");
  store.saveAgentTurn("catalog", {...message,conversationId:"catalog-chat",eventId:"wallet-turn",text:"Check my wallet"});
  const wallet=catalog(); await hooks.get("context")!(wallet);
  expect(wallet.tools).toHaveProperty("evm_transfer");
  bound = false;
  await expect(hooks.get("context")!(catalog())).rejects.toThrow("no longer bound");
  bound = true;

  expect(await harness.respond({ ...message, transactionContext: "Verified completed transaction" }, capabilities, "response")).toBe("answer");
  expect(toolCatalogs.at(-1)).toEqual(["ask_user"]);
  expect(await harness.respond({ ...message, eventId: "2" }, capabilities, "mixed")).toBe("answer");
  expect(toolCatalogs.at(-1)).toContain("evm_transfer");
  expect(await harness.respond({ ...message, eventId: "3" }, capabilities)).toBe("answer");
  expect(toolCatalogs.at(-1)).toEqual([...registered.keys()]);
  expect(created).toEqual(["gpt-6-luna"]);
  expect(switched.map((entry) => entry.model)).toEqual([
    { providerID: "openai", id: "gpt-6-luna", variant: "low" },
    { providerID: "openai", id: "gpt-6-luna", variant: "low" },
    { providerID: "openai", id: "gpt-6-sol", variant: "medium" },
  ]);
  expect(new Set(switched.map((entry) => entry.sessionID)).size).toBe(1);
  expect(prompts[0]).toContain("explanation-only");
  expect(prompts[0]).toContain("Verified completed transaction");
  expect(prompts[1]).not.toContain("explanation-only");
  expect(await harness.respond({ ...message, eventId: "safe-family", text: "Create a Safe" }, capabilities, { kind: "mixed", family: "wallet" })).toBe("answer");
  expect(toolCatalogs.at(-1)).toContain("safe_create");
  expect(toolCatalogs.at(-1)).toContain("safe_role_execute");
  expect(toolCatalogs.at(-1)).not.toContain("polymarket_search");
  expect(toolCatalogs.at(-1)).toContain("enable_all_tools");
  expect(await harness.respond({ ...message, eventId: "aave-family", text: "Supply to Aave" }, capabilities, { kind: "mixed", family: "defi" })).toBe("answer");
  expect(toolCatalogs.at(-1)).toContain("aave_call");
  expect(toolCatalogs.at(-1)).toContain("evm_read");
  expect(toolCatalogs.at(-1)).toContain("evm_inspect");
  expect(toolCatalogs.at(-1)).toContain("aero_stock_trades");
  expect(toolCatalogs.at(-1)).not.toContain("nansen_token_flows");
  expect(await harness.respond({ ...message, eventId: "after-family" }, capabilities)).toBe("answer");
  expect(toolCatalogs.at(-1)).toEqual([...registered.keys()]);

  // A Codex usage-limit 429 must not be retried with backoff, and later turns skip the provider until it resets.
  const request = new Request("https://chatgpt.com/backend-api/codex/responses", { headers: { "chatgpt-account-id": "acct" } });
  const openRouterRequest = new Request("https://openrouter.ai/api/v1/chat/completions");
  const limitBody = JSON.stringify({ error: { type: "usage_limit_reached", plan_type: "plus", resets_at: Math.floor(Date.now() / 1000) + 7200, message: "The usage limit has been reached" } });
  await hooks.get("http.response")!({ model: openai, request, response: new Response(limitBody, { status: 429, headers: { "content-type": "application/json" } }) });
  const decision = (delay: number): Decision => ({ retry: true, delay });
  const retry = { sessionID: "session", model: openai, attempt: 2, error: { type: "RateLimit", message: "The usage limit has been reached", status: 429 }, decision: decision(2000) };
  await hooks.get("retry")!(retry);
  expect(retry.decision).toEqual({ retry: false });
  const transient = { sessionID: "session", model: openai, attempt: 2, error: { type: "ProviderInternal", message: "server_error", status: 500 }, decision: decision(2000) };
  values.clear();
  await hooks.get("retry")!(transient);
  expect(transient.decision).toEqual({ retry: true, delay: 2000 });
  const third = { ...transient, attempt: 3, decision: decision(4000) };
  await hooks.get("retry")!(third);
  expect(third.decision).toEqual({ retry: false });
  await hooks.get("http.response")!({ model: openai, request, response: new Response(limitBody, { status: 429, headers: { "content-type": "application/json" } }) });
  const before = prompts.length;
  const limited = await harness.respond({ ...message, eventId: "4" }, capabilities).catch((error: Error) => error);
  expect(limited).toBeInstanceOf(Error);
  if (!(limited instanceof Error)) throw new Error("Expected usage-limit error");
  expect(limited.message).toContain("usage limit on your ChatGPT plus plan has been reached");
  expect(limited.message).toContain("in about 2 hours");
  expect(prompts.length).toBe(before);
  expect((await harness.inferenceStatus()).usageLimit?.kind).toBe("usage_limit_reached");
  await hooks.get("http.response")!({ model: openai, request, response: new Response("{}", { status: 200 }) });
  expect(await harness.respond({ ...message, eventId: "5" }, capabilities)).toBe("answer");
  expect((await harness.inferenceStatus()).usageLimit).toBeNull();

  // An operator OpenRouter key routes missing connections and spent plans to the fallback models.
  // SAFETY: the same SDK mock and disabled analytics use only get/put/delete on this fixture.
  const keyed = await OpenCodeHarness.create(storage as DurableObjectStorage, store, () => capabilities, undefined, "sk-or-test");
  expect(creates.at(-1)!.config?.providers?.openrouter?.settings?.apiKey).toBe("sk-or-test");
  expect(creates.at(-1)!.config?.providers?.openrouter?.settings?.provider).toEqual({ only: ["openai"] });
  expect(keyed.fallbackConfigured).toBe(true);
  await plugin!.setup(pluginContext);
  expect(await keyed.respond({ ...message, eventId: "6" }, capabilities, undefined, undefined, false)).toBe("answer");
  expect(switched.at(-1)!.model).toEqual(openrouter);
  expect(await keyed.respond({ ...message, eventId: "7" }, capabilities, "response", undefined, false)).toBe("answer");
  expect(toolCatalogs.at(-1)).toEqual(["ask_user"]);
  expect(switched.at(-1)!.model).toEqual(openrouterSmall);

  // A stored ChatGPT limit no longer refuses the turn when the fallback exists.
  await hooks.get("http.response")!({ model: openai, request, response: new Response(limitBody, { status: 429, headers: { "content-type": "application/json" } }) });
  const limitedBefore = prompts.length;
  expect(await keyed.respond({ ...message, eventId: "8" }, capabilities, undefined, undefined, true)).toBe("answer");
  expect(prompts.length).toBe(limitedBefore + 1);
  expect(switched.at(-1)!.model).toEqual(openrouter);

  // A provider failure mid-turn re-prompts the same text on the same session through OpenRouter.
  values.clear();
  contextQueue.push({ type: "assistant", time: { created: 2 }, content: [], error: { type: "provider.internal", message: "server_error", status: 500 } });
  const midBefore = prompts.length;
  const midSwitches = switched.length;
  expect(await keyed.respond({ ...message, eventId: "9" }, capabilities, undefined, undefined, true)).toBe("answer");
  expect(prompts.length).toBe(midBefore + 2);
  expect(prompts.at(-1)).toBe(prompts.at(-2));
  expect(switched.slice(midSwitches).map((entry) => entry.model)).toEqual([openai, openrouter]);

  contextQueue.push({ type: "assistant", time: { created: 2 }, content: [], error: { type: "provider.internal", message: "server_error", status: 500 } });
  const responseFallbackBefore = toolCatalogs.length;
  expect(await keyed.respond({ ...message, eventId: "response-fallback", text: "Explain Polymarket odds" }, capabilities, "response", undefined, true)).toBe("answer");
  expect(toolCatalogs.slice(responseFallbackBefore)).toEqual([["ask_user"], ["ask_user"]]);

  contextQueue.push({ type: "assistant", time: { created: 2 }, content: [], error: { type: "unknown", message: "explanation failed" } });
  await expect(keyed.respond({ ...message, eventId: "response-error" }, capabilities, "response", undefined, false)).rejects.toThrow("explanation failed");
  expect(await keyed.respond({ ...message, eventId: "tools-after-error" }, capabilities, "mixed", undefined, false)).toBe("answer");
  expect(toolCatalogs.at(-1)).toEqual([...registered.keys()]);

  // A non-provider error surfaces without a fallback retry.
  contextQueue.push({ type: "assistant", time: { created: 2 }, content: [], error: { type: "unknown", message: "boom" } });
  const boomBefore = prompts.length;
  await expect(keyed.respond({ ...message, eventId: "10" }, capabilities, undefined, undefined, true)).rejects.toThrow("boom");
  expect(prompts.length).toBe(boomBefore + 1);

  // OpenRouter responses never store or clear the user's ChatGPT limit, and its retries ignore one.
  await hooks.get("http.response")!({ model: openrouter, request: openRouterRequest, response: new Response(limitBody, { status: 429, headers: { "content-type": "application/json" } }) });
  expect(await storage.get("basedbot-usage-limit")).toBeUndefined();
  await hooks.get("http.response")!({ model: openai, request, response: new Response(limitBody, { status: 429, headers: { "content-type": "application/json" } }) });
  expect(await storage.get("basedbot-usage-limit")).toBeDefined();
  await hooks.get("http.response")!({ model: openrouter, request: openRouterRequest, response: new Response("{}", { status: 200 }) });
  expect(await storage.get("basedbot-usage-limit")).toBeDefined();
  const openRouterRetry = { sessionID: "session", model: openrouter, attempt: 2, error: { type: "RateLimit", message: "The usage limit has been reached", status: 429 }, decision: decision(2000) };
  await hooks.get("retry")!(openRouterRetry);
  expect(openRouterRetry.decision).toEqual({ retry: true, delay: 2000 });
  const openRouterThird = { ...openRouterRetry, attempt: 3, decision: decision(4000) };
  await hooks.get("retry")!(openRouterThird);
  expect(openRouterThird.decision).toEqual({ retry: false });

  // Without the key the connect and usage-limit replies are unchanged.
  await expect(harness.respond({ ...message, eventId: "11" }, capabilities, undefined, undefined, false)).rejects.toThrow("Connect your ChatGPT");
  const stillLimited = await harness.respond({ ...message, eventId: "12" }, capabilities, undefined, undefined, true).catch((error: Error) => error);
  expect(stillLimited).toBeInstanceOf(Error);
  if (!(stillLimited instanceof Error)) throw new Error("Expected usage-limit error");
  expect(stillLimited.message).toContain("usage limit on your ChatGPT plus plan has been reached");
  // The SDK wait/message path can finish before text.ended reaches the live subscription.
  // The stored answer is authoritative and must flush even deltas that have not arrived.
  streamGate = new Promise<void>((resolve) => { streamReady = resolve; });
  streamDone = new Promise<void>((resolve) => { streamObserved = resolve; });
  contextQueue.push({ id: "stream-answer", type: "assistant", time: { created: 2 }, content: [{ type: "text", text: "First paragraph.\n\nLast paragraph." }] });
  const streamed: string[] = [];
  expect(await keyed.respond({ ...message, eventId: "stream-final" }, capabilities, "response", (text) => { streamed.push(text); }, false)).toBe("First paragraph.\n\nLast paragraph.");
  expect(streamed).toEqual(["First paragraph.", "Last paragraph."]);
  contextQueue.push({ id: "stream-answer", type: "assistant", time: { created: 2 }, content: [{ type: "text", text: "First paragraph.\n\nLast paragraph." }] });
  const live: string[] = [];
  const liveSink = Object.assign((text: string) => { live.push(text); }, { live: true });
  await keyed.respond({ ...message, eventId: "stream-live" }, capabilities, "response", liveSink, false);
  expect(live).toEqual(["First paragraph.\n\nLast para", "First paragraph.\n\nLast paragraph."]);

  directPreview = true;
  const direct: string[] = [];
  const countBeforeDirect = prompts.length;
  expect(await keyed.respond({ ...message, eventId: "direct-preview" }, capabilities, undefined, value => direct.push(value), false)).toBe("Verified preview. /confirm ABC123");
  expect(direct).toEqual(["Verified preview. /confirm ABC123"]);
  expect(interrupts).toBe(1);
  expect(prompts.length).toBe(countBeforeDirect + 1);

  console.log("Luna selection, retained session, Sol fallback, response instructions, usage-limit short-circuit, OpenRouter fallback passed");
} finally { store.close(); }
