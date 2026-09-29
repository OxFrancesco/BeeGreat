import { expect, mock } from "bun:test";
import type { z } from "zod";
import type { webTurnSchema } from "../../src/web-contract";
type Turn = z.infer<typeof webTurnSchema>;
mock.module("cloudflare:workers", () => ({ DurableObject: class {}, WorkerEntrypoint: class {}, RpcTarget: class {} }));
const { PecuDurableObject } = await import("../../src/cloudflare/worker");
const { timedTextContentType, readSseEvents } = await import("../../src/web-stream");
const admitted: Turn[] = [];
const pending: Promise<unknown>[] = [];
// SAFETY: fetch only needs these initialized ports for /internal/web/turn. The real constructor starts external integrations.
const worker = Object.assign(Object.create(PecuDurableObject.prototype), {
  ready: Promise.resolve(),
  webAgent: { busy: () => true, handle: async (input: Turn) => { admitted.push(input); return { status: "complete" }; } },
  ctx: { waitUntil: (work: Promise<unknown>) => pending.push(work) },
}) as InstanceType<typeof PecuDurableObject>;
const input = { userId: "user_alice", senderId: "123", requestId: crypto.randomUUID(), text: "Keep it short" };
const request = (body: Turn) => new Request("https://pecu.test/internal/web/turn", {
  method: "POST", headers: { "Content-Type": "application/json", Accept: timedTextContentType }, body: JSON.stringify(body),
});
expect((await worker.fetch(request(input))).status).toBe(409);
expect(admitted).toHaveLength(0);
const steering = { ...input, steerOf: crypto.randomUUID() };
const response = await worker.fetch(request(steering));
expect(response.status).toBe(200);
const events = [];
for await (const event of readSseEvents(response.body!)) events.push(event);
await Promise.all(pending);
expect(admitted).toEqual([steering]);
expect(events).toContainEqual({ type: "complete", status: "complete" });
console.log("streaming route admits steering while rejecting concurrent ordinary turns");
