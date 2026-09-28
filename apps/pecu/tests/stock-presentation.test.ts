import { expect, test } from "bun:test";
import { legacyStockHoldings } from "../src/stock-presentation";
import { stockHoldings } from "../apps/stocks/src/lib/holdings";

const fixture = await Bun.file(new URL("../apps/android/app/src/test/resources/legacy-stocks.json", import.meta.url)).json();

test("the reported historical text becomes an allocation without inventing addresses or a newer timestamp", () => {
  const recovered = legacyStockHoldings(fixture.text, fixture.createdAt)!;
  expect(recovered.observedAt).toBe(fixture.createdAt);
  expect(recovered.stocks).toHaveLength(10);
  expect(recovered.stocks[0]).toEqual({ name: "NVIDIA", symbol: "NVDAc", price_usdc: "212.207177", balance: "0.00004267", error: null });
  expect(recovered.stocks.every(stock => stock.address === undefined)).toBe(true);
  const allocation = stockHoldings(recovered.stocks);
  expect(allocation.chart).toHaveLength(1);
  expect(allocation.chart[0]?.symbol).toBe("NVDAc");
  expect(allocation.total).toBeCloseTo(0.00905488024259, 12);
  expect(allocation.partial).toBe(false);
});

test("surrounding prose, malformed amounts and repeated tickers stay as text", () => {
  expect(legacyStockHoldings(`Incomplete result:\n${fixture.text}`, 1)).toBeUndefined();
  expect(legacyStockHoldings(`${fixture.text}\nDo not trade this.`, 1)).toBeUndefined();
  expect(legacyStockHoldings(fixture.text.replace("212.207177", "NaN"), 1)).toBeUndefined();
  expect(legacyStockHoldings(`${fixture.text}\n\n${fixture.text}`, 1)).toBeUndefined();
  expect(legacyStockHoldings("", 1)).toBeUndefined();
});

test("unavailable balances and prices remain unavailable, not zero", () => {
  const recovered = legacyStockHoldings("NVIDIA, NVDAc\nPrice unavailable\n\nApple, AAPLc\n100 USDC · You hold 2", 1)!;
  const allocation = stockHoldings(recovered.stocks);
  expect(allocation.partial).toBe(true);
  expect(allocation.total).toBe(200);
  expect(allocation.chart).toEqual([{ symbol: "AAPLc", value: 200 }]);
  const unpriced = legacyStockHoldings("NVIDIA, NVDAc\nPrice unavailable · You hold 2", 1)!;
  expect(stockHoldings(unpriced.stocks).chart).toEqual([]);
  expect(stockHoldings(unpriced.stocks).partial).toBe(true);
});
