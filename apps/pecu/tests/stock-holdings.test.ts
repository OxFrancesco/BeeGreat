import { expect, test } from "bun:test";
import { stockHoldings } from "../apps/stocks/src/lib/holdings";
import { parseCommand, parseNaturalWalletCommand } from "../src/domain";
import type { z } from "zod";
import type { stockSchema } from "../src/stock-contract";
const stock = (symbol: string, balance: string | null, price_usdc: string | null): z.infer<typeof stockSchema> => ({ symbol, name: symbol, balance, price_usdc, address: `0x${"1".repeat(40)}`, error: null });
test("stock commands and common ownership questions use the stock tool", () => {
  for (const command of ["/stocks", "/aero stocks", "b/stocks"]) expect(parseCommand(command)).toEqual({ type: "aero", action: "stocks", parameters: {} });
  for (const question of ["How many stocks do I own?", "Show my stock holdings", "Which stocks do I have?"]) expect(parseNaturalWalletCommand(question)).toEqual({ type: "aero", action: "stocks", parameters: {} });
  expect(parseNaturalWalletCommand("sell my stocks")).toBeUndefined();
});
test("allocation uses value rather than number of shares and excludes unowned stocks", () => {
  const result = stockHoldings([stock("A", "2", "150"), stock("B", "10", "10"), stock("C", "0", null)]);
  expect(result.total).toBe(400);
  expect(result.chart).toEqual([{ symbol: "A", value: 300 }, { symbol: "B", value: 100 }]);
  expect(result.partial).toBe(false);
});
test("unavailable and malformed data never becomes a fabricated slice", () => {
  const result = stockHoldings([stock("A", "2", null), stock("B", null, "10"), stock("C", "NaN", "1"), stock("D", "1", "Infinity")]);
  expect(result.chart).toEqual([]);
  expect(result.rows).toHaveLength(2);
  expect(result.partial).toBe(true);
  expect(stockHoldings([stock("A", "0", "1")]).rows).toEqual([]);
  expect(stockHoldings([stock("A", "1e308", "1e308")]).chart).toEqual([]);
});
