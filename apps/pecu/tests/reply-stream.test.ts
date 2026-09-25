import { expect, test } from "bun:test";
import { ReplyStream } from "../src/reply-stream";
import type { ParagraphSink } from "../src/web-stream";

test("live text appears before a sentence or paragraph ends and coalesces subsequent deltas", async () => {
  const seen: string[] = [];
  const sink: ParagraphSink = (text) => { seen.push(text); };
  sink.live = true;
  const stream = new ReplyStream(sink, 10);
  stream.push("m:0", "A pool");
  expect(seen).toEqual(["A pool"]);
  stream.push("m:0", " holds");
  stream.push("m:0", " tokens.");
  expect(seen).toHaveLength(1);
  await Bun.sleep(25);
  expect(seen).toEqual(["A pool", "A pool holds tokens."]);
  stream.stop();
});

test("completion reconciles missing deltas and cancels stale updates without changing markdown", async () => {
  const seen: string[] = [];
  const sink: ParagraphSink = Object.assign((text: string) => { seen.push(text); }, { live: true });
  const stream = new ReplyStream(sink, 10);
  stream.push("m:0", "**Hel");
  stream.push("m:0", "lo**\n\n```ts\n");
  const final = "**Hello**\n\n```ts\nconst n = 1;\n```\n\nThe final paragraph.";
  stream.finish({ id: "m", content: [{ type: "text", text: final }] });
  stream.end("m:0", "stale event");
  await Bun.sleep(25);
  expect(seen).toEqual(["**Hel", final]);
});

test("legacy paragraphs reconcile an absent end event and do not repeat completed parts", () => {
  const seen: string[] = [];
  const stream = new ReplyStream((text) => { seen.push(text); });
  stream.push("m:0", "One.\n\nTw");
  stream.end("m:0", "One.\n\nTwo.");
  stream.finish({ id: "m", content: [{ type: "text", text: "One.\n\nTwo." }, { type: "tool" }, { type: "text", text: "Three." }] });
  expect(seen).toEqual(["One.", "Two.", "Three."]);
});

test("stopping a failed turn cancels pending display updates", async () => {
  const seen: string[] = [];
  const stream = new ReplyStream(Object.assign((text: string) => { seen.push(text); }, { live: true }), 10);
  stream.push("m:0", "First");
  stream.push("m:0", " unfinished");
  stream.stop();
  await Bun.sleep(25);
  expect(seen).toEqual(["First"]);
});
