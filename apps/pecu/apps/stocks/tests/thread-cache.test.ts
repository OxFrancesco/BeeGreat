import { expect, test } from "bun:test";
import {
  trimThreadCache,
  THREAD_CACHE_BYTES,
  THREAD_CACHE_LIMIT,
  historyBytes,
} from "../src/lib/thread-cache";
const entry = (bytes = 100) => ({
  state: { messages: [] },
  bytes,
  pending: false,
  retry: null as unknown,
});
test("retains recent histories and evicts oldest at the count and byte budgets", () => {
  const cache = new Map<string, ReturnType<typeof entry>>();
  for (let i = 0; i < 1000; i++) {
    cache.set(String(i), entry());
    trimThreadCache(cache, String(i));
  }
  expect(cache.size).toBe(THREAD_CACHE_LIMIT);
  expect(cache.has("0")).toBe(false);
  expect(cache.has("999")).toBe(true);
  cache.set("large", entry(THREAD_CACHE_BYTES));
  trimThreadCache(cache, "large");
  expect(cache.size).toBe(1);
});
test("eviction preserves pending and retry controls; oversized active page remains readable", () => {
  const cache = new Map([
    ["pending", { ...entry(), pending: true }],
    ["retry", { ...entry(), retry: { text: "draft" } }],
    ["active", entry(THREAD_CACHE_BYTES + 1)],
  ]);
  trimThreadCache(cache, "active");
  expect(cache.get("pending")).toMatchObject({
    pending: true,
    state: null,
    bytes: 0,
  });
  expect(cache.get("retry")).toMatchObject({
    retry: { text: "draft" },
    state: null,
    bytes: 0,
  });
  expect(cache.get("active")?.state).not.toBeNull();
  expect(historyBytes("é")).toBe(4);
});
