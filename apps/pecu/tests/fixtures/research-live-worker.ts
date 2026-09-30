import { DurableObject } from "cloudflare:workers";
import { ChainDataService, type ResearchPack } from "../../src/integrations/chain-data";
import { jsonValueSchema } from "../../src/json-contract";
import { ResearchControl } from "../../src/research/control";
import { ResearchRunner } from "../../src/research/runner";
import { ResearchStore } from "../../src/research/store";
import { researchInference } from "../../src/cloudflare/user-inference";
import { researchWindowSchema } from "../../src/research-contract";

export { UserInference } from "../../src/cloudflare/user-inference";

type Env = { PROBE: DurableObjectNamespace<ResearchProbe>; INFERENCE: Cloudflare.Env["INFERENCE"]; OPENROUTER_API_KEY?: string; TWITTERAPI_IO_KEY?: string };

/** The production research wiring (store, runner, control, isolated inference runtimes) without the rest of Pecu. */
export class ResearchProbe extends DurableObject<Env> {
  private readonly control: ResearchControl;
  private readonly deliveries: string[] = [];

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    const store = new ResearchStore(ctx.storage.sql);
    const runner = new ResearchRunner(store, {
      // SAFETY: the research runtime serialized this text from a ResearchPack it just built.
      collect: async (key, chain, window) => JSON.parse(await researchInference(env, key).collect(chain, window)) as ResearchPack,
      run: async (turn) => {
        const result = await researchInference(env, turn.key).research(turn);
        return { text: result.text, calls: result.calls, submission: result.submission === null ? null : jsonValueSchema.parse(JSON.parse(result.submission)) };
      },
      forget: (key) => researchInference(env, key).forget(),
    }, {
      enqueueReply: (_key, _conversation, _event, text) => { this.deliveries.push(text); },
      notify: async (input) => { this.deliveries.push(`notification: ${input.title}`); },
    });
    this.control = new ResearchControl(store, runner, new ChainDataService(), { perSenderDaily: 5, globalDaily: 5 }, (work) => ctx.waitUntil(work));
  }

  override async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    try {
      if (url.pathname === "/start") {
        const run = await this.control.start({ senderId: "probe", conversationId: "probe", encodedEvent: "probe", deliver: true }, url.searchParams.get("chain") ?? "base", researchWindowSchema.parse(url.searchParams.get("window") ?? "7d"));
        return Response.json({ code: run.code });
      }
      if (url.pathname === "/detail") return Response.json({ ...this.control.detail("probe", url.searchParams.get("code") ?? ""), deliveries: this.deliveries });
      if (url.pathname === "/export") return Response.json(this.control.export(url.searchParams.get("code") ?? "") ?? { error: "not found" });
      return Response.json({ error: "not found" }, { status: 404 });
    } catch (error) {
      return Response.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
    }
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (new URL(request.url).pathname === "/healthz") return Response.json({ ok: true });
    return env.PROBE.get(env.PROBE.idFromName("probe")).fetch(request);
  },
} satisfies ExportedHandler<Env>;
