import { mock, expect } from "bun:test";

class Memory {
  values = new Map<string, unknown>();
  async get<T>(key: string) { return this.values.get(key) as T | undefined; }
  async put(key: string, value: unknown) { this.values.set(key, value); }
  async delete(key: string) { return this.values.delete(key); }
}
import { UsageLimitError } from "../../src/usage-limit";
const states = new Map<Memory, { connected: boolean; starts: number; calls: number; failDisconnect: boolean; loginStatusError?: Error; hold?: Promise<void>; complete: boolean; usageLimit?: boolean }>();
mock.module("cloudflare:workers", () => ({
  RpcTarget: class {},
  DurableObject: class { constructor(public ctx: unknown, public env: unknown) {} },
}));
mock.module("../../src/cloudflare/durable-store", () => ({ DurableStore: class { initialize() {} } }));
mock.module("../../src/cloudflare/codex-fetch", () => ({ codexContainerFetch() {} }));
mock.module("../../src/cloudflare/opencode", () => ({ OpenCodeHarness: { async create(storage: Memory) {
  const state = states.get(storage) ?? { connected: false, starts: 0, calls: 0, failDisconnect: false, complete: false };
  states.set(storage, state);
  return {
    async authStatus() { return { connected: state.connected }; },
    async inferenceStatus() { return { model: "test", reasoning: "medium", connected: state.connected, checkedAt: Date.now(), lastResponse: null }; },
    async beginChatGptLogin() { state.starts++; state.complete = false; return { attemptId: "test", url: "https://auth.openai.com/codex/device", instructions: "Test code", expiresAt: Date.now() + 600000 }; },
    async chatGptLoginStatus() { if (state.loginStatusError) throw state.loginStatusError; if (state.complete) state.connected = true; return { data: { status: state.complete ? "complete" : "pending" } }; },
    async cancelChatGptLogin() { state.complete = false; },
    async disconnectChatGpt() { if (state.failDisconnect) throw new Error("offline"); state.connected = false; },
    async respond(_message: unknown, capabilities: { walletAddress(): Promise<string> }) {
      state.calls++;
      if (state.usageLimit) throw new UsageLimitError({ kind: "usage_limit_reached", planType: "plus", resetsAt: Date.now() + 3_600_000, observedAt: Date.now() });
      if (state.hold) await state.hold;
      return capabilities.walletAddress();
    },
  };
} } }));
const { UserInference, userInference, InferenceTools } = await import("../../src/cloudflare/user-inference");
const make = (storage = new Memory()) => {
  const ctx = { storage, blockConcurrencyWhile: (fn: () => Promise<void>) => fn() };
  return { storage, instance: new UserInference(ctx as never, {} as never) };
};
const a = make(); const b = make();
await a.instance.status(); await b.instance.status();
const message = { eventId: "event", senderId: "1", conversationId: "chat", text: "balance" } as never;
const tools = new InferenceTools({ walletAddress: async () => "wallet-a" } as never);
expect(await a.instance.respond(message, false, tools)).toContain("Connect your ChatGPT");
expect(states.get(a.storage)!.calls).toBe(0);
await a.instance.startLogin(); await a.instance.startLogin();
expect(states.get(a.storage)!.starts).toBe(1);
expect((await b.instance.status()).login).toBeNull();
states.get(a.storage)!.complete = true;
expect((await a.instance.status()).connected).toBe(true);
expect((await b.instance.status()).connected).toBe(false);
expect(await a.instance.respond(message, false, tools)).toBe("wallet-a");
expect(await b.instance.respond(message, false, tools)).toContain("Connect your ChatGPT");
let release!: () => void;
states.get(a.storage)!.hold = new Promise<void>((resolve) => { release = resolve; });
const active = a.instance.respond(message, false, tools);
await new Promise((resolve) => setTimeout(resolve, 0));
await expect(a.instance.disconnect()).rejects.toThrow("Wait");
await expect(a.instance.respond(message, false, tools)).rejects.toThrow("previous request");
release(); await active; states.get(a.storage)!.hold = undefined;
states.get(a.storage)!.usageLimit = true;
const limited = await a.instance.respond(message, false, tools);
expect(limited).toContain("usage limit on your ChatGPT plus plan has been reached");
expect(limited).toContain("Wallet commands");
expect(limited).not.toContain("Could not process");
states.get(a.storage)!.usageLimit = false;
states.get(a.storage)!.failDisconnect = true;
await expect(a.instance.disconnect()).rejects.toThrow("offline");
expect((await a.instance.status()).connected).toBe(false);
expect(await a.instance.respond(message, false, tools)).toContain("Connect your ChatGPT");
states.get(a.storage)!.failDisconnect = false;
await a.instance.disconnect();
await a.instance.startLogin();
expect(states.get(a.storage)!.starts).toBe(2);
const restarted = make(a.storage);
expect((await restarted.instance.status()).loginState).toBe("expired");
expect((await restarted.instance.status()).login).toBeNull();
const expired = make();
await expired.instance.startLogin();
const oldLogin = await expired.storage.get<Record<string, unknown>>("login");
await expired.storage.put("login", { ...oldLogin, expiresAt: Date.now() - 900000 });
states.get(expired.storage)!.loginStatusError = new Error("UnexpectedStatus", { cause: { status: 500 } });
const recovered = await expired.instance.status();
expect(recovered.login).toBeNull();
expect(recovered.loginState).toBe("expired");
expect(recovered.connected).toBe(false);
states.get(expired.storage)!.loginStatusError = undefined;
await expired.instance.startLogin();
expect(states.get(expired.storage)!.starts).toBe(2);
states.get(expired.storage)!.loginStatusError = new Error("temporary service failure");
await expect(expired.instance.status()).rejects.toThrow("temporary service failure");
expect(await expired.storage.get("login")).toBeDefined();
states.get(expired.storage)!.connected = true;
await expired.storage.put("login", { ...oldLogin, expiresAt: Date.now() - 1 });
expect((await expired.instance.status()).connected).toBe(true);
const names: string[] = [];
const env = { INFERENCE: { idFromName(name: string) { names.push(name); return name; }, get(id: string) { return id; } } } as never;
expect(userInference(env, "123")).toBe(userInference(env, "123"));
expect(userInference(env, "456")).not.toBe(userInference(env, "123"));
await expect(tools.call("constructor" as never, [])).rejects.toThrow("Tool unavailable");
const explanationTools = new InferenceTools({
  walletAddress: async () => { throw new Error("wallet must not run"); },
  askUser: async () => "Which account?",
} as never, "response");
await expect(explanationTools.call("walletAddress", [])).rejects.toThrow("explanation-only");
await expect(explanationTools.call("evmPropose", [])).rejects.toThrow("explanation-only");
expect(await explanationTools.call("askUser", ["Which account?"])).toBe("Which account?");
console.log("isolation, no fallback, OAuth reuse, disconnect, failure recovery, restart, turn locks, RPC allowlist passed");
