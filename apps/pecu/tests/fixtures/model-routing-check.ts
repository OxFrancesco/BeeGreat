import { expect, mock } from "bun:test";
import { Store } from "../../src/store";

const created: string[] = [];
const switched: { sessionID: string; model: { providerID: string; id: string; variant: string } }[] = [];
const prompts: string[] = [];
const contextQueue: Record<string, unknown>[] = [];
const answer = { type: "assistant", time: { created: 2 }, content: [{ type: "text", text: "answer" }] };
const client = {
  sessions: {
    get: async () => ({ id: "session" }),
    create: async (input: { model: { id: string } }) => { created.push(input.model.id); return { id: "session" }; },
    switchModel: async (input: (typeof switched)[number]) => { switched.push(input); },
    prompt: async (input: { text: string }) => { prompts.push(input.text); return { timeCreated: 1 }; },
    wait: async () => {},
    context: async () => [contextQueue.length ? contextQueue.shift() : answer],
  },
  integration: { list: async () => ({ data: [{ id: "openai", connections: [{ type: "credential", id: "cred" }], methods: [] }] }) },
};
type Hook = (event: Record<string, unknown>) => Promise<void>;
const hooks = new Map<string, Hook>();
const registered = new Map<string, {execute(input: unknown, context: {sessionID:string}): Promise<unknown>}>();
type CreateOptions = { config?: { providers?: Record<string, { settings?: Record<string, unknown> }> }; plugins: { setup(context: unknown): Promise<void> }[] };
const creates: CreateOptions[] = [];
let plugin: CreateOptions["plugins"][number] | undefined;
mock.module("@opencode-ai/sdk/workerd", () => ({ OpenCodeWorkerd: { create: async (options: CreateOptions) => { creates.push(options); plugin = options.plugins[0]; return client; } } }));
mock.module("@opencode-ai/plugin", () => ({ Plugin: { define: (value: unknown) => value } }));
const { OpenCodeHarness } = await import("../../src/cloudflare/opencode");
const store = new Store(":memory:");
const values = new Map<string, unknown>();
const storage = { get: async (key: string) => values.get(key), put: async (key: string, value: unknown) => { values.set(key, value); }, delete: async (key: string) => values.delete(key) };
const openai = { providerID: "openai", id: "gpt-6-sol", variant: "medium" };
const openrouter = { providerID: "openrouter", id: "openai/gpt-6-sol", variant: "medium" };
const openrouterSmall = { providerID: "openrouter", id: "openai/gpt-6-luna", variant: "low" };
const pluginContext = {
  session: { hook: async (name: string, fn: Hook) => { hooks.set(name, fn); } },
  tool: { hook: async (name: string, fn: Hook) => { hooks.set(name, fn); }, transform: async (fn: (draft: unknown) => void) => fn({ list: () => [], remove() {}, add(tool: {name:string;execute(input: unknown, context:{sessionID:string}):Promise<unknown>}) {registered.set(tool.name,tool);} }) },
  agent: { transform: async (fn: (draft: unknown) => void) => fn({ default() {}, list: () => [] }) },
};
try {
  const capabilities = { yoloEnabled: () => false } as never;
  let bound = true;
  const harness = await OpenCodeHarness.create(storage as never, store, () => { if (!bound) throw new Error("Turn is no longer bound"); return capabilities; });
  expect(creates.at(-1)!.config?.providers?.openrouter).toBeUndefined();
  expect(harness.fallbackConfigured).toBe(false);
  await plugin!.setup(pluginContext);
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

  expect(await harness.respond(message, capabilities, "response")).toBe("answer");
  expect(await harness.respond({ ...message, eventId: "2" }, capabilities, "mixed")).toBe("answer");
  expect(await harness.respond({ ...message, eventId: "3" }, capabilities)).toBe("answer");
  expect(created).toEqual(["gpt-6-luna"]);
  expect(switched.map((entry) => entry.model)).toEqual([
    { providerID: "openai", id: "gpt-6-luna", variant: "low" },
    { providerID: "openai", id: "gpt-6-luna", variant: "low" },
    { providerID: "openai", id: "gpt-6-sol", variant: "medium" },
  ]);
  expect(new Set(switched.map((entry) => entry.sessionID)).size).toBe(1);
  expect(prompts[0]).toContain("explanation-only");
  expect(prompts[1]).not.toContain("explanation-only");

  // A Codex usage-limit 429 must not be retried with backoff, and later turns skip the provider until it resets.
  const request = new Request("https://chatgpt.com/backend-api/codex/responses", { headers: { "chatgpt-account-id": "acct" } });
  const openRouterRequest = new Request("https://openrouter.ai/api/v1/chat/completions");
  const limitBody = JSON.stringify({ error: { type: "usage_limit_reached", plan_type: "plus", resets_at: Math.floor(Date.now() / 1000) + 7200, message: "The usage limit has been reached" } });
  await hooks.get("http.response")!({ model: openai, request, response: new Response(limitBody, { status: 429, headers: { "content-type": "application/json" } }) });
  type Decision = { retry: false } | { retry: true; delay: number };
  const retry = { sessionID: "session", model: openai, attempt: 2, error: { type: "RateLimit", message: "The usage limit has been reached", status: 429 }, decision: { retry: true, delay: 2000 } as Decision };
  await hooks.get("retry")!(retry);
  expect(retry.decision).toEqual({ retry: false });
  const transient = { sessionID: "session", model: openai, attempt: 2, error: { type: "ProviderInternal", message: "server_error", status: 500 }, decision: { retry: true, delay: 2000 } as Decision };
  values.clear();
  await hooks.get("retry")!(transient);
  expect(transient.decision).toEqual({ retry: true, delay: 2000 });
  const third = { ...transient, attempt: 3, decision: { retry: true, delay: 4000 } as Decision };
  await hooks.get("retry")!(third);
  expect(third.decision).toEqual({ retry: false });
  await hooks.get("http.response")!({ model: openai, request, response: new Response(limitBody, { status: 429, headers: { "content-type": "application/json" } }) });
  const before = prompts.length;
  const limited = await harness.respond({ ...message, eventId: "4" }, capabilities).catch((error: Error) => error);
  expect(limited).toBeInstanceOf(Error);
  expect((limited as Error).message).toContain("usage limit on your ChatGPT plus plan has been reached");
  expect((limited as Error).message).toContain("in about 2 hours");
  expect(prompts.length).toBe(before);
  expect((await harness.inferenceStatus()).usageLimit?.kind).toBe("usage_limit_reached");
  await hooks.get("http.response")!({ model: openai, request, response: new Response("{}", { status: 200 }) });
  expect(await harness.respond({ ...message, eventId: "5" }, capabilities)).toBe("answer");
  expect((await harness.inferenceStatus()).usageLimit).toBeNull();

  // An operator OpenRouter key routes missing connections and spent plans to the fallback models.
  const keyed = await OpenCodeHarness.create(storage as never, store, () => capabilities, undefined, "sk-or-test");
  expect(creates.at(-1)!.config?.providers?.openrouter?.settings?.apiKey).toBe("sk-or-test");
  expect(creates.at(-1)!.config?.providers?.openrouter?.settings?.provider).toEqual({ only: ["openai"] });
  expect(keyed.fallbackConfigured).toBe(true);
  await plugin!.setup(pluginContext);
  expect(await keyed.respond({ ...message, eventId: "6" }, capabilities, undefined, undefined, false)).toBe("answer");
  expect(switched.at(-1)!.model).toEqual(openrouter);
  expect(await keyed.respond({ ...message, eventId: "7" }, capabilities, "response", undefined, false)).toBe("answer");
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
  const openRouterRetry = { sessionID: "session", model: openrouter, attempt: 2, error: { type: "RateLimit", message: "The usage limit has been reached", status: 429 }, decision: { retry: true, delay: 2000 } as Decision };
  await hooks.get("retry")!(openRouterRetry);
  expect(openRouterRetry.decision).toEqual({ retry: true, delay: 2000 });
  const openRouterThird = { ...openRouterRetry, attempt: 3, decision: { retry: true, delay: 4000 } as Decision };
  await hooks.get("retry")!(openRouterThird);
  expect(openRouterThird.decision).toEqual({ retry: false });

  // Without the key the connect and usage-limit replies are unchanged.
  await expect(harness.respond({ ...message, eventId: "11" }, capabilities, undefined, undefined, false)).rejects.toThrow("Connect your ChatGPT");
  const stillLimited = await harness.respond({ ...message, eventId: "12" }, capabilities, undefined, undefined, true).catch((error: Error) => error);
  expect(stillLimited).toBeInstanceOf(Error);
  expect((stillLimited as Error).message).toContain("usage limit on your ChatGPT plus plan has been reached");
  console.log("Luna selection, retained session, Sol fallback, response instructions, usage-limit short-circuit, OpenRouter fallback passed");
} finally { store.close(); }
