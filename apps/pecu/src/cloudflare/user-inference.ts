import { chatGptConnectionRequired } from "../inference-recovery";
import { DurableObject, RpcTarget } from "cloudflare:workers";
import type { AgentCapabilities } from "../harness";
import type { VerifiedMessage } from "../domain";
import { DurableStore } from "./durable-store";
import { OpenCodeHarness, type OAuthStart } from "./opencode";
import { codexContainerFetch } from "./codex-fetch";

type Capability = Exclude<keyof AgentCapabilities, "yoloEnabled">;
const allowed = new Set<string>(["askUser", "aaveCall", "polymarketResearch", "walletAddress", "walletBalances", "aeroRead", "aeroPropose", "evmToken", "evmAllowance", "evmRead", "evmInspect", "evmDecode", "evmPropose", "depositInstructions", "depositSetup", "depositStatus", "nansenCall"]);

export class InferenceTools extends RpcTarget {
  constructor(private readonly capabilities: AgentCapabilities) { super(); }
  async call(name: Capability, args: unknown[]): Promise<string> {
    if (!allowed.has(name)) throw new Error("Tool unavailable");
    const invoke = this.capabilities[name] as (...args: unknown[]) => Promise<string>;
    return invoke(...args);
  }
}

export function userInference(env: Cloudflare.Env, senderId: string) {
  return env.INFERENCE.get(env.INFERENCE.idFromName(`x:${senderId}`));
}

export class UserInference extends DurableObject<Cloudflare.Env> {
  private readonly ready: Promise<void>;
  private harness!: OpenCodeHarness;
  private active?: { eventId: string; capabilities: AgentCapabilities };
  private changing = false;

  constructor(ctx: DurableObjectState, env: Cloudflare.Env) {
    super(ctx, env);
    this.ready = ctx.blockConcurrencyWhile(async () => {
      if (await ctx.storage.get("login")) {
        await ctx.storage.delete("login");
        await ctx.storage.put("loginState", "expired");
      }
      const store = new DurableStore(ctx.storage);
      this.harness = await OpenCodeHarness.create(ctx.storage, store, (message) => {
        if (!this.active || this.active.eventId !== message.eventId) throw new Error("This turn has ended. Send your request again.");
        return this.active.capabilities;
      }, codexContainerFetch(env.CODEX));
      store.initialize();
    });
  }

  async status() {
    await this.ready;
    const pending = await this.ctx.storage.get<OAuthStart>("login");
    if (pending) {
      // OpenCode removes expired attempts from memory. Do not poll an expired
      // attempt retained in durable storage: its status endpoint then returns 500.
      const loginState = Number(pending.expiresAt) <= Date.now()
        ? "expired"
        : (await this.harness.chatGptLoginStatus(pending.attemptId)).data.status;
      if (loginState !== "pending") {
        await this.ctx.storage.delete("login");
        await this.ctx.storage.put("loginState", loginState);
      }
    }
    const status = await this.harness.inferenceStatus();
    return { ...status, connected: status.connected && !await this.ctx.storage.get<boolean>("disconnected"), login: await this.ctx.storage.get<OAuthStart>("login") ?? null, loginState: await this.ctx.storage.get<string>("loginState") ?? null };
  }

  async startLogin() {
    await this.ready;
    if (this.active || this.changing) throw new Error("Wait for the current request to finish.");
    this.changing = true;
    try {
      if (await this.ctx.storage.get<boolean>("disconnected")) {
        const pending = await this.ctx.storage.get<OAuthStart>("login");
        if (pending) await this.harness.cancelChatGptLogin(pending.attemptId);
        await this.harness.disconnectChatGpt();
        await this.ctx.storage.delete("login");
        await this.ctx.storage.delete("disconnected");
      }
      const status = await this.status();
      if (status.connected) return status;
      if (!status.login) {
        await this.ctx.storage.put("login", await this.harness.beginChatGptLogin());
        await this.ctx.storage.put("loginState", "pending");
      }
      return await this.status();
    } finally { this.changing = false; }
  }

  async disconnect() {
    await this.ready;
    if (this.active || this.changing) throw new Error("Wait for the current request to finish.");
    this.changing = true;
    try {
      await this.ctx.storage.put("disconnected", true);
      const pending = await this.ctx.storage.get<OAuthStart>("login");
      if (pending) await this.harness.cancelChatGptLogin(pending.attemptId);
      await this.harness.disconnectChatGpt();
      await this.ctx.storage.delete("login");
      await this.ctx.storage.delete("loginState");
      return await this.status();
    } finally { this.changing = false; }
  }

  async respond(message: VerifiedMessage, yolo: boolean, bridge: InferenceTools) {
    await this.ready;
    if (this.active || this.changing) throw new Error("Pecu is finishing your previous request. Try again shortly.");
    const capabilities: AgentCapabilities = {
      yoloEnabled: () => yolo,
      askUser: (...args) => bridge.call("askUser", args),
      aaveCall: (...args) => bridge.call("aaveCall", args),
      polymarketResearch: (...args) => bridge.call("polymarketResearch", args),
      walletAddress: (...args) => bridge.call("walletAddress", args),
      walletBalances: (...args) => bridge.call("walletBalances", args),
      aeroRead: (...args) => bridge.call("aeroRead", args),
      aeroPropose: (...args) => bridge.call("aeroPropose", args),
      evmToken: (...args) => bridge.call("evmToken", args),
      evmAllowance: (...args) => bridge.call("evmAllowance", args),
      evmRead: (...args) => bridge.call("evmRead", args),
      evmInspect: (...args) => bridge.call("evmInspect", args),
      evmDecode: (...args) => bridge.call("evmDecode", args),
      evmPropose: (...args) => bridge.call("evmPropose", args),
      depositInstructions: (...args) => bridge.call("depositInstructions", args),
      depositSetup: (...args) => bridge.call("depositSetup", args),
      depositStatus: (...args) => bridge.call("depositStatus", args),
      nansenCall: (...args) => bridge.call("nansenCall", args),
    };
    this.active = { eventId: message.eventId, capabilities };
    try {
      if (await this.ctx.storage.get<boolean>("disconnected") || !(await this.harness.authStatus()).connected) return chatGptConnectionRequired;
      return await this.harness.respond(message, capabilities);
    } finally { this.active = undefined; }
  }
}
