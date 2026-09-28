import { expect, test } from "bun:test";
import { compactPositionAmount, legacyPositions, positionSnapshotSchema, positionSummary, readPositionSnapshot } from "../src/position-contract";
import { Store } from "../src/store";
import { aeroReadText } from "../src/chat";

const pool = "0xb2cc224c1c9feE385f8ad6a55b4d94E92359DC59";
const raw = { id: "77018794", chain_name: "Base", pool: { symbol: "CL100-WETH/USDC", lp: pool, token0: { symbol: "WETH", decimals: 18 }, token1: { symbol: "USDC", decimals: 6 } }, amount_token0: "641062895327367", amount_token1: "2004739", staked_token0: "0", staked_token1: "0" };

test("positions preserve exact token units without floating point", () => {
  const result = readPositionSnapshot([raw], 123)!;
  expect(result.positions[0].token0.unstaked).toBe("0.000641062895327367");
  expect(result.positions[0].token1.unstaked).toBe("2.004739");
  expect(positionSnapshotSchema.parse(result)).toEqual(result);
  expect(readPositionSnapshot([{ ...raw, amount_token0: "unknown" }])).toBeUndefined();
  expect(readPositionSnapshot([{ ...raw, pool: { ...raw.pool, token0: { symbol: "WETH", decimals: -1 } } }])).toBeUndefined();
});

test("compact text retains nonzero dust and marks truncated precision", () => {
  expect(compactPositionAmount("0.0000000001")).toBe("<0.000001");
  expect(compactPositionAmount("2.004739")).toBe("≈2.004");
  expect(compactPositionAmount("0.000641062895327367")).toBe("≈0.000641");
  expect(compactPositionAmount("2.000000")).toBe("2");
  expect(compactPositionAmount("0")).toBe("0");
  const text = positionSummary(readPositionSnapshot(Array.from({ length: 5 }, (_, index) => ({ ...raw, id: `${index}` })))!);
  expect(text.split("\n")).toHaveLength(4);
  expect(text).not.toContain(pool);
  expect(text).not.toContain("0 WETH");
  expect(aeroReadText("positions", [])).toBe("You have no liquidity positions.");
});

test("position snapshot is persisted for the web reply", () => {
  const store = new Store(":memory:");
  const snapshot = readPositionSnapshot([raw], 123)!;
  store.savePositionSnapshot("positions-event", snapshot);
  expect(store.positionSnapshot("positions-event")).toEqual(snapshot);
  expect(store.positionSnapshot("other-event")).toBeUndefined();
});

test("Android and web share exact historical positions and formatting fixtures", async () => {
  const fixture = await Bun.file(new URL("../apps/android/app/src/test/resources/positions.json", import.meta.url)).json();
  const snapshot = positionSnapshotSchema.parse(fixture.snapshot);
  expect(legacyPositions(fixture.legacy)).toEqual(snapshot.positions);
  expect(legacyPositions(`Warning: incomplete result\n${fixture.legacy}`)).toBeUndefined();
  expect(legacyPositions(`${fixture.legacy}\nDo not stake these.`)).toBeUndefined();
  expect(legacyPositions(fixture.legacy.replace("Staked: 0 WETH", "Staked: 0 ETH"))).toBeUndefined();
  expect(legacyPositions("Just ordinary prose")).toBeUndefined();
  for (const item of fixture.amounts) expect(compactPositionAmount(item.exact)).toBe(item.compact);
});
