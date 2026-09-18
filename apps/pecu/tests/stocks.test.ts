import { describe, expect, test } from "bun:test";
import type { Quote, Token, UnsignedTransaction } from "@beegreat/sugar";
import { STOCK_USDC, STOCKS } from "../node_modules/@beegreat/sugar/src/stocks/catalog";
import { stockBasketPlan, stockSnapshot, type StockClient } from "../src/stocks";

const wallet = "0x1111111111111111111111111111111111111111" as const;
const router = "0x5555555555555555555555555555555555555555" as const;
const settings = { chainId: 8453, chainName: "base", sugarContractAddress: "0x0000000000000000000000000000000000000001" } as never;

function row(address: string, symbol: string, decimals: number, balance: bigint, listed = true, emerging = false): unknown[] {
  return [address, symbol, decimals, balance, listed, emerging];
}

function usdc(): Token {
  return { chainId: 8453, chainName: "base", tokenAddress: STOCK_USDC, symbol: "USDC", decimals: 6, listed: true, emerging: false };
}

function stockToken(stock: (typeof STOCKS)[number]): Token {
  return { chainId: 8453, chainName: "base", tokenAddress: stock.address, symbol: stock.symbol, decimals: 18, listed: true, emerging: false };
}

function catalogRows(usdcBalance = 1_000_000_000n, stockBalance = 1_500_000_000_000_000_000n): unknown[][] {
  return [row(STOCK_USDC, "USDC", 6, usdcBalance), ...STOCKS.map((stock) => row(stock.address, stock.symbol, 18, stockBalance))];
}

function client(overrides: Partial<StockClient> & { rows?: unknown[][] } = {}): StockClient {
  const { rows = catalogRows(), ...rest } = overrides;
  return {
    settings,
    publicClient: { readContract: async () => rows },
    getPrices: async () => [],
    getQuote: async () => undefined,
    swapBasketFromQuotes: async () => [],
    ...rest,
  } as unknown as StockClient;
}

function prices(entries: Array<{ address: string; price: number }>): StockClient["getPrices"] {
  return async () => entries.map(({ address, price }) => ({
    token: { chainId: 8453 as const, chainName: "base", tokenAddress: address, symbol: address, decimals: 18, listed: true, emerging: false },
    price,
  }));
}

const calls: UnsignedTransaction[] = [
  { from: wallet, to: STOCK_USDC, data: `0x095ea7b3${"0".repeat(128)}`, value: 0n },
  { from: wallet, to: router, data: "0x24856bc3", value: 0n },
];

describe("stockSnapshot", () => {
  test("returns every catalog stock in order with prices and balances", async () => {
    const result = await stockSnapshot(client({
      getPrices: prices([...STOCKS.map((stock, index) => ({ address: stock.address, price: 100 + index })), { address: STOCK_USDC, price: 1 }]),
    }), wallet);
    expect(result.map((stock) => stock.symbol)).toEqual(STOCKS.map((stock) => stock.symbol));
    expect(result[0]).toEqual({ symbol: "NVDAc", name: "NVIDIA", address: STOCKS[0]!.address, price_usdc: "100", balance: "1.5", error: null });
    expect(result.every((stock) => stock.price_usdc !== null && stock.error === null)).toBe(true);
  });

  test("ignores extra catalog rows and formats balances with token decimals", async () => {
    const rows = [...catalogRows(), row("0x9999999999999999999999999999999999999999", "EXTRA", 18, 1n)];
    const result = await stockSnapshot(client({
      rows,
      getPrices: prices(STOCKS.map((stock) => ({ address: stock.address, price: 12.3456789 }))),
    }), wallet);
    expect(result).toHaveLength(STOCKS.length);
    expect(result[0]!.price_usdc).toBe("12.345678");
    expect(result[0]!.balance).toBe("1.5");
  });

  test("an unpriced stock reports an error but keeps its balance", async () => {
    const result = await stockSnapshot(client({
      getPrices: prices(STOCKS.slice(0, 2).map((stock) => ({ address: stock.address, price: 50 }))),
    }), wallet);
    const missing = result.find((stock) => stock.symbol === "MSTRc");
    expect(missing?.price_usdc).toBeNull();
    expect(missing?.error).toBe("Price unavailable");
    expect(missing?.balance).toBe("1.5");
    const priced = result.find((stock) => stock.symbol === "NVDAc");
    expect(priced?.price_usdc).toBe("50");
    expect(priced?.error).toBeNull();
  });

  test("a missing token row reports an error with a null balance", async () => {
    const rows = catalogRows().filter((item) => String(item[0]).toLowerCase() !== STOCKS[3]!.address);
    const result = await stockSnapshot(client({ rows }), wallet);
    const missing = result.find((stock) => stock.symbol === "METAc");
    expect(missing?.price_usdc).toBeNull();
    expect(missing?.balance).toBeNull();
    expect(missing?.error).toBe("Price unavailable");
  });
});

describe("stockBasketPlan", () => {
  test("rejects an unknown stock", async () => {
    await expect(stockBasketPlan(client(), wallet, [{ side: "buy", stock: "NOPE", amount: "1" }], 0.01)).rejects.toThrow("Unknown stock");
  });

  test("rejects a repeated stock and direction pair", async () => {
    await expect(stockBasketPlan(client(), wallet, [
      { side: "buy", stock: "NVDAc", amount: "1" },
      { side: "buy", stock: "nvda", amount: "2" },
    ], 0.01)).rejects.toThrow("Combine repeated trades");
  });

  test("rejects buys beyond the wallet's USDC balance", async () => {
    await expect(stockBasketPlan(client({ rows: catalogRows(5_000_000n) }), wallet, [
      { side: "buy", stock: "NVDAc", amount: "6" },
      { side: "buy", stock: "AAPLc", amount: "5" },
    ], 0.01)).rejects.toThrow("Insufficient USDC balance");
  });

  test("rejects a sell beyond the stock balance", async () => {
    await expect(stockBasketPlan(client({ rows: catalogRows(1_000_000_000n, 500_000_000_000_000_000n) }), wallet, [
      { side: "sell", stock: "NVDAc", amount: "1" },
    ], 0.01)).rejects.toThrow("Insufficient NVDAc balance");
  });

  test("rejects a trade without an executable route", async () => {
    await expect(stockBasketPlan(client({ getQuote: async () => undefined }), wallet, [
      { side: "buy", stock: "NVDAc", amount: "1" },
    ], 0.01)).rejects.toThrow("No executable route");
  });

  test("plans a two-trade basket as approvals followed by one action", async () => {
    let requested = 0;
    const plan = await stockBasketPlan(client({
      getQuote: async (fromToken: Token, toToken: Token, amountIn: bigint): Promise<Quote> => {
        requested++;
        return { input: { fromToken, toToken, path: [], amountIn }, amountOut: toToken.symbol === "USDC" ? 250_000_000n : 2_000_000_000_000_000n };
      },
      swapBasketFromQuotes: async (quotes, slippage) => {
        expect(quotes).toHaveLength(2);
        expect(slippage).toBe(0.01);
        return calls;
      },
    }), wallet, [
      { side: "buy", stock: "NVDAc", amount: "1" },
      { side: "sell", stock: "AAPLc", amount: "0.5" },
    ], 0.01);
    expect(requested).toBe(2);
    expect(plan.transaction_steps.map((step) => step.role)).toEqual(["approval", "action"]);
    expect(plan.slippage).toBe(0.01);
    expect(plan.trades).toHaveLength(2);
    const buy = plan.trades[0]!;
    expect(buy.from).toBe("USDC");
    expect(buy.to).toBe("NVDAc");
    expect(buy.amount).toBe("1");
    expect(buy.amount_raw).toBe("1000000");
    expect(buy.expected).toBe("0.002");
    expect(buy.minimum_raw).toBe("1980000000000000");
    expect(buy.minimum).toBe("0.00198");
    const sell = plan.trades[1]!;
    expect(sell.from).toBe("AAPLc");
    expect(sell.to).toBe("USDC");
    expect(sell.amount).toBe("0.5");
    expect(sell.expected).toBe("250");
    expect(sell.minimum).toBe("247.5");
  });
});
