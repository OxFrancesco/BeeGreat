import { describe, expect, test } from "bun:test";
import { SUGAR_ACTIONS } from "@beegreat/sugar/contracts";
import { chatCommands } from "../src/commands";
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

describe("command reference", () => {
  const concreteArgs = new Map<string, string>([
    ["/quote", "0.001 ETH to USDC"],
    ["/swap", "0.001 ETH to USDC"],
    ["/send", "1 USDC to 0x1111111111111111111111111111111111111111"],
    ["/token", "USDC"],
    ["/allowance", "USDC for 0x1111111111111111111111111111111111111111"],
    ["/approve", "1 USDC for 0x1111111111111111111111111111111111111111"],
    ["/revoke", "USDC for 0x1111111111111111111111111111111111111111"],
    ["/confirm", "ABC123"],
    ["/cancel", "ABC123"],
    ["/polymarket", "Will the Fed cut rates?"],
  ]);

  test("every documented command parses without an unknown-command error", () => {
    for (const entry of chatCommands) {
      const example = concreteArgs.get(entry.command) ?? "";
      const input = `${entry.command}${example ? ` ${example}` : ""}`;
      expect(() => parseCommand(input), input).not.toThrow();
    }
  });
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
    "stocks",
    "my stocks",
    "my stock holdings",
    "check my stock holdings",
    "list my stocks",
    "view my stock portfolio",
    "what stocks do I own",
    "which stocks do I hold",
    "how many stocks do I have",
    "what's in my stock portfolio",
  ])("routes stock holdings requests without relying on model tool choice: %s", (input) => {
    expect(parseNaturalWalletCommand(input)).toEqual({ type: "aero", action: "stocks", parameters: {} });
  });

  test.each([
    "What is the USDC address?",
    "Show me pools with the best APR",
    "Can you quote 0.01 ETH to USDC?",
  ])("leaves non-wallet requests to the agent: %s", (input) => {
    expect(parseNaturalWalletCommand(input)).toBeUndefined();
  });
});

describe("deposit command grammar", () => {
  test("parses /deposit variants", () => {
    expect(parseCommand("/deposit")).toEqual({ type: "deposit" });
    expect(parseCommand("/deposit 50")).toEqual({ type: "deposit", amount: "50" });
    expect(parseCommand("/deposit 50.5")).toEqual({ type: "deposit", amount: "50.5" });
    expect(parseCommand("/deposit status")).toEqual({ type: "deposit-status" });
    expect(parseCommand("/deposit setup User@Example.COM")).toEqual({ type: "deposit-setup", email: "user@example.com" });
  });

  test.each(["/deposit 5", "/deposit 0", "/deposit abc", "/deposit setup not-an-email", "/deposit 50 60", "/deposit setup"])(
    "rejects unsafe or unsupported input: %s",
    (input) => expect(() => parseCommand(input)).toThrow("Usage: /deposit"),
  );

  test.each([
    "add funds",
    "add money to my wallet",
    "deposit money",
    "top up my wallet",
    "fund my wallet",
    "how do i add money",
  ])("routes funding requests without relying on model tool choice: %s", (input) => {
    expect(parseNaturalWalletCommand(input)).toEqual({ type: "deposit" });
  });
});

describe("nansen command grammar", () => {
  test("parses /nansen variants", () => {
    expect(parseCommand("/nansen")).toEqual({ type: "nansen-help" });
    expect(parseCommand("/nansen help")).toEqual({ type: "nansen-help" });
    expect(parseCommand("/nansen token 0xabc ethereum 7d")).toEqual({ type: "nansen", endpoint: "token_info", input: { token: "0xabc", chain: "ethereum", timeframe: "7d" } });
    expect(parseCommand("/nansen flows 0xabc arbitrum")).toEqual({ type: "nansen", endpoint: "token_flow_intelligence", input: { token: "0xabc", chain: "arbitrum" } });
    expect(parseCommand("/nansen wallet")).toEqual({ type: "nansen", endpoint: "wallet_balances", input: {} });
    expect(parseCommand("/nansen wallet base")).toEqual({ type: "nansen", endpoint: "wallet_balances", input: { chain: "base" } });
    expect(parseCommand("/nansen wallet 0xabc ethereum")).toEqual({ type: "nansen", endpoint: "wallet_balances", input: { chain: "ethereum", address: "0xabc" } });
    expect(parseCommand("/nansen pnl solana")).toEqual({ type: "nansen", endpoint: "wallet_pnl_breakdown", input: { chain: "solana" } });
    expect(parseCommand("/nansen markets fed rate cut")).toEqual({ type: "nansen", endpoint: "prediction_markets", input: { query: "fed rate cut" } });
    expect(parseCommand("/nansen markets")).toEqual({ type: "nansen", endpoint: "prediction_markets", input: {} });
  });

  test.each(["/nansen token", "/nansen token 0xabc mars", "/nansen wallet nope!", "/nansen flows 0xabc 30d", "/nansen bogus"])(
    "rejects unsafe or unsupported input: %s",
    (input) => expect(() => parseCommand(input)).toThrow("Usage: /nansen"),
  );
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

 test.each(["show my portfolio", "what am I holding", "show my crypto portfolio"])("general portfolio requests use Nansen: %s", (input) => {
  expect(parseNaturalWalletCommand(input)).toEqual({ type: "nansen", endpoint: "wallet_portfolio", input: {} });
});
