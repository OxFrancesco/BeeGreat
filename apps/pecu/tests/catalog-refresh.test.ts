import { expect, test } from "bun:test";
import { CatalogRefresh } from "../src/cloudflare/catalog-refresh";

test("concurrent catalog misses share one refresh and failed refreshes can retry", async () => {
  let reads = 0;
  let now = 100;
  let fail = false;
  const coordinator = new CatalogRefresh(async () => {
    reads++;
    await Promise.resolve();
    if (fail) throw new Error("RPC unavailable");
    return { value: [reads], expiresAt: now + 10 };
  }, () => now);
  expect(await Promise.all([coordinator.get("tokens"), coordinator.get("tokens")])).toEqual([
    { value: [1], expiresAt: 110 }, { value: [1], expiresAt: 110 },
  ]);
  expect(reads).toBe(1);
  now = 111;
  fail = true;
  await expect(coordinator.get("tokens")).rejects.toThrow("RPC unavailable");
  fail = false;
  expect((await coordinator.get("tokens")).value).toEqual([3]);
});

test("background refresh preserves a valid snapshot until the replacement is ready", async () => {
  let resolve!: (value: { value: number[]; expiresAt: number }) => void;
  let reads = 0;
  const coordinator = new CatalogRefresh(async () => ++reads === 1
    ? { value: [1], expiresAt: 1000 }
    : new Promise<{ value: number[]; expiresAt: number }>(done => { resolve = done; }), () => 100);
  await coordinator.get("pools");
  const refresh = coordinator.get("pools", true);
  expect((await coordinator.get("pools")).value).toEqual([1]);
  resolve({ value: [2], expiresAt: 2000 });
  await refresh;
  expect((await coordinator.get("pools")).value).toEqual([2]);
});
