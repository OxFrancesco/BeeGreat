import { PecuAgent } from "../../src/agent";
import { DurableStore } from "../../src/cloudflare/durable-store";
import { WebAgent } from "../../src/web";
import { services, unusedWalletActions } from "./agent-services";
import { DurableObject, WorkerEntrypoint } from "cloudflare:workers";
import { liveTextContentType, turnEventStream } from "../../src/web-stream";
import { ReplyStream } from "../../src/reply-stream";

type Env = { STREAM: DurableObjectNamespace<StreamProbe>; DURABLE: DurableObjectNamespace<DurableTurnProbe>; RELAY: Fetcher };

/** Stands in for the Pecu Durable Object: paragraphs spaced out in time, the turn kept alive with waitUntil. */
export class StreamProbe extends DurableObject<Env> {
  override fetch(request: Request): Response {
    const cancel = new URL(request.url).searchParams.get("cancel") === "1";
    const live = request.headers.get("Accept") === liveTextContentType;
    const { response, done } = turnEventStream(async (progress) => {
      if (live) {
        const reply = new ReplyStream(progress);
        reply.push("m:0", "First");
        await new Promise((resolve) => setTimeout(resolve, 250));
        reply.push("m:0", " sentence.\n\nLast para");
        reply.finish({ id: "m", content: [{ type: "reasoning" }, { type: "text", text: "First sentence.\n\nLast paragraph." }] });
        return { status: "complete" };
      }
      progress("First paragraph.");
      await new Promise((resolve) => setTimeout(resolve, 250));
      progress("Second paragraph.");
      await new Promise((resolve) => setTimeout(resolve, 250));
      progress("Third paragraph.");
      if (cancel) await this.ctx.storage.put("finished", Date.now());
      return { status: "complete" };
    }, undefined, 15_000, live);
    this.ctx.waitUntil(done);
    return response;
  }
  async finished() {
    return this.ctx.storage.get<number>("finished");
  }
}

/** Stands in for StocksGateway: a WorkerEntrypoint that forwards the DO response body as is. */
export class Relay extends WorkerEntrypoint<Env> {
  override fetch(request: Request): Promise<Response> {
    return this.env.STREAM.get(this.env.STREAM.idFromName("probe")).fetch(request);
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/durable-")) return env.DURABLE.get(env.DURABLE.idFromName("recovery")).fetch(request);
    if (url.pathname === "/finished") {
      const at = await env.STREAM.get(env.STREAM.idFromName("probe")).finished();
      return Response.json({ finished: at !== undefined });
    }
    return env.RELAY.fetch(request);
  },
} satisfies ExportedHandler<Env>;

export class DurableTurnProbe extends DurableObject<Env> {
  private web: WebAgent;
  private store: DurableStore;
  private identity = { userId: "user_durabilitycheck", senderId: "web-user_durabilitycheck" };
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.store = new DurableStore(ctx.storage);
    this.store.initialize();
    ctx.storage.sql.exec("CREATE TABLE IF NOT EXISTS probe_effects(id TEXT PRIMARY KEY)");
    const agent = new PecuAgent({ enableMainnetExecution: false, maxSlippageBps: 100, quoteTtlSeconds: 120, depositRelayMaxUsd: 500, depositRelayDailyMaxUsd: 2000 }, this.store, {
      getOrCreate: async () => ({ address: "0x1111111111111111111111111111111111111111" }), balances: async () => "", ...unusedWalletActions,
    }, services({}), { respond: async (message, _capabilities, _mode, progress) => {
      const existing = ctx.storage.sql.exec("SELECT id FROM probe_effects WHERE id=?", message.eventId).toArray().length;
      if (!existing) {
        ctx.storage.sql.exec("INSERT INTO probe_effects(id) VALUES(?)", message.eventId);
        progress?.("Accepted on the server.");
        await new Promise(resolve => setTimeout(resolve, 30_000));
      }
      return "Finished the accepted request.";
    } });
    this.web = new WebAgent(agent, this.store, ctx.storage.sql);
    ctx.waitUntil(this.web.resumePending());
  }
  override async fetch(request: Request): Promise<Response> {
    const path = new URL(request.url).pathname;
    if (path === "/durable-state") return Response.json({ ...this.web.state(this.identity), effects: this.ctx.storage.sql.exec("SELECT id FROM probe_effects").toArray().length });
    if (path === "/durable-abort") { await this.ctx.storage.sync(); this.ctx.abort("Deliberate restart during an accepted turn"); }
    const { response, done } = turnEventStream(progress => this.web.handle({ ...this.identity, requestId: "44444444-4444-4444-8444-444444444444", text: "Run the recovery check" }, progress));
    this.ctx.waitUntil(done);
    return response;
  }
}
