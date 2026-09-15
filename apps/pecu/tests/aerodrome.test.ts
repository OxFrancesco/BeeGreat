import { describe, expect, test } from "bun:test";
import { AerodromeService } from "../src/aerodrome";
import { KNOWN_TOKENS } from "@beegreat/sugar";

const wallet = "0x1111111111111111111111111111111111111111" as const;
const other = "0x2222222222222222222222222222222222222222";
const service = new AerodromeService({ baseRpcUrl: "https://example.com", maxSlippageBps: 100 });

describe("Aero request boundary", () => {
  test("common Base symbols resolve to SDK canonical tokens before catalog ambiguity", async () => {
    const bound = new AerodromeService({ baseRpcUrl: "https://example.com", maxSlippageBps: 100 }, async (_action, parameters) => parameters);
    const result = await bound.run(wallet, "quote", { from_token: "usdc", to_token: "AERO", amount: "1", use_decimals: true });
    expect(result.parameters).toMatchObject({ from_token: KNOWN_TOKENS[8453].usdc.tokenAddress, to_token: KNOWN_TOKENS[8453].aero.tokenAddress });
    expect((await bound.run(wallet, "quote", { from_token: "ETH", to_token: other, amount: "1" })).parameters).toMatchObject({ from_token: "ETH", to_token: other });
    expect((await bound.run(wallet, "quote", { from_token: "UNLISTED", to_token: "USDC", amount: "1" })).parameters.from_token).toBe("UNLISTED");
  });
  test("an already balanced SDK index needs no transaction plan", async () => {
    const bound = new AerodromeService({ baseRpcUrl: "https://example.com", maxSlippageBps: 100 }, async () => ({
      transactions: [], transaction_steps: [], trades: [], allocation: [{ symbol: "NVDAc", target_pct: 100 }],
    }));
    expect(await bound.run(wallet, "index_rebalance", { allocations: "NVDAc=100" })).toMatchObject({
      kind: "unchanged", action: "index_rebalance", context: { trades: [], allocation: [{ symbol: "NVDAc", target_pct: 100 }] },
    });
    await expect(bound.run(wallet, "stock_buy", { stock: "NVDAc", amount: "1" })).rejects.toThrow("empty transaction plan");
  });
  test("stock reads use the verified wallet", async () => {
    const bound = new AerodromeService({ baseRpcUrl: "https://example.com", maxSlippageBps: 100 }, async (action, parameters) => {
      expect(action).toBe("stocks");
      expect(parameters).toEqual({ chain: 8453, wallet });
      return [];
    });
    expect((await bound.run(wallet, "stocks", {})).kind).toBe("read");
  });

  test("all stock plans use the configured slippage and verified wallet", async () => {
    const bound = new AerodromeService({ baseRpcUrl: "https://example.com", maxSlippageBps: 50 }, async (_action, parameters) => {
      expect(parameters.wallet).toBe(wallet);
      expect(parameters.slippage).toBe(0.005);
      throw new Error("verified binding");
    });
    for (const action of ["stock_buy", "stock_sell", "index_rebalance"] as const) {
      const parameters: Record<string, string> = action === "index_rebalance" ? { allocations: "NVDAc=50,AAPLc=50" } : { stock: "NVDAc", amount: "1" };
      await expect(bound.run(wallet, action, parameters)).rejects.toThrow("verified binding");
      await expect(bound.run(wallet, action, { ...parameters, slippage: 0.02 })).rejects.toThrow("configured maximum");
    }
  });
  test("rejects a non-Base chain before any RPC call", async () => {
    await expect(service.run(wallet, "pools", { chain: 10 })).rejects.toThrow("Base mainnet");
  });

  test("does not let chat input select a transaction wallet", async () => {
    await expect(service.run(wallet, "stake", { wallet: other, pool: other })).rejects.toThrow("cannot be overridden");
  });

  test("caps user-selected slippage before any RPC call", async () => {
    await expect(service.run(wallet, "swap", {
      from_token: "ETH", to_token: "USDC", amount: "1", use_decimals: true, slippage: 0.02,
    })).rejects.toThrow("configured maximum");
  });
});
