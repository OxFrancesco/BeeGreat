import { AaveService } from "../integrations/aave";
import { PolymarketService } from "../integrations/polymarket";
import { ActivityQueue } from "./activity-queue";
import { DurableObject, WorkerEntrypoint } from "cloudflare:workers";
import { codexContainerFetch } from "./codex-fetch";
import type { BasedBotAgent } from "../agent";
import type { AgentCapabilities } from "../harness";
import { log } from "../logger";
import { isInvalidXChatPinError } from "../x/errors";
import { isUnauthorizedXApiError, refreshXOAuthToken } from "../x/oauth";
import { XActivityAdmin } from "../x/activity";
import { verifyWebhookSignature, webhookCrcResponse } from "../x/webhook";
import { nextXApiPollDelayMs } from "../x/rate-limit";
import type { ConversationDiscovery, XChatTransport } from "../x/transport";
import { loadWorkerConfig, runtimeConfigurationError, type WorkerConfig } from "./config";
import { DurableStore } from "./durable-store";
import { OpenCodeHarness } from "./opencode";
import { shouldRunScheduledPoll } from "./polling";
import { aeroWorkerExecutor } from "./aero-client";
import { evmWorkerExecutor } from "./evm-client";
import { WebAgent } from "../web";
import { webIdentitySchema, webTurnSchema, basketSchema } from "../web-contract";

const objectName = "basedbot-main";
const xOAuthStateKey = "basedbot-x-oauth";
const pollNotBeforeKey = "basedbot-poll-not-before";
const lastSuccessfulPollKey = "basedbot-last-successful-poll";
const lastActivityAtKey = "basedbot-last-activity-at";
const realtimeSetupKey = "basedbot-realtime-setup";
const realtimeFallbackPollMs = 60_000;
const realtimeSetupRecheckMs = 24 * 60 * 60 * 1_000;

type StoredXOAuthState = Readonly<{
  accessToken: string;
  refreshToken: string;
  seedDigest: string;
}>;

type StoredRealtimeSetup = Readonly<{
  webhookUrl: string;
  bearerDigest: string;
  checkedAt: number;
}>;

function json(value: unknown, status = 200): Response {
  return Response.json(value, {
    status,
    headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
  });
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function digest(value: string): Promise<string> {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function authorized(request: Request, config: WorkerConfig): boolean {
  return Boolean(config.adminToken) && request.headers.get("Authorization") === `Bearer ${config.adminToken}`;
}

function durableObject(env: Cloudflare.Env): DurableObjectStub {
  return env.BASED_BOT.get(env.BASED_BOT.idFromName(objectName));
}

export class BasedBotDurableObject extends DurableObject<Cloudflare.Env> {
  private readonly config: WorkerConfig;
  private readonly store: DurableStore;
  private harness!: OpenCodeHarness;
  private agent?: BasedBotAgent;
  private webAgent?: WebAgent;
  private transport?: XChatTransport;
  private xAccessToken?: string;
  private xRefreshToken?: string;
  private xRefreshSeedDigest?: string;
  private xRefreshInFlight?: Promise<void>;
  private nextAlarmDelayMs: number;
  private readonly ready: Promise<void>;

  constructor(ctx: DurableObjectState, env: Cloudflare.Env) {
    super(ctx, env);
    this.config = loadWorkerConfig(env);
    this.nextAlarmDelayMs = this.config.pollIntervalMs;
    this.store = new DurableStore(ctx.storage);
    this.ready = ctx.blockConcurrencyWhile(async () => {
      this.harness = await OpenCodeHarness.create(
        ctx.storage,
        this.store,
        (message): AgentCapabilities => {
          if (!this.agent) throw new Error(runtimeConfigurationError(this.config) ?? "BasedBot runtime is not ready");
          return this.agent.capabilitiesFor(message);
        },
        codexContainerFetch(env.CODEX),
      );
      this.store.initialize();
      await this.restoreXOAuthState();
      const configurationError = runtimeConfigurationError(this.config);
      if (!configurationError) {
        const [{ AerodromeService }, { BasedBotAgent }, { EvmService }, { awaitUserOperation, jsonRpcClient }, { WalletService }] = await Promise.all([
          import("../aerodrome"),
          import("../agent"),
          import("../evm"),
          import("../receipt"),
          import("../wallet"),
        ]);
        const wallets = new WalletService({
          crossmintApiKey: this.config.crossmintApiKey!,
          crossmintWalletSecret: this.config.crossmintWalletSecret!,
        }, this.store);
        const rpc = jsonRpcClient(this.config.baseRpcUrl);
        this.agent = new BasedBotAgent(
          this.config,
          this.store,
          wallets,
          {
            aave: new AaveService(),
            polymarket: new PolymarketService(this.config.exaApiKey, ctx.storage),
            aerodrome: new AerodromeService(this.config, aeroWorkerExecutor(env.AERO)),
            evm: new EvmService(evmWorkerExecutor(env.EVM)),
            verifyUserOperation: (reference) => awaitUserOperation(rpc, reference),
          },
          this.harness,
        );
        await this.agent.resumeExecuting();
        this.webAgent = new WebAgent(this.agent, this.store, ctx.storage.sql);
        if (this.config.xchatPollingEnabled) {
          try {
            await this.ensureRealtimeSetup();
          } catch (error) {
            log("error", "x_realtime_setup_failed", { error: errorMessage(error) });
          }
          const firstPollAt = Date.now() + 1_000;
          const scheduledAt = await ctx.storage.getAlarm();
          if (scheduledAt === null) {
            await ctx.storage.setAlarm(firstPollAt);
          }
        } else {
          await ctx.storage.deleteAlarm();
        }
      }
    });
  }

  override async fetch(request: Request): Promise<Response> {
    await this.ready;
    const url = new URL(request.url);
    try {
      if (url.pathname.startsWith("/internal/web/") && request.method === "POST") {
        if (!this.webAgent) return json({ error: "Agent unavailable" }, 503);
        const raw: unknown = await request.json();
        if (url.pathname === "/internal/web/state") return json(this.webAgent.state(webIdentitySchema.parse(raw)));
        if (url.pathname === "/internal/web/basket") {
          const identity = webIdentitySchema.parse(typeof raw === 'object' && raw ? Reflect.get(raw, 'identity') : null);
          const basket = basketSchema.parse(typeof raw === 'object' && raw ? Reflect.get(raw, 'basket') : null);
          this.webAgent.saveBasket(identity, basket);
          return json({ ok: true });
        }
        if (url.pathname !== "/internal/web/turn") return json({error:"not found"},404);
        const input = webTurnSchema.safeParse(raw);
        if (!input.success) return json({ error: "Invalid web request" }, 400);
        const result = await this.webAgent.handle(input.data);
        return json(result, result.status === "busy" ? 409 : 200);
      }
      if (url.pathname === "/internal/health" && request.method === "GET") return this.health();
      if (url.pathname === "/internal/auth/status" && request.method === "GET") {
        return json(await this.harness.authStatus());
      }
      if (url.pathname === "/internal/auth/tools" && request.method === "GET") return json(await this.harness.recentTools());
      if (url.pathname === "/internal/auth/start" && request.method === "POST") {
        return json(await this.harness.beginChatGptLogin(), 201);
      }
      if (url.pathname === "/internal/auth/probe" && request.method === "POST") {
        const { probeChatGptBoundary } = await import("./provider-probe");
        const boundary = await probeChatGptBoundary();
        const model = await this.harness.probe();
        return json({ boundary, model }, model.ok ? 200 : 503);
      }
      if (url.pathname.startsWith("/internal/auth/status/") && request.method === "GET") {
        const attemptId = decodeURIComponent(url.pathname.slice("/internal/auth/status/".length));
        if (!attemptId) return json({ error: "attempt ID is required" }, 400);
        return json(await this.harness.chatGptLoginStatus(attemptId));
      }
      if (url.pathname === "/internal/poll" && request.method === "POST") {
        await this.poll();
        return json({ ok: true });
      }
      if (url.pathname === "/internal/xchat/identity" && request.method === "GET") {
        if (!this.xAccessToken) return json({ error: "X_ACCESS_TOKEN is not configured" }, 503);
        const { XApi } = await import("../x/api");
        const identity = await new XApi(this.xAccessToken).identity();
        return json({
          ...identity,
          expectedUserId: this.config.chatBotUserId ?? null,
          matchesExpected: !this.config.chatBotUserId || identity.id === this.config.chatBotUserId,
          executingIntents: this.store.executingIntents().map((intent) => ({ id: intent.id, expiresAt: intent.expiresAt })),
        });
      }
      if (url.pathname === "/internal/activity" && request.method === "POST") {
        await new ActivityQueue(this.ctx.storage).enqueue(await request.json());
        return json({ ok: true, queued: true });
      }
      if (
        (url.pathname === "/internal/realtime/status" && request.method === "GET") ||
        (url.pathname === "/internal/realtime/revalidate" && request.method === "POST") ||
        (url.pathname === "/internal/realtime/replace" && request.method === "POST")
      ) {
        if (!this.config.xWebhookUrl || !this.config.xBearerToken || !this.xAccessToken) {
          return json({ error: "X realtime is not configured" }, 503);
        }
        const { XApi } = await import("../x/api");
        const botUserId = await new XApi(this.xAccessToken).me(this.config.chatBotUserId);
        const admin = new XActivityAdmin(this.config.xBearerToken, this.xAccessToken);
        if (url.pathname === "/internal/realtime/replace") {
          return json(await admin.replaceRealtimeSubscription(this.config.xWebhookUrl, botUserId));
        }
        return json(await (request.method === "POST"
          ? admin.revalidateRealtime(this.config.xWebhookUrl, botUserId)
          : admin.inspectRealtime(this.config.xWebhookUrl, botUserId)));
      }
      if (url.pathname === "/internal/realtime/setup" && request.method === "POST") {
        const webhookUrl = request.headers.get("X-BasedBot-Webhook-Url");
        if (!webhookUrl) return json({ error: "webhook URL is required" }, 400);
        return json(await this.setupRealtime(webhookUrl));
      }
      if (url.pathname === "/internal/cron" && request.method === "POST") {
        const lastPollAt = await this.ctx.storage.get<number>(lastSuccessfulPollKey);
        const interval = await this.realtimeReady() ? realtimeFallbackPollMs : this.config.pollIntervalMs;
        if (!shouldRunScheduledPoll(lastPollAt, Date.now(), interval)) {
          return json({ ok: true, skipped: true });
        }
        await new ActivityQueue(this.ctx.storage).wake();
        return json({ ok: true, scheduled: true });
      }
      return json({ error: "not found" }, 404);
    } catch (error) {
      log("error", "durable_object_request_failed", { path: url.pathname, error: errorMessage(error) });
      return json({ error: errorMessage(error) }, 500);
    }
  }

  override async alarm(): Promise<void> {
    await this.ready;
    log("info", "xchat_alarm_started");
    if (!this.config.xchatPollingEnabled) {
      await this.ctx.storage.deleteAlarm();
      return;
    }
    let stopPolling = false;
    let failed = false;
    const activities = new ActivityQueue(this.ctx.storage);
    let realtimeReady = false;
    try {
      try {
        realtimeReady = await this.ensureRealtimeSetup();
      } catch (error) {
        log("error", "x_realtime_setup_failed", { error: errorMessage(error) });
      }
      await activities.drain((body) => this.ingestActivity(body));
      await this.poll();
      this.nextAlarmDelayMs = realtimeReady ? realtimeFallbackPollMs : this.config.pollIntervalMs;
    } catch (error) {
      failed = true;
      stopPolling = isInvalidXChatPinError(error);
      if (stopPolling) {
        log("error", "xchat_unlock_stopped", { error: errorMessage(error) });
      } else {
        this.nextAlarmDelayMs = nextXApiPollDelayMs(
          error,
          this.config.pollIntervalMs,
          this.nextAlarmDelayMs,
        );
        log("error", "cloudflare_poll_failed", {
          error: errorMessage(error),
          retryDelayMs: this.nextAlarmDelayMs,
        });
      }
    } finally {
      if (stopPolling) await this.ctx.storage.deleteAlarm();
      else await this.ctx.storage.setAlarm(Date.now() + (!failed && await activities.pending() ? 1000 : this.nextAlarmDelayMs));
    }
  }

  private async health(): Promise<Response> {
    const auth = await this.harness.authStatus();
    const configurationError = runtimeConfigurationError(this.config);
    const lastPollAt = await this.ctx.storage.get<number>(lastSuccessfulPollKey);
    const lastActivityAt = await this.ctx.storage.get<number>(lastActivityAtKey);
    const realtimeReady = await this.realtimeReady();
    const pollNotBefore = await this.ctx.storage.get<number>(pollNotBeforeKey);
    const providerHealthy = !auth.lastResponse || auth.lastResponse.status < 400;
    return json({
      ok: !configurationError && auth.connected && providerHealthy,
      runtime: "cloudflare-durable-object",
      chain: { id: 8453, name: "Base mainnet", rpcHost: new URL(this.config.baseRpcUrl).hostname, executionEnabled: this.config.enableMainnetExecution },
      opencode: { connected: auth.connected, model: "openai/gpt-5.6-sol", methods: auth.methods, lastResponse: auth.lastResponse },
      xchat: {
        configured: !configurationError,
        pollingEnabled: this.config.xchatPollingEnabled,
        polling: Boolean(this.transport),
        refreshConfigured: Boolean(this.config.xOAuthClientId && this.config.xOAuthRefreshToken),
        realtimeConfigured: this.realtimeConfigured(),
        realtimeReady,
        delivery: realtimeReady && lastActivityAt ? "webhook" : "polling",
        lastSuccessfulPollAt: lastPollAt ? new Date(lastPollAt).toISOString() : null,
        lastActivityAt: lastActivityAt ? new Date(lastActivityAt).toISOString() : null,
        pollNotBefore: pollNotBefore ? new Date(pollNotBefore).toISOString() : null,
      },
      configurationError,
    }, !configurationError && auth.connected && providerHealthy ? 200 : 503);
  }

  private pollInFlight: Promise<void> | undefined;

  private async poll(): Promise<void> {
    if (this.pollInFlight) return this.pollInFlight;
    const work = this.pollWithBackoff();
    this.pollInFlight = work;
    try {
      await work;
    } finally {
      if (this.pollInFlight === work) this.pollInFlight = undefined;
    }
  }

  private async pollWithBackoff(): Promise<void> {
    const notBefore = await this.ctx.storage.get<number>(pollNotBeforeKey);
    if (!shouldRunScheduledPoll(undefined, Date.now(), this.config.pollIntervalMs, notBefore)) return;
    try {
      await this.performPoll();
      await this.ctx.storage.delete(pollNotBeforeKey);
    } catch (error) {
      this.nextAlarmDelayMs = nextXApiPollDelayMs(error, this.config.pollIntervalMs, this.nextAlarmDelayMs);
      await this.ctx.storage.put(pollNotBeforeKey, Date.now() + this.nextAlarmDelayMs);
      throw error;
    }
  }

  private async performPoll(): Promise<void> {
    if (!this.config.xchatPollingEnabled) throw new Error("XChat polling is disabled");
    if (!this.agent) throw new Error(runtimeConfigurationError(this.config) ?? "BasedBot runtime is not ready");
    try {
      await this.pollWithCurrentToken();
      await this.ctx.storage.put(lastSuccessfulPollKey, Date.now());
    } catch (error) {
      let failure = error;
      if (isUnauthorizedXApiError(error) && this.canRefreshXOAuth()) {
        try {
          await this.refreshXOAuth();
          await this.pollWithCurrentToken();
          await this.ctx.storage.put(lastSuccessfulPollKey, Date.now());
          return;
        } catch (refreshError) {
          failure = refreshError;
        }
      }
      if (isInvalidXChatPinError(failure)) await this.ctx.storage.deleteAlarm();
      throw failure;
    }
  }

  private async pollWithCurrentToken(): Promise<void> {
    await (await this.ensureTransport()).poll();
  }

  private async ingestActivity(body: unknown): Promise<boolean> {
    try {
      return await this.ingestActivityWithCurrentToken(body);
    } catch (error) {
      if (!isUnauthorizedXApiError(error) || !this.canRefreshXOAuth()) throw error;
      await this.refreshXOAuth();
      return this.ingestActivityWithCurrentToken(body);
    }
  }

  private async ingestActivityWithCurrentToken(body: unknown): Promise<boolean> {
    const handled = await (await this.ensureTransport()).ingestActivity(body, true);
    if (handled) await this.ctx.storage.put(lastActivityAtKey, Date.now());
    return handled;
  }

  private async ensureTransport(): Promise<XChatTransport> {
    if (!this.agent || !this.xAccessToken) throw new Error("BasedBot XChat runtime is not ready");
    if (this.transport) return this.transport;
    const [{ XApi }, { unlockChat }, { XChatTransport }] = await Promise.all([
      import("../x/api"),
      import("../x/chat"),
      import("../x/transport"),
    ]);
    const api = new XApi(this.xAccessToken);
    log("info", "xchat_transport_initializing");
    const botUserId = await api.me(this.config.chatBotUserId);
    const chat = await unlockChat(api, botUserId, { chatPin: this.config.chatPin! });
    log("info", "xchat_transport_unlocked");
    this.transport = new XChatTransport(api, chat, botUserId, this.config, this.store, this.agent, {
      get: () => this.ctx.storage.get<ConversationDiscovery>("basedbot-conversation-discovery"),
      put: (value) => this.ctx.storage.put("basedbot-conversation-discovery", value),
    });
    return this.transport;
  }

  private async setupRealtime(webhookUrl: string) {
    if (!this.config.xBearerToken) throw new Error("X_BEARER_TOKEN is not configured");
    if (!this.xAccessToken) throw new Error("X_ACCESS_TOKEN is not configured");
    try {
      return await this.setupRealtimeWithCurrentToken(webhookUrl);
    } catch (error) {
      const appAuthenticationFailed = errorMessage(error).includes("/2/webhooks");
      if (appAuthenticationFailed || !isUnauthorizedXApiError(error) || !this.canRefreshXOAuth()) throw error;
      await this.refreshXOAuth();
      return this.setupRealtimeWithCurrentToken(webhookUrl);
    }
  }

  private async setupRealtimeWithCurrentToken(webhookUrl: string) {
    if (!this.config.xBearerToken || !this.xAccessToken) throw new Error("X realtime credentials are not configured");
    const { XApi } = await import("../x/api");
    const botUserId = await new XApi(this.xAccessToken).me(this.config.chatBotUserId);
    return new XActivityAdmin(this.config.xBearerToken, this.xAccessToken).ensureRealtime(webhookUrl, botUserId);
  }

  private async ensureRealtimeSetup(): Promise<boolean> {
    const webhookUrl = this.config.xWebhookUrl;
    const bearerToken = this.config.xBearerToken;
    if (!this.realtimeConfigured() || !webhookUrl || !bearerToken) return false;
    const bearerDigest = await digest(bearerToken);
    const stored = await this.ctx.storage.get<StoredRealtimeSetup>(realtimeSetupKey);
    if (
      stored?.webhookUrl === webhookUrl &&
      stored.bearerDigest === bearerDigest &&
      Date.now() - stored.checkedAt < realtimeSetupRecheckMs
    ) return true;
    await this.setupRealtime(webhookUrl);
    await this.ctx.storage.put<StoredRealtimeSetup>(realtimeSetupKey, {
      webhookUrl,
      bearerDigest,
      checkedAt: Date.now(),
    });
    log("info", "x_realtime_setup_ready", { webhookUrl });
    return true;
  }

  private async realtimeReady(): Promise<boolean> {
    const webhookUrl = this.config.xWebhookUrl;
    const bearerToken = this.config.xBearerToken;
    if (!this.realtimeConfigured() || !webhookUrl || !bearerToken) return false;
    const stored = await this.ctx.storage.get<StoredRealtimeSetup>(realtimeSetupKey);
    return stored?.webhookUrl === webhookUrl && stored.bearerDigest === await digest(bearerToken);
  }

  private realtimeConfigured(): boolean {
    return Boolean(this.config.xBearerToken && this.config.xConsumerSecret);
  }

  private canRefreshXOAuth(): boolean {
    return Boolean(this.config.xOAuthClientId && this.xRefreshToken);
  }

  private async restoreXOAuthState(): Promise<void> {
    this.xAccessToken = this.config.xAccessToken;
    this.xRefreshToken = this.config.xOAuthRefreshToken;
    if (!this.config.xOAuthRefreshToken) return;
    this.xRefreshSeedDigest = await digest(this.config.xOAuthRefreshToken);
    const stored = await this.ctx.storage.get<StoredXOAuthState>(xOAuthStateKey);
    if (stored?.seedDigest === this.xRefreshSeedDigest) {
      this.xAccessToken = stored.accessToken;
      this.xRefreshToken = stored.refreshToken;
    }
  }

  private async refreshXOAuth(): Promise<void> {
    if (this.xRefreshInFlight) return this.xRefreshInFlight;
    const refresh = this.performXOAuthRefresh();
    this.xRefreshInFlight = refresh;
    try {
      await refresh;
    } finally {
      if (this.xRefreshInFlight === refresh) this.xRefreshInFlight = undefined;
    }
  }

  private async performXOAuthRefresh(): Promise<void> {
    if (!this.config.xOAuthClientId || !this.xRefreshToken || !this.xRefreshSeedDigest) {
      throw new Error("X OAuth refresh credentials are not configured");
    }
    const tokens = await refreshXOAuthToken({
      clientId: this.config.xOAuthClientId,
      ...(this.config.xOAuthClientSecret ? { clientSecret: this.config.xOAuthClientSecret } : {}),
      refreshToken: this.xRefreshToken,
    });
    this.xAccessToken = tokens.accessToken;
    this.xRefreshToken = tokens.refreshToken;
    this.transport = undefined;
    await this.ctx.storage.put<StoredXOAuthState>(xOAuthStateKey, {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      seedDigest: this.xRefreshSeedDigest,
    });
    log("info", "x_oauth_refreshed");
  }
}

export class StocksGateway extends WorkerEntrypoint<Cloudflare.Env> {
  override async fetch(request: Request): Promise<Response> {
    const path = new URL(request.url).pathname;
    if (request.method !== "POST" || !["/turn", "/state", "/basket"].includes(path)) return json({error:"not found"},404);
    const body = await request.text();
    if (body.length > 8192) return json({error:"Request too large"},413);
    return durableObject(this.env).fetch(new Request(`https://basedbot.internal/internal/web${path}`, {
      method:"POST",headers:{"Content-Type":"application/json"},body,
    }));
  }
}

export default {
  async fetch(request: Request, env: Cloudflare.Env, ctx: ExecutionContext): Promise<Response> {
    const config = loadWorkerConfig(env);
    const url = new URL(request.url);
    if (url.pathname === "/x/webhook") {
      if (!config.xConsumerSecret) return json({ error: "not found" }, 404);
      if (request.method === "GET") {
        const crcToken = url.searchParams.get("crc_token");
        if (!crcToken) return json({ error: "crc_token is required" }, 400);
        return json({ response_token: await webhookCrcResponse(crcToken, config.xConsumerSecret) });
      }
      if (request.method === "POST") {
        const rawBody = await request.text();
        const valid = await verifyWebhookSignature(
          rawBody,
          request.headers.get("x-twitter-webhooks-signature"),
          config.xConsumerSecret,
        );
        if (!valid) return json({ error: "invalid webhook signature" }, 401);
        let body: unknown;
        try { body = JSON.parse(rawBody); }
        catch { return json({ error: "invalid JSON" }, 400); }
        const queued = await durableObject(env).fetch(new Request("https://basedbot.internal/internal/activity", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }));
        if (!queued.ok) return json({ error: "Could not queue activity" }, 503);
        return new Response(null, { status: 200 });
      }
      return json({ error: "method not allowed" }, 405);
    }
    if (url.pathname === "/health" && request.method === "GET") {
      return durableObject(env).fetch(new Request(new URL("/internal/health", request.url), request));
    }
    if (!url.pathname.startsWith("/admin/") || !authorized(request, config)) {
      return json({ error: "not found" }, 404);
    }
    const internalPath = url.pathname
      .replace(/^\/admin\/opencode\/login\/status\//, "/internal/auth/status/")
      .replace(/^\/admin\/opencode\/login$/, "/internal/auth/start")
      .replace(/^\/admin\/opencode\/status$/, "/internal/auth/status")
      .replace(/^\/admin\/opencode\/tools$/, "/internal/auth/tools")
      .replace(/^\/admin\/opencode\/probe$/, "/internal/auth/probe")
      .replace(/^\/admin\/poll$/, "/internal/poll")
      .replace(/^\/admin\/xchat\/identity$/, "/internal/xchat/identity")
      .replace(/^\/admin\/xchat\/realtime\/setup$/, "/internal/realtime/setup")
      .replace(/^\/admin\/xchat\/realtime\/status$/, "/internal/realtime/status")
      .replace(/^\/admin\/xchat\/realtime\/revalidate$/, "/internal/realtime/revalidate")
      .replace(/^\/admin\/xchat\/realtime\/replace$/, "/internal/realtime/replace");
    const internalRequest = new Request(new URL(internalPath, request.url), request);
    if (internalPath === "/internal/realtime/setup") {
      internalRequest.headers.set("X-BasedBot-Webhook-Url", new URL("/x/webhook", request.url).toString());
    }
    return durableObject(env).fetch(internalRequest);
  },
  scheduled(_controller: ScheduledController, env: Cloudflare.Env, ctx: ExecutionContext): void {
    ctx.waitUntil((async () => {
      const response = await durableObject(env).fetch(new Request("https://basedbot.internal/internal/cron", {
        method: "POST",
      }));
      if (!response.ok) throw new Error(`Scheduled XChat poll failed with HTTP ${response.status}`);
    })());
  },
} satisfies ExportedHandler<Cloudflare.Env>;
