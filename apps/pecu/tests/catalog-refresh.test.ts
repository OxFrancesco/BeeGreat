import { expect, test } from "bun:test";
import { CatalogRefresh, keepWarmDecision, nextCatalogFailure } from "../src/cloudflare/catalog-refresh";

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

test("keep-warm ticks refresh only demanded catalogs near expiry and back off up to thirty minutes", () => {
  const now = 10_000_000;
  const demanded = { now, lastDemandAt: now - 60_000, failure: undefined };
  expect(keepWarmDecision({ ...demanded, lastDemandAt: undefined, snapshot: undefined })).toBe("idle");
  expect(keepWarmDecision({ ...demanded, lastDemandAt: now - 31 * 60_000, snapshot: undefined })).toBe("idle");
  expect(keepWarmDecision({ ...demanded, snapshot: { value: 1, expiresAt: now + 120_000 } })).toBe("fresh");
  expect(keepWarmDecision({ ...demanded, snapshot: { value: 1, expiresAt: now + 60_000 } })).toBe("refresh");
  let failure = nextCatalogFailure(undefined, now, { stage: "rpc", code: "RPC_RATE_LIMITED" });
  expect(failure.notBefore - now).toBe(60_000);
  expect(keepWarmDecision({ ...demanded, snapshot: undefined, failure })).toBe("deferred");
  expect(keepWarmDecision({ ...demanded, now: failure.notBefore, snapshot: undefined, failure })).toBe("refresh");
  for (let attempt = 0; attempt < 8; attempt++) failure = nextCatalogFailure(failure, now, { stage: "rpc" });
  expect(failure).toMatchObject({ failures: 9, notBefore: now + 30 * 60_000 });
});
