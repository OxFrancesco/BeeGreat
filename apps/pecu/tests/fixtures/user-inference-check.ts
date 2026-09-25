import { unusedCapabilities } from "./agent-services";
import type { AgentCapabilities, ResponseMode } from "../../src/harness";
import type { OpenCodeHarness, OAuthStart } from "../../src/cloudflare/opencode";
import type { VerifiedMessage } from "../../src/domain";
import { mock, expect } from "bun:test";

class Memory {
  values = new Map<string, unknown>();
  // SAFETY: this in-memory adapter implements the same caller-selected generic contract as DurableObjectStorage.get.
  async get<T>(key: string) {
    // SAFETY: the test mirrors DurableObjectStorage’s caller-selected value type for each key.
    return this.values.get(key) as T | undefined;
  }
  async put<T>(key: string, value: T) { this.values.set(key, value); }
  async delete(key: string) { return this.values.delete(key); }
}
import { UsageLimitError } from "../../src/usage-limit";
const states = new Map<Memory, { connected: boolean; starts: number; calls: number; failDisconnect: boolean; loginStatusError?: Error; hold?: Promise<void>; complete: boolean; usageLimit?: boolean; lastChatGpt?: boolean; lastStreamed?: boolean }>();
mock.module("cloudflare:workers", () => ({
  RpcTarget: class {},
  DurableObject: class { constructor(public ctx: DurableObjectState, public env: Cloudflare.Env) {} },
}));
mock.module("../../src/cloudflare/durable-store", () => ({ DurableStore: class { initialize() {} } }));
mock.module("../../src/cloudflare/codex-fetch", () => ({ codexContainerFetch() {} }));
mock.module("../../src/cloudflare/opencode", () => ({ OpenCodeHarness: { async create(storage: Memory, _store: Parameters<typeof OpenCodeHarness.create>[1], _resolve: Parameters<typeof OpenCodeHarness.create>[2], _fetch: Parameters<typeof OpenCodeHarness.create>[3], openRouterApiKey?: string) {
  const state = states.get(storage) ?? { connected: false, starts: 0, calls: 0, failDisconnect: false, complete: false };
  states.set(storage, state);
  const fallbackConfigured = Boolean(openRouterApiKey);
  return {
    fallbackConfigured,
    async authStatus() { return { connected: state.connected }; },
    async inferenceStatus() { return { model: "test", reasoning: "medium", connected: state.connected, checkedAt: Date.now(), lastResponse: null, usageLimit: state.usageLimit ? { kind: "usage_limit_reached", resetsAt: null } : null }; },
    async beginChatGptLogin() { state.starts++; state.complete = false; return { attemptId: "test", url: "https://auth.openai.com/codex/device", instructions: "Test code", expiresAt: Date.now() + 600000 }; },
    async chatGptLoginStatus() { if (state.loginStatusError) throw state.loginStatusError; if (state.complete) state.connected = true; return { data: { status: state.complete ? "complete" : "pending" } }; },
    async cancelChatGptLogin() { state.complete = false; },
    async disconnectChatGpt() { if (state.failDisconnect) throw new Error("offline"); state.connected = false; },
    async respond(_message: VerifiedMessage, capabilities: AgentCapabilities, _mode?: ResponseMode, progress?: (paragraph: string) => void, chatGpt = true) {
      state.calls++;
      state.lastChatGpt = chatGpt;
      state.lastStreamed = progress !== undefined;
      if (state.usageLimit && !fallbackConfigured) throw new UsageLimitError({ kind: "usage_limit_reached", planType: "plus", resetsAt: Date.now() + 3_600_000, observedAt: Date.now() });
      if (state.hold) await state.hold;
      progress?.("First paragraph.");
      return _message.text === "Polymarket freshness" ? capabilities.polymarketRead("status", {}) : capabilities.walletAddress();
    },
  };
} } }));
const { UserInference, userInference, InferenceTools } = await import("../../src/cloudflare/user-inference");
const make = (storage = new Memory(), env: Partial<Cloudflare.Env> & { OPENROUTER_API_KEY?: string } = {}) => {
  const storagePort: Pick<Memory, "get" | "put" | "delete"> = storage;
  // SAFETY: the SDK and DurableStore are replaced above; only these get, put and delete storage operations are reachable.
  const ctx = { storage: storagePort as DurableObjectStorage, blockConcurrencyWhile: <T>(fn: () => Promise<T>) => fn() };
  // SAFETY: DurableObject, DurableStore and the harness are mocked above. The constructor only uses storage and blockConcurrencyWhile; config accepts the supplied string bindings.
  return { storage, instance: new UserInference(ctx as DurableObjectState, env as Cloudflare.Env) };
};
const a = make(); const b = make();
await a.instance.status(); await b.instance.status();
const message = { eventId: "event", senderId: "1", conversationId: "chat", text: "balance", encodedEvent: "verified" };
const tools = new InferenceTools({ ...unusedCapabilities, walletAddress: async () => "wallet-a" });
expect(await a.instance.respond(message, false, tools)).toContain("Connect your ChatGPT");
expect(states.get(a.storage)!.calls).toBe(0);
await a.instance.startLogin(); await a.instance.startLogin();
expect(states.get(a.storage)!.starts).toBe(1);
expect((await b.instance.status()).login).toBeNull();
states.get(a.storage)!.complete = true;
expect((await a.instance.status()).connected).toBe(true);
expect((await b.instance.status()).connected).toBe(false);
expect(await a.instance.respond(message, false, tools)).toBe("wallet-a");
// Without a sink the harness is told not to stream; with one, paragraphs arrive through the RPC bridge before the reply.
expect(states.get(a.storage)!.lastStreamed).toBe(false);
const paragraphs: string[] = [];
const streamingTools = new InferenceTools({ ...unusedCapabilities, walletAddress: async () => "wallet-a" }, undefined, (text) => paragraphs.push(text));
expect(await a.instance.respond(message, false, streamingTools)).toBe("wallet-a");
expect(states.get(a.storage)!.lastStreamed).toBe(true);
await new Promise((resolve) => setTimeout(resolve, 0));
expect(paragraphs).toEqual(["First paragraph."]);
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
const oldLogin = await expired.storage.get<OAuthStart>("login");
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
// SAFETY: userInference only forwards idFromName/get; the sentinel strings test namespace isolation without invoking an RPC method.
const env = { INFERENCE: { idFromName(name: string) { names.push(name); return name; }, get(id: string) { return id; } } } as never;
expect(userInference(env, "123")).toBe(userInference(env, "123"));
expect(userInference(env, "456")).not.toBe(userInference(env, "123"));
// SAFETY: deliberately bypass the static allowlist to verify the RPC runtime rejects an untrusted method name.
await expect(tools.call("constructor" as "walletAddress", [])).rejects.toThrow("Tool unavailable");
const explanationTools = new InferenceTools({
  ...unusedCapabilities,
  walletAddress: async () => { throw new Error("wallet must not run"); },
  askUser: async () => "Which account?",
}, "response");
await expect(explanationTools.call("walletAddress", [])).rejects.toThrow("explanation-only");
await expect(explanationTools.call("evmPropose", ["contract_call", {}])).rejects.toThrow("explanation-only");
expect(await explanationTools.call("askUser", ["Which account?"])).toBe("Which account?");
// With OPENROUTER_API_KEY a missing connection, an active limit, and a disconnect all still answer.
const keyed = make(new Memory(), { OPENROUTER_API_KEY: "sk-or-test" });
expect(await keyed.instance.respond(message, false, tools)).toBe("wallet-a");
expect(states.get(keyed.storage)!.lastChatGpt).toBe(false);
expect((await keyed.instance.status()).fallback).toEqual({ configured: true, active: true });
await keyed.instance.startLogin();
states.get(keyed.storage)!.complete = true;
expect((await keyed.instance.status()).connected).toBe(true);
expect((await keyed.instance.status()).fallback).toEqual({ configured: true, active: false });
expect(await keyed.instance.respond(message, false, tools)).toBe("wallet-a");
expect(states.get(keyed.storage)!.lastChatGpt).toBe(true);
states.get(keyed.storage)!.usageLimit = true;
expect((await keyed.instance.status()).fallback).toEqual({ configured: true, active: true });
await keyed.instance.disconnect();
expect(await keyed.instance.respond(message, false, tools)).toBe("wallet-a");
expect(states.get(keyed.storage)!.lastChatGpt).toBe(false);
expect((await a.instance.status()).fallback).toEqual({ configured: false, active: false });
const polymarketTools = new InferenceTools({ ...unusedCapabilities, polymarketRead: async (endpoint, input) => JSON.stringify({ endpoint, input }) });
const polymarketMessage = { eventId: "polymarket", senderId: "1", conversationId: "chat", text: "Polymarket freshness", encodedEvent: "verified" };
expect(await keyed.instance.respond(polymarketMessage, false, polymarketTools)).toBe('{"endpoint":"status","input":{}}');
expect(states.get(keyed.storage)!.lastChatGpt).toBe(false);
states.get(keyed.storage)!.connected = true;
states.get(keyed.storage)!.usageLimit = false;
await keyed.storage.delete("disconnected");
expect(await keyed.instance.respond(polymarketMessage, false, polymarketTools)).toBe('{"endpoint":"status","input":{}}');
expect(states.get(keyed.storage)!.lastChatGpt).toBe(true);
await expect(explanationTools.call("polymarketRead", ["status", {}])).rejects.toThrow("explanation-only");
console.log("isolation, OpenRouter fallback, OAuth reuse, disconnect, failure recovery, restart, turn locks, RPC allowlist passed");
