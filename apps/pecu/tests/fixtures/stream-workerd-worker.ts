import { DurableObject, WorkerEntrypoint } from "cloudflare:workers";
import { liveTextContentType, turnEventStream } from "../../src/web-stream";
import { ReplyStream } from "../../src/reply-stream";

type Env = { STREAM: DurableObjectNamespace<StreamProbe>; RELAY: Fetcher };

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
        reply.finish({ id: "m", content: [{ type: "text", text: "First sentence.\n\nLast paragraph." }] });
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
    if (url.pathname === "/finished") {
      const at = await env.STREAM.get(env.STREAM.idFromName("probe")).finished();
      return Response.json({ finished: at !== undefined });
    }
    return env.RELAY.fetch(request);
  },
} satisfies ExportedHandler<Env>;
