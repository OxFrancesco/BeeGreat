import { expect, mock } from "bun:test";
import { Store } from "../../src/store";

const created: string[] = [];
const switched: { sessionID: string; model: { providerID: string; id: string; variant: string } }[] = [];
const prompts: string[] = [];
const client = {
  sessions: {
    get: async () => ({ id: "session" }),
    create: async (input: { model: { id: string } }) => { created.push(input.model.id); return { id: "session" }; },
    switchModel: async (input: (typeof switched)[number]) => { switched.push(input); },
    prompt: async (input: { text: string }) => { prompts.push(input.text); return { timeCreated: 1 }; },
    wait: async () => {},
    context: async () => [{ type: "assistant", time: { created: 2 }, content: [{ type: "text", text: "answer" }] }],
  },
  integration: { list: async () => ({ data: [{ id: "openai", connections: [{ type: "credential", id: "cred" }], methods: [] }] }) },
};
type Hook = (event: Record<string, unknown>) => Promise<void>;
const hooks = new Map<string, Hook>();
let plugin: { setup(context: unknown): Promise<void> } | undefined;
mock.module("@opencode-ai/sdk/workerd", () => ({ OpenCodeWorkerd: { create: async (options: { plugins: (typeof plugin)[] }) => { plugin = options.plugins[0]; return client; } } }));
mock.module("@opencode-ai/plugin", () => ({ Plugin: { define: (value: unknown) => value } }));
const { OpenCodeHarness } = await import("../../src/cloudflare/opencode");
const store = new Store(":memory:");
const values = new Map<string, unknown>();
const storage = { get: async (key: string) => values.get(key), put: async (key: string, value: unknown) => { values.set(key, value); }, delete: async (key: string) => values.delete(key) };
try {
  const capabilities = { yoloEnabled: () => false } as never;
  const harness = await OpenCodeHarness.create(storage as never, store, () => capabilities);
  await plugin!.setup({
    session: { hook: async (name: string, fn: Hook) => { hooks.set(name, fn); } },
    tool: { transform: async (fn: (draft: unknown) => void) => fn({ list: () => [], remove() {}, add() {} }) },
    agent: { transform: async (fn: (draft: unknown) => void) => fn({ default() {}, list: () => [] }) },
  });
  const message = { eventId: "1", senderId: "sender", conversationId: "chat", text: "Explain slippage", encodedEvent: "verified" };
  expect(await harness.respond(message, capabilities, "response")).toBe("answer");
  expect(await harness.respond({ ...message, eventId: "2" }, capabilities, "mixed")).toBe("answer");
  expect(await harness.respond({ ...message, eventId: "3" }, capabilities)).toBe("answer");
  expect(created).toEqual(["gpt-5.6-luna"]);
  expect(switched.map((entry) => entry.model)).toEqual([
    { providerID: "openai", id: "gpt-5.6-luna", variant: "low" },
    { providerID: "openai", id: "gpt-5.6-luna", variant: "low" },
    { providerID: "openai", id: "gpt-5.6-sol", variant: "medium" },
  ]);
  expect(new Set(switched.map((entry) => entry.sessionID)).size).toBe(1);
  expect(prompts[0]).toContain("explanation-only");
  expect(prompts[1]).not.toContain("explanation-only");

  // A Codex usage-limit 429 must not be retried with backoff, and later turns skip the provider until it resets.
  const request = new Request("https://chatgpt.com/backend-api/codex/responses", { headers: { "chatgpt-account-id": "acct" } });
  const limitBody = JSON.stringify({ error: { type: "usage_limit_reached", plan_type: "plus", resets_at: Math.floor(Date.now() / 1000) + 7200, message: "The usage limit has been reached" } });
  await hooks.get("http.response")!({ request, response: new Response(limitBody, { status: 429, headers: { "content-type": "application/json" } }) });
  type Decision = { retry: false } | { retry: true; delay: number };
  const retry = { sessionID: "session", attempt: 2, error: { type: "RateLimit", message: "The usage limit has been reached", status: 429 }, decision: { retry: true, delay: 2000 } as Decision };
  await hooks.get("retry")!(retry);
  expect(retry.decision).toEqual({ retry: false });
  const transient = { sessionID: "session", attempt: 2, error: { type: "ProviderInternal", message: "server_error", status: 500 }, decision: { retry: true, delay: 2000 } as Decision };
  values.clear();
  await hooks.get("retry")!(transient);
  expect(transient.decision).toEqual({ retry: true, delay: 2000 });
  const third = { ...transient, attempt: 3, decision: { retry: true, delay: 4000 } as Decision };
  await hooks.get("retry")!(third);
  expect(third.decision).toEqual({ retry: false });
  await hooks.get("http.response")!({ request, response: new Response(limitBody, { status: 429, headers: { "content-type": "application/json" } }) });
  const before = prompts.length;
  const limited = await harness.respond({ ...message, eventId: "4" }, capabilities).catch((error: Error) => error);
  expect(limited).toBeInstanceOf(Error);
  expect((limited as Error).message).toContain("usage limit on your ChatGPT plus plan has been reached");
  expect((limited as Error).message).toContain("in about 2 hours");
  expect(prompts.length).toBe(before);
  expect((await harness.inferenceStatus()).usageLimit?.kind).toBe("usage_limit_reached");
  await hooks.get("http.response")!({ request, response: new Response("{}", { status: 200 }) });
  expect(await harness.respond({ ...message, eventId: "5" }, capabilities)).toBe("answer");
  expect((await harness.inferenceStatus()).usageLimit).toBeNull();
  console.log("Luna selection, retained session, Sol fallback, response instructions, usage-limit short-circuit passed");
} finally { store.close(); }
