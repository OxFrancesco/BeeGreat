import { describe, expect, test } from "bun:test";
import { aeroReadText, aeroPlanText, chatError, evmReadText, quoteText, readableResult, verbosePage } from "../src/chat";
import { parseCommand } from "../src/domain";

const quote = {
  from_token: { symbol: "ETH", decimals: 18 },
  to_token: { symbol: "USDC", decimals: 6 },
  amount_in: "1000000000000", amount_out: "2519", min_amount_out: "2494",
};

describe("plain-language chat", () => {
  test("liquidity previews show both exact quoted amounts before pool metadata", () => {
    const reply = aeroPlanText({ kind: "transaction", action: "deposit", parameters: { amount0: "0.1" }, calls: [], context: {
      deposit: { pool: { symbol: "vAMM-USDC/AERO", lp: "0xpool", is_cl: false, type_label: "volatile", token0: "USDC", token0_address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", token1: "AERO", token1_address: "0x940181a94A35A4569E4529A3CDfB74e38FD98631" }, amount0: "100000", amount1: "140000000000000001", amount0_decimal: 0.1, amount1_decimal: 0.14 },
    } });
    expect(reply).toContain("0.1 USDC");
    expect(reply).toContain("0.140000000000000001 AERO");
    expect(reply).toContain("vAMM-USDC/AERO");
    expect(reply).not.toContain("0xpool");
  });
  test("shows exact dust amounts and the minimum received without technical output", () => {
    const reply = aeroPlanText({ kind: "transaction", action: "swap", parameters: {}, context: { quote }, calls: [] });
    expect(reply).toBe("Swap 0.000001 ETH for about 0.002519 USDC on Base.\nMinimum received: 0.002494 USDC\nNetwork fee: not estimated yet.");
    expect(reply).not.toContain("{");
    expect(quoteText({ ...quote, amount_in: "1" })).toBe("0.000000000000000001 ETH ≈ 0.002519 USDC");
  });

  test("token reads use human units and allowances keep the spender", () => {
    expect(evmReadText({ kind: "read", command: "token", output: { token: "USDC", amount: "0.002519", amount_base_units: "2519", block: "123" } })).toBe("USDC: 0.002519");
    expect(evmReadText({ kind: "read", command: "allowance", output: { token: "USDC", amount: "0", spender: "0x123" } })).toBe("0x123 can spend 0 USDC.");
    expect(readableResult({ value: "42", abi: [{ internal: "hidden" }], block: "123" })).toBe("Value: 42");
  });

  test("verbose pages retain all bytes without another tool call", () => {
    expect(parseCommand("b/verbose")).toEqual({ type: "verbose", page: 1 });
    expect(parseCommand("/verbose 2")).toEqual({ type: "verbose", page: 2 });
    expect(() => parseCommand("b/verbose 0")).toThrow();
    expect(() => parseCommand("b/verbose 9007199254740992")).toThrow();
    const json = JSON.stringify({ values: "x".repeat(3000) });
    expect(verbosePage(json, 1)).toContain(json.slice(0, 2800));
    expect(verbosePage(json, 2)).toContain(json.slice(2800));
    expect(verbosePage(undefined, 1)).toContain("No technical details yet");
  });

  test("service JSON errors do not spill into ordinary replies", () => {
    expect(chatError(new Error('{"error":true,"message":"Missing required scopes: wallets:transactions.read"}'))).toContain("wallet permission is missing");
    expect(chatError(new Error('{"error":{"stack":"internal"}}'))).not.toContain("{");
    expect(chatError(new Error("Insufficient ETH: balance 0, requested 1"))).toContain("Insufficient ETH");
  });
});

 test("stock list includes every supported symbol without technical fields", () => {
  const stocks = Array.from({ length: 10 }, (_, i) => ({ symbol: `STOCK${i}c`, name: `Company ${i}`, address: "0xhidden", price_usdc: "12.34", balance: "0", error: null }));
  const reply = aeroReadText("stocks", stocks);
  for (const stock of stocks) expect(reply).toContain(stock.symbol);
  expect(reply).not.toContain("0xhidden");
  expect(reply).toContain("12.34 USDC");
});

test("stock trade replies keep human amounts and minimums", () => {
  const reply = aeroPlanText({ kind: "transaction", action: "stock_buy", parameters: {}, calls: [], context: { trades: [{ from: "USDC", to: "NVDAc", amount: "0.01", expected: "0.00004797", minimum: "0.0000475", amount_raw: "10000", minimum_raw: "4750", from_address: "0xhidden" }] } });
  expect(reply).toContain("0.01 USDC → about 0.00004797 NVDAc");
  expect(reply).toContain("Minimum received: 0.0000475 NVDAc");
  expect(reply).not.toContain("raw");
  expect(reply).not.toContain("0xhidden");
});
