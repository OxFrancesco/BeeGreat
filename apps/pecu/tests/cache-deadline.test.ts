import { expect, test } from "bun:test";
import { cacheDeadline } from "../src/cloudflare/cache-deadline";
import { AeroCache } from "../src/cloudflare/aero-cache";
import { z } from "zod";

test("a stalled public cache operation yields to its fallback", async () => {
  await expect(cacheDeadline(new Promise<never>(() => {}), 5)).rejects.toThrow("deadline");
  expect(await cacheDeadline(Promise.resolve(42), 5)).toBe(42);
});

test("R2 stalls become cache misses with error telemetry", async () => {
  const operations: string[] = [];
  const cache = new AeroCache(undefined, event => operations.push(event.operation), {
    get: () => new Promise(() => {}), put: async () => {}, delete: async () => {},
  });
  expect(await cache.read("tokens:test", z.array(z.string()))).toBeUndefined();
  expect(operations).toContain("cache.tokens.r2.error");
});
