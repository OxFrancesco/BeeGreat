import { expect, test } from "bun:test";
import { ParagraphBuffer, readSseEvents, sseFrame, turnEventStream, webTurnEventSchema, type WebTurnEvent } from "../src/web-stream";

async function collect(body: ReadableStream<Uint8Array>) {
  const events: WebTurnEvent[] = [];
  for await (const raw of readSseEvents(body)) events.push(webTurnEventSchema.parse(raw));
  return events;
}

test("a turn stream emits paragraphs as they are produced, then the outcome, and closes", async () => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const { response, done } = turnEventStream(async (progress) => {
    progress("One.");
    await gate;
    progress("Two.");
    return { status: "complete" };
  });
  expect(response.headers.get("Content-Type")).toBe("text/event-stream");
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  const first = decoder.decode((await reader.read()).value);
  expect(first).toBe(sseFrame({ type: "paragraph", text: "One." }));
  release();
  reader.releaseLock();
  expect(await collect(response.body!)).toEqual([
    { type: "paragraph", text: "Two." },
    { type: "complete", status: "complete" },
  ]);
  await done;
});

test("a failing turn ends the stream with an error event and reports it", async () => {
  const reported: unknown[] = [];
  const { response, done } = turnEventStream(async () => { throw new Error("boom"); }, (error) => reported.push(error));
  expect(await collect(response.body!)).toEqual([{ type: "error", error: "boom" }]);
  await done;
  expect(reported).toHaveLength(1);
});

test("a client that cancels the stream does not abort the turn", async () => {
  let finished = false;
  const { response, done } = turnEventStream(async (progress) => {
    progress("Before cancel.");
    await Bun.sleep(20);
    progress("After cancel.");
    finished = true;
    return { status: "complete" };
  });
  await response.body!.cancel();
  await done;
  expect(finished).toBe(true);
});

test("paragraphs flush only at blank lines and never inside a code fence", () => {
  const buffer = new ParagraphBuffer();
  expect(buffer.push("Your balance is ")).toEqual([]);
  expect(buffer.push("0.5 ETH.\n\nHere is the ")).toEqual(["Your balance is 0.5 ETH."]);
  expect(buffer.push("breakdown:\n\n```\nETH 0.5\n\nUSDC 12\n")).toEqual(["Here is the breakdown:"]);
  expect(buffer.push("```\n\nAnything else?")).toEqual(["```\nETH 0.5\n\nUSDC 12\n```"]);
  expect(buffer.end()).toEqual(["Anything else?"]);
  expect(buffer.end()).toEqual([]);
});

test("a trailing fence without a blank line still flushes on end and whitespace-only chunks are dropped", () => {
  const buffer = new ParagraphBuffer();
  expect(buffer.push("\n\n  \n\nIntro\n\n```js\nx\n```")).toEqual(["Intro"]);
  expect(buffer.end()).toEqual(["```js\nx\n```"]);
});

test("SSE frames round-trip through the reader even when chunks split mid-frame", async () => {
  const events: WebTurnEvent[] = [
    { type: "paragraph", text: "First.\nSecond line." },
    { type: "paragraph", text: "Two\n\nblank lines inside" },
    { type: "complete", status: "complete" },
  ];
  const wire = events.map(sseFrame).join("");
  const encoder = new TextEncoder();
  const chunks = [wire.slice(0, 7), wire.slice(7, 40), wire.slice(40)];
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
  const seen: WebTurnEvent[] = [];
  for await (const raw of readSseEvents(body)) seen.push(webTurnEventSchema.parse(raw));
  expect(seen).toEqual(events);
});

test("the turn event contract rejects unknown shapes", () => {
  expect(webTurnEventSchema.safeParse({ type: "paragraph" }).success).toBe(false);
  expect(webTurnEventSchema.safeParse({ type: "complete", status: "done" }).success).toBe(false);
  expect(webTurnEventSchema.safeParse({ type: "error", error: "x" }).success).toBe(true);
});
