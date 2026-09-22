import { DurableObject } from "cloudflare:workers";
import { DurableStore } from "../../src/cloudflare/durable-store";
import { OpenCodeHarness } from "../../src/cloudflare/opencode";
import type { AgentCapabilities } from "../../src/harness";
import type { VerifiedMessage } from "../../src/domain";

type Env = { FALLBACK: DurableObjectNamespace<FallbackProbe>; OPENROUTER_API_KEY?: string };

const toolsDisabled = () => Promise.reject<string>(new Error("tools disabled in probe"));
const capabilities: AgentCapabilities = {
  yoloEnabled: () => false,
  askUser: toolsDisabled,
  aaveCall: toolsDisabled,
  polymarketResearch: toolsDisabled,
  walletAddress: toolsDisabled,
  walletBalances: toolsDisabled,
  aeroRead: toolsDisabled,
  aeroPropose: toolsDisabled,
  stockTrades: toolsDisabled,
  evmToken: toolsDisabled,
  evmAllowance: toolsDisabled,
  evmRead: toolsDisabled,
  evmInspect: toolsDisabled,
  evmDecode: toolsDisabled,
  evmPropose: toolsDisabled,
  depositInstructions: toolsDisabled,
  depositSetup: toolsDisabled,
  depositStatus: toolsDisabled,
  nansenCall: toolsDisabled,
};

const providerCalls: unknown[] = [];
const recordingFetch = Object.assign(async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const request = new Request(input, init);
  if (new URL(request.url).hostname === "openrouter.ai") {
    const auth = request.headers.get("authorization");
    providerCalls.push({ url: request.url, scheme: auth?.split(" ")[0] ?? null, tokenLength: auth?.split(" ")[1]?.length ?? 0 });
  }
  return fetch(request);
}, { preconnect() {} });

export class FallbackProbe extends DurableObject<Env> {
  private readonly harness: Promise<OpenCodeHarness>;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.harness = ctx.blockConcurrencyWhile(async () => {
      const store = new DurableStore(ctx.storage);
      const harness = await OpenCodeHarness.create(ctx.storage, store, () => capabilities, recordingFetch, env.OPENROUTER_API_KEY);
      store.initialize();
      return harness;
    });
  }

  override async fetch(request: Request): Promise<Response> {
    const startedAt = Date.now();
    try {
      const harness = await this.harness;
      const mode = new URL(request.url).searchParams.get("mode");
      const text = await harness.respond(
        { eventId: crypto.randomUUID(), senderId: "probe", conversationId: "probe", text: "Reply with exactly the word OK and nothing else.", encodedEvent: "probe" } as VerifiedMessage,
        capabilities,
        mode === "response" ? "response" : undefined,
        undefined,
        false,
      );
      return Response.json({ text, elapsedMs: Date.now() - startedAt, fallbackConfigured: harness.fallbackConfigured, providerCalls });
    } catch (error) {
      return Response.json({ error: error instanceof Error ? error.message : String(error), providerCalls, fallbackConfigured: (await this.harness.then((h) => h.fallbackConfigured).catch(() => undefined)) }, { status: 500 });
    }
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/healthz") return Response.json({ ok: true });
    return env.FALLBACK.get(env.FALLBACK.idFromName("probe")).fetch(request);
  },
} satisfies ExportedHandler<Env>;
