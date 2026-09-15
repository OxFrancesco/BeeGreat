import { expect, test } from "bun:test";
import { validateSugarRequest } from "@beegreat/sugar";
import { SUGAR_ACTIONS } from "@beegreat/sugar/contracts";
import { z } from "zod";
import { aeroTools } from "../src/cloudflare/aero-tools";

test("stock tools expose purchase units and index allocations from the SDK", () => {
  for (const action of ["stocks", "stock_buy", "stock_sell", "index_rebalance"]) {
    expect(aeroTools.find((tool) => tool.action === action)).toBeDefined();
  }
  const buy = aeroTools.find((tool) => tool.action === "stock_buy")!;
  expect(buy.input.parse({ stock: "NVDAc", amount: "1" })).toEqual({ stock: "NVDAc", amount: "1" });
  expect(buy.description).toContain("USDC");
  const sell = aeroTools.find((tool) => tool.action === "stock_sell")!;
  expect(sell.description).toContain("stock token units");
  const index = aeroTools.find((tool) => tool.action === "index_rebalance")!;
  expect(index.input.parse({ allocations: "NVDAc=50,AAPLc=50", cash: "10" })).toEqual({ allocations: "NVDAc=50,AAPLc=50", cash: "10" });
});

test("every SDK action has an object schema without wallet or chain overrides", () => {
  expect(aeroTools.map((tool) => tool.action).sort()).toEqual([...SUGAR_ACTIONS].sort());
  for (const tool of aeroTools) {
    const schema = z.toJSONSchema(tool.input);
    expect(schema.type).toBe("object");
    expect(schema.additionalProperties).toBe(false);
    expect(schema.properties).not.toHaveProperty("wallet");
    expect(schema.properties).not.toHaveProperty("chain");
  }
});

test("the first quote call exposes the real SDK keys and defaults human token amounts", () => {
  const tool = aeroTools.find((tool) => tool.action === "quote")!;
  const schema = z.toJSONSchema(tool.input);
  expect(schema.required).toEqual(expect.arrayContaining(["from_token", "to_token", "amount"]));
  const parameters = tool.input.parse({ from_token: "ETH", to_token: "USDC", amount: "0.001" });
  expect(parameters.use_decimals).toBe(true);
  expect(validateSugarRequest("quote", { ...parameters, chain: 8453 })).toMatchObject({ amount: "0.001", use_decimals: true });
  expect(tool.input.safeParse({ token_in: "ETH", token_out: "USDC", amount: "0.001" }).success).toBe(false);
  expect(tool.input.safeParse({ from_token: "ETH", to_token: "USDC", amount: "0.001", wallet: "0x123" }).success).toBe(false);
  expect(tool.input.parse({ from_token: "ETH", to_token: "USDC", amount: "1000000000000000", use_decimals: false }).use_decimals).toBe(false);
});
