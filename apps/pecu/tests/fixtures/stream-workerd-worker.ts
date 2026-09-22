import { DurableObject, WorkerEntrypoint } from "cloudflare:workers";
import { turnEventStream } from "../../src/web-stream";

type Env = { STREAM: DurableObjectNamespace<StreamProbe>; RELAY: Fetcher };

/** Stands in for the Pecu Durable Object: paragraphs spaced out in time, the turn kept alive with waitUntil. */
export class StreamProbe extends DurableObject<Env> {
  override fetch(request: Request): Response {
    const cancel = new URL(request.url).searchParams.get("cancel") === "1";
    const { response, done } = turnEventStream(async (progress) => {
      progress("First paragraph.");
      await new Promise((resolve) => setTimeout(resolve, 250));
      progress("Second paragraph.");
      await new Promise((resolve) => setTimeout(resolve, 250));
      progress("Third paragraph.");
      if (cancel) await this.ctx.storage.put("finished", Date.now());
      return { status: "complete" };
    });
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
    if (url.pathname === "/finished") {
      const at = await env.STREAM.get(env.STREAM.idFromName("probe")).finished();
      return Response.json({ finished: at !== undefined });
    }
    return env.RELAY.fetch(request);
  },
} satisfies ExportedHandler<Env>;
