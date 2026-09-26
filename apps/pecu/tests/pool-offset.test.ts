import { expect, test } from "bun:test";
import { nearbyPoolOffset } from "../src/pool-offset";

test("finds a shifted pool with one bounded read instead of a full catalog scan", async () => {
  let calls = 0;
  const offset = await nearbyPoolOffset("0xAB", 100, async (limit, start) => {
    calls++;
    expect(limit).toBe(33);
    expect(start).toBe(84);
    return Array.from({length:33}, (_, i) => [i === 17 ? "0xab" : "0x00"]);
  });
  expect(offset).toBe(101);
  expect(calls).toBe(1);
});

test("clamps the first window and never accepts another pool at the cached offset", async () => {
  expect(await nearbyPoolOffset("target", 2, async (limit, start) => {
    expect(start).toBe(0);
    expect(limit).toBe(33);
    return [["wrong"], ["target"]];
  })).toBe(1);
  expect(await nearbyPoolOffset("target", 100, async () => [["wrong"]])).toBeUndefined();
});
