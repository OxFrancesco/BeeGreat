import { DurableObject } from "cloudflare:workers";
import { z } from "zod";
import { DurableStore } from "../../src/cloudflare/durable-store";
import { OpenCodeHarness } from "../../src/cloudflare/opencode";
import { ChainDataService } from "../../src/integrations/chain-data";
import { TwitterService } from "../../src/integrations/twitter";
import { jsonObjectSchema, jsonValueSchema, type JsonValue } from "../../src/json-contract";
import type { AgentCapabilities } from "../../src/harness";
import type { ParagraphSink } from "../../src/web-stream";
import type { TurnStage } from "../../src/progress";
import { unusedCapabilities } from "./agent-services";
import { curatedChain } from "../../src/research/agents";
import { researchRoleSchema } from "../../src/research-contract";
import { chainFetch, now } from "./chain-data";

const invocation = z.object({ name: z.string(), input: jsonObjectSchema });
const requestSchema = z.object({
  research: researchRoleSchema.optional(),
  text: z.string(), explanation: z.boolean().default(false),
  plan: z.array(invocation).optional(), failBalances: z.boolean().default(false),
});
type Env = { PROBE: DurableObjectNamespace<CodeModeProbe>; OPENROUTER_API_KEY?: string };

export class CodeModeProbe extends DurableObject<Env> {
  override async fetch(request: Request): Promise<Response> {
    const input = requestSchema.parse(await request.json());
    const providerRequests: JsonValue[] = [];
    const calls: { name: string; input?: JsonValue }[] = [];
    const stages: TurnStage[] = [];
    const analytics: JsonValue[] = [];
    const address = "0x1111111111111111111111111111111111111111";
    const capabilities: AgentCapabilities = {
      ...unusedCapabilities,
      walletAddress: async () => { calls.push({ name: "wallet_address" }); return address; },
      walletBalances: async () => {
        calls.push({ name: "wallet_balances" });
        if (input.failBalances) throw new Error("Balance provider unavailable");
        return JSON.stringify({ ETH: "2", USDC: "40", AERO: "10" });
      },
      evmToken: async token => { calls.push({ name: "evm_token_balance", input: token }); return JSON.stringify({ token, balance: "40" }); },
      evmPropose: async (action, parameters) => {
        calls.push({ name: "evmPropose", input: jsonValueSchema.parse({ action, parameters }) });
        return "Fixture unsigned preview. Confirm with /confirm ABC234. No transaction submitted.";
      },
      askUser: async question => { calls.push({ name: "ask_user", input: question }); return question; },
    };
    let step = 0;
    const providerFetch: typeof fetch = Object.assign(async (source: RequestInfo | URL, init?: RequestInit) => {
      const outgoing = new Request(source, init);
      if (new URL(outgoing.url).hostname !== "openrouter.ai") throw new Error("Unexpected inference host");
      providerRequests.push(jsonValueSchema.parse(await outgoing.clone().json()));
      if (!input.plan) {
        if (step++ >= 8) return new Response("Probe model step limit", { status: 400 });
        return fetch(outgoing);
      }
      const next = input.plan[step++];
      const delta = next
        ? { role: "assistant", tool_calls: [{ index: 0, id: `probe-${step}`, type: "function", function: { name: next.name, arguments: JSON.stringify(next.input) } }] }
        : { role: "assistant", content: "DONE" };
      const chunk = { id: `probe-${step}`, object: "chat.completion.chunk", created: 1, model: "openai/gpt-6-sol", choices: [{ index: 0, delta, finish_reason: null }] };
      const finish = { ...chunk, choices: [{ index: 0, delta: {}, finish_reason: next ? "tool_calls" : "stop" }], usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 } };
      return new Response(`data: ${JSON.stringify(chunk)}\n\ndata: ${JSON.stringify(finish)}\n\ndata: [DONE]\n\n`, { headers: { "Content-Type": "text/event-stream" } });
    }, { preconnect() {} });
    const data = chainFetch();
    const store = new DurableStore(this.ctx.storage);
    const harness = await OpenCodeHarness.create(this.ctx.storage, store, () => capabilities, providerFetch,
      input.plan ? "fixture-key" : this.env.OPENROUTER_API_KEY, (_sender, event) => { analytics.push(jsonValueSchema.parse(event)); }, undefined,
      { chainData: new ChainDataService(data.request, () => now), twitter: new TwitterService(undefined) });
    store.initialize();
    const sink: ParagraphSink = Object.assign(() => {}, { stage: (stage: TurnStage) => stages.push(stage) });
    const started = Date.now();
    try {
      if (input.research) {
        const chain = curatedChain("base");
        if (!chain) throw new Error("Missing Base profile");
        const result = await harness.research({ key: "fixture", code: "ABC234", role: input.research, chain, prompt: input.text, senderId: "fixture" });
        return Response.json({ ...result, researchCalls: result.calls, calls, elapsedMs: Date.now() - started, stages, analytics, providerRequests, dataRequests: data.urls });
      }
      const text = await harness.respond({ eventId: crypto.randomUUID(), senderId: "fixture", conversationId: "fixture", encodedEvent: "fixture", text: input.text }, capabilities, input.explanation ? "response" : undefined, sink, false);
      return Response.json({ text, elapsedMs: Date.now() - started, calls, stages, analytics, providerRequests, dataRequests: data.urls });
    } catch (error) {
      return Response.json({ error: error instanceof Error ? error.message : String(error), calls, stages, providerRequests }, { status: 500 });
    }
  }
}

export default {
  fetch(request: Request, env: Env) {
    if (new URL(request.url).pathname === "/healthz") return Response.json({ ok: true });
    return env.PROBE.get(env.PROBE.idFromName(crypto.randomUUID())).fetch(request);
  },
} satisfies ExportedHandler<Env>;
