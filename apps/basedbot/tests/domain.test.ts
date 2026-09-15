import { describe, expect, test } from "bun:test";
import { SUGAR_ACTIONS } from "@beegreat/sugar/contracts";
import { parseCommand, parseNaturalWalletCommand } from "../src/domain";

describe("command grammar", () => {
  test("keeps the simple swap alias while routing it through Aero", () => {
    expect(parseCommand("/swap 0.01 eth to usdc")).toEqual({
      type: "aero",
      action: "swap",
      parameters: { amount: "0.01", from_token: "eth", to_token: "usdc", use_decimals: true },
    });
  });

  test("exposes every SDK action with CLI hyphen normalization", () => {
    const parsed = SUGAR_ACTIONS.map((action) => parseCommand(`/aero ${action.replaceAll("_", "-")}`));
    expect(parsed.map((command) => command.type === "aero" ? command.action : undefined)).toEqual([...SUGAR_ACTIONS]);
  });

  test("uses the Aero CLI parser for typed flags", () => {
    expect(parseCommand("/aero pools --token0 USDC --limit=5 --full --no-use-decimals")).toEqual({
      type: "aero",
      action: "pools",
      parameters: { token0: "USDC", limit: 5, full: true, use_decimals: false },
    });
  });

  test("parses the documented veNFT lock duration as a number", () => {
    const command = parseCommand("/aero create-venft --amount 1 --lock-duration-seconds 31536000 --use-decimals");
    expect(command.type).toBe("aero");
    if (command.type !== "aero") throw new Error("expected Aero command");
    expect(command.parameters.lock_duration_seconds).toBe(31536000);
  });

  test("parses scoped confirmation codes", () => {
    expect(parseCommand("confirm ab12cd")).toEqual({ type: "confirm", code: "AB12CD" });
  });

  test.each(["/swap -1 ETH to USDC", "/swap 1 ETH to ETH", "/aero nope", "/send 1 ETH"])(
    "rejects unsafe or unsupported input: %s",
    (input) => expect(() => parseCommand(input)).toThrow(),
  );
});

describe("natural wallet commands", () => {
  test.each([
    "What's my address?",
    "What is my wallet address?",
    "How can I create a wallet?",
    "Show me my Base wallet",
  ])("routes verified wallet lookup without relying on model tool choice: %s", (input) => {
    expect(parseNaturalWalletCommand(input)).toEqual({ type: "wallet" });
  });

  test.each([
    "What's my balance?",
    "Check my wallet balance",
    "How much ETH do I have?",
  ])("routes verified balance lookup without relying on model tool choice: %s", (input) => {
    expect(parseNaturalWalletCommand(input)).toEqual({ type: "balance" });
  });

  test.each([
    "What is the USDC address?",
    "Show me pools with the best APR",
    "Can you quote 0.01 ETH to USDC?",
  ])("leaves non-wallet requests to the agent: %s", (input) => {
    expect(parseNaturalWalletCommand(input)).toBeUndefined();
  });
});

describe("generic EVM command grammar", () => {
  const spender = "0x3333333333333333333333333333333333333333";

  test("parses transfers, allowances, and token reads", () => {
    expect(parseCommand(`/send 10 USDC to ${spender}`)).toEqual({ type: "evm", action: "transfer", parameters: { amount: "10", token: "USDC", to: spender } });
    expect(parseCommand(`/approve 2.5 usdc for ${spender}`)).toEqual({ type: "evm", action: "approve", parameters: { amount: "2.5", token: "usdc", spender } });
    expect(parseCommand(`/revoke USDC for ${spender}`)).toEqual({ type: "evm", action: "revoke", parameters: { token: "USDC", spender } });
    expect(parseCommand("/token 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913")).toEqual({ type: "token", token: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" });
    expect(parseCommand(`/allowance USDC for ${spender}`)).toEqual({ type: "allowance", token: "USDC", spender });
  });

  test("rejects malformed amounts, addresses, and shapes with usage hints", () => {
    expect(() => parseCommand(`/send 0 USDC to ${spender}`)).toThrow("positive decimal");
    expect(() => parseCommand("/send 1 USDC to notanaddress")).toThrow("Usage: /send");
    expect(() => parseCommand(`/send 1 USDC ${spender}`)).toThrow("Usage: /send");
    expect(() => parseCommand(`/approve USDC for ${spender}`)).toThrow("Usage: /approve");
    expect(() => parseCommand("/token")).toThrow("Usage: /token");
  });
});
