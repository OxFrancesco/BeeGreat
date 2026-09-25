import type { JsonValue } from "../src/json-contract";
import { expect, test } from "bun:test";
import { ActivityQueue, type ActivityQueueStore } from "../src/cloudflare/activity-queue";

test("activity acknowledgement persists work and failed work survives a new queue instance", async () => {
  const data = new Map<string, JsonValue>();
  let alarm: number | null = null;
  const storage = {
    async put(key: string, value: JsonValue) { data.set(key, value); },
    async list(options: { prefix: string; limit: number }) { return new Map([...data].filter(([key]) => key.startsWith(options.prefix)).sort().slice(0, options.limit)); },
    async delete(key: string) { return data.delete(key); },
    async getAlarm() { return alarm; },
    async setAlarm(value: number) { alarm = value; },
  } satisfies ActivityQueueStore;
  const queue = new ActivityQueue(storage);
  await queue.enqueue({ event: "signed-ciphertext" });
  expect(data.size).toBe(1);
  expect(alarm).not.toBeNull();
  await expect(queue.drain(async () => { throw new Error("temporary failure"); })).rejects.toThrow();
  expect(data.size).toBe(1);
  const reloaded = new ActivityQueue(storage);
  const processed: JsonValue[] = [];
  await reloaded.drain(async (body) => { processed.push(body); });
  expect(processed).toEqual([{ event: "signed-ciphertext" }]);
  expect(await reloaded.pending()).toBe(false);
});
