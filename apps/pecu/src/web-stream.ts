import { z } from "zod";

/** Receives one finished paragraph of the model's reply while a turn is still running. */
export type ParagraphSink = (paragraph: string) => void;

/**
 * Splits streamed text deltas into finished paragraphs. A paragraph ends at a
 * blank line, except inside an open ``` fence, so a code block is never cut in
 * half. `end()` flushes whatever is left when the text part finishes.
 */
export class ParagraphBuffer {
  private pending = "";

  push(delta: string): string[] {
    this.pending += delta;
    const out: string[] = [];
    let from = 0;
    for (;;) {
      const index = this.pending.indexOf("\n\n", from);
      if (index < 0) break;
      const candidate = this.pending.slice(0, index);
      if (fenceOpen(candidate)) {
        from = index + 2;
        continue;
      }
      const paragraph = candidate.trim();
      if (paragraph) out.push(paragraph);
      this.pending = this.pending.slice(index + 2);
      from = 0;
    }
    return out;
  }

  end(): string[] {
    const paragraph = this.pending.trim();
    this.pending = "";
    return paragraph ? [paragraph] : [];
  }
}

function fenceOpen(text: string): boolean {
  let open = false;
  for (const line of text.split("\n")) if (/^\s*(```|~~~)/.test(line)) open = !open;
  return open;
}

export const webTurnEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("paragraph"), text: z.string() }),
  z.object({ type: z.literal("complete"), status: z.enum(["complete", "busy"]) }),
  z.object({ type: z.literal("error"), error: z.string() }),
]);
export type WebTurnEvent = z.infer<typeof webTurnEventSchema>;

export const sseContentType = "text/event-stream";

export function sseFrame(event: WebTurnEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

/**
 * Runs a turn and answers it as server-sent events: one `paragraph` per
 * finished paragraph, then `complete` or `error`. `done` settles when the
 * turn has finished and the stream is closed; the caller keeps it alive with
 * `waitUntil` so a client that disconnects never aborts the turn.
 */
export function turnEventStream(
  run: (progress: ParagraphSink) => Promise<{ status: "complete" | "busy" }>,
  onError?: (cause: unknown) => void,
  heartbeatMs = 15_000,
) {
  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();
  const emit = (event: WebTurnEvent) => writer.write(encoder.encode(sseFrame(event))).catch(() => {});
  let heartbeatPending = false;
  const heartbeat = () => {
    if (heartbeatPending) return;
    heartbeatPending = true;
    void writer.write(encoder.encode(": keep-alive\n\n")).catch(() => {}).finally(() => { heartbeatPending = false; });
  };
  heartbeat();
  const timer = setInterval(heartbeat, heartbeatMs);
  const done = Promise.resolve().then(() => run((text) => { void emit({ type: "paragraph", text }); }))
    .then(
      (result) => emit({ type: "complete", status: result.status }),
      (error) => {
        onError?.(error);
        return emit({ type: "error", error: error instanceof Error ? error.message : String(error) });
      },
    )
    .finally(() => { clearInterval(timer); return writer.close().catch(() => {}); });
  return {
    response: new Response(readable, {
      headers: { "Content-Type": sseContentType, "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
    }),
    done,
  };
}

/** Yields the parsed `data:` payload of each server-sent event as it arrives. */
export async function* readSseEvents(body: ReadableStream<Uint8Array>): AsyncGenerator<WebTurnEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffered = "";
  try {
    for (;;) {
      const { value, done } = await reader.read();
      buffered += done ? decoder.decode() : decoder.decode(value, { stream: true });
      let index;
      while ((index = buffered.indexOf("\n\n")) >= 0) {
        const frame = buffered.slice(0, index);
        buffered = buffered.slice(index + 2);
        const data = frame
          .split("\n")
          .filter((line) => line.startsWith("data:"))
          .map((line) => line.slice(5).trimStart())
          .join("\n");
        if (data) yield webTurnEventSchema.parse(JSON.parse(data));
      }
      if (done) return;
    }
  } finally {
    reader.releaseLock();
  }
}
