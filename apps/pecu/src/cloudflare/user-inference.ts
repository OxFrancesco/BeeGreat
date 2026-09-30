import { batchedAnalytics } from "../analytics";
import { chatGptConnectionRequired } from "../inference-recovery";
import { DurableObject, RpcTarget } from "cloudflare:workers";
import type { AgentCapabilities, ResponseMode } from "../harness";
import type { VerifiedMessage } from "../domain";
import { DurableStore } from "./durable-store";
import { OpenCodeHarness, type OAuthStart } from "./opencode";
import { codexContainerFetch } from "./codex-fetch";
import { loadWorkerConfig } from "./config";
import { log } from "../logger";
import { UsageLimitError } from "../usage-limit";
import type { TurnStage } from "../progress";
import type { ParagraphSink } from "../web-stream";
import { ChainDataService } from "../integrations/chain-data";
import { TwitterService } from "../integrations/twitter";
import { NansenService } from "../integrations/nansen";
import type { ChainProfile } from "../research/agents";
import type { ResearchTurn } from "../research/runner";
import type { ResearchWindow } from "../research-contract";

type Capability = Exclude<keyof AgentCapabilities, "yoloEnabled">;
const allowed = new Set<string>(["askUser", "aaveCall", "polymarketResearch", "polymarketRead", "walletAddress", "walletBalances", "aeroRead", "aeroPropose", "liquidity", "stockTrades", "evmToken", "evmAllowance", "evmRead", "evmInspect", "evmDecode", "safeRead", "safeQueue", "safeList", "evmPropose", "depositInstructions", "depositSetup", "depositStatus", "nansenCall", "taskCreate", "taskList", "taskUpdate", "researchStart", "researchList", "researchGet", "researchCancel"]);

export class InferenceTools extends RpcTarget {
  constructor(private readonly capabilities: AgentCapabilities, private readonly mode?: ResponseMode, private readonly onParagraph?: ParagraphSink) { super(); }
  async call<K extends Capability>(name: K, args: Parameters<AgentCapabilities[K]>): Promise<string> {
    if (!allowed.has(name)) throw new Error("Tool unavailable");
    if (this.mode === "response" && name !== "askUser") throw new Error("This turn is explanation-only. Ask the user to clarify if live data or an action is needed.");
    // SAFETY: the same capability key selects both the function and its parameter tuple; the allowlist above excludes non-callable fields.
    const invoke = this.capabilities[name] as (...args: Parameters<AgentCapabilities[K]>) => Promise<string>;
    return invoke(...args);
  }
  /** Whether the caller wants partial replies; lets the inference object skip the event subscription otherwise. */
  streams(): false | "paragraph" | "text" {
    return this.onParagraph ? this.onParagraph.live ? "text" : "paragraph" : false;
  }
  stage(stage: TurnStage): void { this.onParagraph?.stage?.(stage); }
  paragraph(text: string, eventId?: string): void {
    this.onParagraph?.(text, eventId);
  }
}

export function userInference(env: Cloudflare.Env, senderId: string) {
  return env.INFERENCE.get(env.INFERENCE.idFromName(`x:${senderId}`));
}

/** A disposable runtime for one research stage. Keys start with `research:`, so they never collide with a user's `x:` runtime. */
export function researchInference(env: Pick<Cloudflare.Env, "INFERENCE">, key: string) {
  if (!key.startsWith("research:")) throw new Error("Research runtimes need a research key");
  return env.INFERENCE.get(env.INFERENCE.idFromName(key));
}

export class UserInference extends DurableObject<Cloudflare.Env> {
  private readonly ready: Promise<void>;
  private harness!: OpenCodeHarness;
  private readonly chainData = new ChainDataService();
  private active?: { eventId: string; conversationId: string; senderId: string; capabilities: AgentCapabilities };
  private researching = false;
  private changing = false;

  constructor(ctx: DurableObjectState, env: Cloudflare.Env) {
    super(ctx, env);
    this.ready = ctx.blockConcurrencyWhile(async () => {
      if (await ctx.storage.get("login")) {
        await ctx.storage.delete("login");
        await ctx.storage.put("loginState", "expired");
      }
      const config = loadWorkerConfig(env);
      const store = new DurableStore(ctx.storage);
      this.harness = await OpenCodeHarness.create(ctx.storage, store, (message) => {
        if (!this.active || this.active.eventId !== message.eventId) throw new Error("This turn has ended. Send your request again.");
        return this.active.capabilities;
      }, codexContainerFetch(env.CODEX), config.openRouterApiKey,
        config.analyticsEnabled
          ? batchedAnalytics(work => ctx.waitUntil(work))
          : undefined, (work) => ctx.waitUntil(work), {
          chainData: this.chainData,
          twitter: new TwitterService(config.twitterApiKey),
          nansen: config.nansenApiKey ? new NansenService(config.nansenApiKey, config.nansenApiUrl) : undefined,
        });
      store.initialize();
    });
  }

  async warm() { await this.ready; }

  /** Build a research run's evidence pack here, so large DefiLlama responses never load into the main object. Returned as JSON text. */
  async collect(chain: ChainProfile, window: ResearchWindow): Promise<string> {
    await this.ready;
    return JSON.stringify(await this.chainData.pack(chain, window));
  }

  /** Run one research stage. Each stage has its own runtime, so this refuses a second concurrent turn. The submission crosses RPC as JSON text. */
  async research(turn: ResearchTurn): Promise<{ text: string; submission: string | null; calls: number }> {
    await this.ready;
    if (this.active || this.researching) throw new Error("This research runtime is busy.");
    this.researching = true;
    try {
      const result = await this.harness.research(turn);
      return { text: result.text, submission: result.submission === null ? null : JSON.stringify(result.submission), calls: result.calls };
    } finally { this.researching = false; }
  }

  /** Delete a finished research runtime's sessions and storage. */
  async forget() {
    await this.ready;
    if (this.active || this.researching) return;
    await this.ctx.storage.deleteAll();
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
    const connected = status.connected && !await this.ctx.storage.get<boolean>("disconnected");
    return { ...status, connected, fallback: { configured: this.harness.fallbackConfigured, active: this.harness.fallbackConfigured && (!connected || status.usageLimit !== null) }, login: await this.ctx.storage.get<OAuthStart>("login") ?? null, loginState: await this.ctx.storage.get<string>("loginState") ?? null };
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

  async steer(message: VerifiedMessage, targetEventId: string) {
    await this.ready;
    if (!this.active || this.active.eventId !== targetEventId ||
      this.active.conversationId !== message.conversationId || this.active.senderId !== message.senderId) {
      throw new Error("That reply is no longer running. Send your message again after it finishes.");
    }
    await this.harness.steer(message, targetEventId);
  }

  async respond(message: VerifiedMessage, yolo: boolean, bridge: InferenceTools, mode?: ResponseMode) {
    await this.ready;
    if (this.active || this.changing) throw new Error("Pecu is finishing your previous request. Try again shortly.");
    const capabilities: AgentCapabilities = {
      yoloEnabled: () => yolo,
      askUser: (...args) => bridge.call("askUser", args),
      aaveCall: (...args) => bridge.call("aaveCall", args),
      polymarketResearch: (...args) => bridge.call("polymarketResearch", args),
      polymarketRead: (...args) => bridge.call("polymarketRead", args),
      walletAddress: (...args) => bridge.call("walletAddress", args),
      walletBalances: (...args) => bridge.call("walletBalances", args),
      aeroRead: (...args) => bridge.call("aeroRead", args),
      aeroPropose: (...args) => bridge.call("aeroPropose", args),
      liquidity: (...args) => bridge.call("liquidity", args),
      stockTrades: (...args) => bridge.call("stockTrades", args),
      evmToken: (...args) => bridge.call("evmToken", args),
      evmAllowance: (...args) => bridge.call("evmAllowance", args),
      evmRead: (...args) => bridge.call("evmRead", args),
      evmInspect: (...args) => bridge.call("evmInspect", args),
      evmDecode: (...args) => bridge.call("evmDecode", args),
      safeRead: (...args) => bridge.call("safeRead", args),
      safeQueue: (...args) => bridge.call("safeQueue", args),
      safeList: (...args) => bridge.call("safeList", args),
      evmPropose: (...args) => bridge.call("evmPropose", args),
      depositInstructions: (...args) => bridge.call("depositInstructions", args),
      depositSetup: (...args) => bridge.call("depositSetup", args),
      depositStatus: (...args) => bridge.call("depositStatus", args),
      nansenCall: (...args) => bridge.call("nansenCall", args),
      taskCreate: (...args) => bridge.call("taskCreate", args),
      taskList: (...args) => bridge.call("taskList", args),
      taskUpdate: (...args) => bridge.call("taskUpdate", args),
      researchStart: (...args) => bridge.call("researchStart", args),
      researchList: (...args) => bridge.call("researchList", args),
      researchGet: (...args) => bridge.call("researchGet", args),
      researchCancel: (...args) => bridge.call("researchCancel", args),
    };
    this.active = { eventId: message.eventId, conversationId: message.conversationId, senderId: message.senderId, capabilities };
    let delivery = Promise.resolve();
    try {
      const chatGpt = !await this.ctx.storage.get<boolean>("disconnected") && (await this.harness.authStatus()).connected;
      if (!chatGpt && !this.harness.fallbackConfigured) return chatGptConnectionRequired;
      const streamMode = await bridge.streams();
      const progress: ParagraphSink | undefined = streamMode
        ? (text, eventId) => { delivery = delivery.then(() => bridge.paragraph(text, eventId)).catch(() => {}); }
        : undefined;
      if (progress) {
        progress.live = streamMode === "text";
        progress.stage = stage => { delivery = delivery.then(() => bridge.stage(stage)).catch(() => {}); };
      }
      return await this.harness.respond(message, capabilities, mode, progress, chatGpt);
    } catch (error) {
      // Returned as a reply, not thrown: RPC would flatten the subclass and the caller would wrap it as a command failure.
      if (!(error instanceof UsageLimitError)) throw error;
      log("info", "usage_limit_reply", { eventId: message.eventId, kind: error.limit.kind, resetsAt: error.limit.resetsAt });
      return error.message;
    } finally { await delivery; this.active = undefined; }
  }
}
