import { parseSugarCliArgs } from "@beegreat/sugar/cli-args";
import { SUGAR_TX_ACTIONS, type SugarAction, type SugarParameters } from "@beegreat/sugar/contracts";
import { z } from "zod";
import type { EvmTxParameters } from "./evm";

export const BASE_CHAIN_ID = 8453 as const;

export type VerifiedMessage = Readonly<{
  eventId: string;
  conversationId: string;
  senderId: string;
  text: string;
  encodedEvent: string;
  replyConfirmationCode?: string;
}>;

export type Command =
  | Readonly<{ type: "help" }>
  | Readonly<{ type: "wallet" }>
  | Readonly<{ type: "balance" }>
  | Readonly<{ type: "verbose"; page: number }>
  | Readonly<{ type: "yolo"; enabled?: boolean }>
  | Readonly<{ type: "aero-help" }>
  | Readonly<{ type: "aave-help" }>
  | Readonly<{ type: "polymarket"; query?: string }>
  | Readonly<{ type: "aero"; action: SugarAction; parameters: SugarParameters }>
  | Readonly<{ type: "evm"; action: "transfer"; parameters: EvmTxParameters<"transfer"> }>
  | Readonly<{ type: "evm"; action: "approve"; parameters: EvmTxParameters<"approve"> }>
  | Readonly<{ type: "evm"; action: "revoke"; parameters: EvmTxParameters<"revoke"> }>
  | Readonly<{ type: "token"; token: string }>
  | Readonly<{ type: "allowance"; token: string; spender: `0x${string}` }>
  | Readonly<{ type: "confirm"; code: string }>
  | Readonly<{ type: "cancel"; code: string }>;

export type EvmCommand = Extract<Command, { type: "evm" }>;

const decimalAmount = /^(?:0|[1-9]\d*)(?:\.\d{1,18})?$/;
const tokenReference = /^[A-Za-z0-9._:-]{1,256}$/;
const addressReference = /^0x[0-9a-fA-F]{40}$/;

function parseAmount(value: string | undefined, usage: string): string {
  if (!value || !decimalAmount.test(value) || Number(value) <= 0) throw new Error(`Amount must be a positive decimal number. ${usage}`);
  return value;
}

function parseToken(value: string | undefined, usage: string): string {
  if (!value || !tokenReference.test(value)) throw new Error(`Token must be a symbol or public address. ${usage}`);
  return value;
}

function parseAddress(value: string | undefined, usage: string): `0x${string}` {
  if (!value || !addressReference.test(value)) throw new Error(`Expected a public 0x address. ${usage}`);
  return value as `0x${string}`;
}

function parseEvmCommand(verb: "send" | "approve" | "revoke" | "token" | "allowance", parts: string[]): Command {
  switch (verb) {
    case "send": {
      const usage = "Usage: /send 10 USDC to 0x…";
      if (parts.length !== 5 || parts[3]?.toLowerCase() !== "to") throw new Error(usage);
      return { type: "evm", action: "transfer", parameters: { amount: parseAmount(parts[1], usage), token: parseToken(parts[2], usage), to: parseAddress(parts[4], usage) } };
    }
    case "approve": {
      const usage = "Usage: /approve 10 USDC for 0xSPENDER";
      if (parts.length !== 5 || parts[3]?.toLowerCase() !== "for") throw new Error(usage);
      return { type: "evm", action: "approve", parameters: { amount: parseAmount(parts[1], usage), token: parseToken(parts[2], usage), spender: parseAddress(parts[4], usage) } };
    }
    case "revoke": {
      const usage = "Usage: /revoke USDC for 0xSPENDER";
      if (parts.length !== 4 || parts[2]?.toLowerCase() !== "for") throw new Error(usage);
      return { type: "evm", action: "revoke", parameters: { token: parseToken(parts[1], usage), spender: parseAddress(parts[3], usage) } };
    }
    case "token": {
      const usage = "Usage: /token USDC or /token 0xTOKEN";
      if (parts.length !== 2) throw new Error(usage);
      return { type: "token", token: parseToken(parts[1], usage) };
    }
    case "allowance": {
      const usage = "Usage: /allowance USDC for 0xSPENDER";
      if (parts.length !== 4 || parts[2]?.toLowerCase() !== "for") throw new Error(usage);
      return { type: "allowance", token: parseToken(parts[1], usage), spender: parseAddress(parts[3], usage) };
    }
    default: {
      const _exhaustive: never = verb;
      throw new Error(`Unknown command ${String(_exhaustive)}`);
    }
  }
}

function parseConvenienceAction(verb: "quote" | "swap", parts: string[]): Command {
  if (parts.length !== 5 || parts[3]?.toLowerCase() !== "to") {
    throw new Error(`Usage: /${verb} 0.01 ETH to USDC`);
  }
  const amount = parts[1];
  if (!amount || !decimalAmount.test(amount) || Number(amount) <= 0) {
    throw new Error("Amount must be a positive decimal number.");
  }
  const from = parts[2];
  const to = parts[4];
  if (!from || !to || !tokenReference.test(from) || !tokenReference.test(to)) {
    throw new Error("Token references must be symbols or public addresses without spaces.");
  }
  if (from.toLowerCase() === to.toLowerCase()) throw new Error("Choose two different tokens.");
  return {
    type: "aero",
    action: verb,
    parameters: { amount, from_token: from, to_token: to, use_decimals: true },
  };
}

export function parseCommand(input: string): Command {
  const parts = input.trim().replace(/^(?:b)?\//i, "").split(/\s+/);
  const verb = parts[0]?.toLowerCase();
  if (!verb || verb === "help" || verb === "start") return { type: "help" };
  if (verb === "wallet" && parts.length === 1) return { type: "wallet" };
  if (verb === "balance" && parts.length === 1) return { type: "balance" };
  if (verb === "aave" && (parts.length === 1 || parts[1] === "help")) return { type: "aave-help" };
  if (verb === "polymarket") {
    const query = parts.slice(1).join(" ").trim();
    return { type: "polymarket", ...(query && query.toLowerCase() !== "status" ? { query } : {}) };
  }
  if (verb === "yolo") {
    if (!/^(?:b)?\/yolo(?:\s+(?:on|off))?$/i.test(input.trim())) throw new Error("Use /yolo, /yolo on, or /yolo off.");
    return { type: "yolo", ...(parts[1] ? { enabled: parts[1].toLowerCase() === "on" } : {}) };
  }
  if (verb === "verbose") {
    if (parts.length > 2 || (parts[1] !== undefined && !/^[1-9]\d*$/.test(parts[1]))) throw new Error("Use b/verbose or b/verbose 2 for the next page.");
    const page = Number(parts[1] ?? "1");
    if (!Number.isSafeInteger(page)) throw new Error("Choose a valid page number.");
    return { type: "verbose", page };
  }
  if (verb === "quote" || verb === "swap") return parseConvenienceAction(verb, parts);
  if (verb === "send" || verb === "approve" || verb === "revoke" || verb === "token" || verb === "allowance") return parseEvmCommand(verb, parts);
  if (verb === "aero") {
    if (parts.length === 1 || parts[1] === "help" || parts[1] === "--help" || parts[1] === "-h") {
      return { type: "aero-help" };
    }
    const parsed = parseSugarCliArgs(parts.slice(1));
    return { type: "aero", ...parsed };
  }
  if ((verb === "confirm" || verb === "cancel") && parts.length === 2) {
    const code = parts[1]?.toUpperCase();
    if (!code || !/^[A-Z0-9]{6}$/.test(code)) throw new Error("Confirmation codes contain six letters or numbers.");
    return { type: verb, code };
  }
  throw new Error("Unknown command. Send /help to see the available commands.");
}

export function parseNaturalWalletCommand(input: string): Extract<Command, { type: "wallet" | "balance" }> | undefined {
  const text = input
    .trim()
    .toLowerCase()
    .replaceAll("’", "'")
    .replace(/[^a-z0-9' ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (
    /^(?:what(?:'s| is)|show|tell) (?:me )?(?:my )?(?:base |smart )?wallet address$/.test(text)
    || /^(?:what(?:'s| is)|show|tell) (?:me )?my address$/.test(text)
    || /^(?:create|make|open|show|get|set up) (?:me )?(?:my |a )?(?:base |smart )?wallet$/.test(text)
    || /^how (?:can|do) i (?:create|make|open|get|set up) (?:my |a )?(?:base |smart )?wallet$/.test(text)
  ) {
    return { type: "wallet" };
  }

  if (
    /^(?:what(?:'s| is)|show|check|tell) (?:me )?(?:my )?(?:base |wallet )?balances?$/.test(text)
    || /^how much (?:eth|usdc|aero|money|crypto) do i have$/.test(text)
  ) {
    return { type: "balance" };
  }

  return undefined;
}

export const plannedCallSchema = z.object({
  role: z.enum(["approval", "action"]),
  from: z.string().regex(/^0x[0-9a-fA-F]{40}$/).transform((value) => value as `0x${string}`),
  to: z.string().regex(/^0x[0-9a-fA-F]{40}$/).transform((value) => value as `0x${string}`),
  data: z.string().regex(/^0x(?:[0-9a-fA-F]{2})*$/).transform((value) => value as `0x${string}`),
  value: z.string().regex(/^\d+$/),
});

export type PlannedCall = Readonly<z.output<typeof plannedCallSchema>>;

export const aeroHelpText = [
  "Aerodrome SDK/CLI on Base mainnet",
  "",
  "Reads (run immediately):",
  "/aero stocks",
  "/aero positions [--owner 0x…]",
  "/aero pools [--token0 USDC] [--token1 AERO] [--pool-type stable] [--limit 10] [--full]",
  "/aero epochs-latest [--pool-type cl]",
  "/aero epochs --lp 0x… [--limit 10] [--offset 0]",
  "/aero quote --from-token ETH --to-token USDC --amount 0.01 --use-decimals",
  "",
  "Transactions (preview, then /confirm):",
  SUGAR_TX_ACTIONS.map((action) => action.replaceAll("_", "-")).join(", "),
  "/aero stock-buy --stock NVDAc --amount 10",
  "/aero stock-sell --stock NVDAc --amount 0.01",
  "/aero index-rebalance --allocations NVDAc=50,AAPLc=50 --cash 10",
  "",
  "Use the Aero CLI flag names: --flag value or --flag=value. Hyphens map to SDK underscores.",
  "The bot fixes --chain to 8453 and binds transaction --wallet to your verified X smart wallet.",
  "Stock buys and cash use human USDC units; stock sells use human stock units. Other token amounts need --use-decimals for human units.",
].join("\n");

export const helpText = [
  "Pecu helps you manage tokens and trade on Base, right here in chat.",
  "",
  'Ask in your own words, like "What\'s my balance?" or "Swap 0.001 ETH to USDC", or use a command below.',
  "",
  "/wallet  Create or show your wallet",
  "/balance  Check your balances",
  "/quote 0.001 ETH to USDC  See how much you would receive",
  "/swap 0.001 ETH to USDC  Preview a swap",
  "/send 1 USDC to 0x…  Preview a transfer",
  "/token USDC  Check a token balance",
  "/allowance USDC for 0x…  Check spending permission",
  "/approve 1 USDC for 0x…  Preview a spending limit",
  "/revoke USDC for 0x…  Preview removing spending permission",
  'Reply "confirm" to a preview to proceed, or "cancel" to cancel.',
  "/confirm CODE  Confirm using a code",
  "/cancel CODE  Cancel a pending transaction",
  "/yolo  Check whether confirmation prompts are on",
  "/yolo on  Execute new requests without a confirmation prompt",
  "/yolo off  Require confirmation again",
  "b/verbose  Show technical details for your latest result",
  "/aero help  Explore pools, liquidity, rewards, and more",
  "/aave help  Explore lending, borrowing, and Aave positions",
  "/polymarket QUESTION  Research market odds and trends",
  "/polymarket status  Read your latest research result",
  "",
  "Replace 0x… with the full address you want to use.",
  "",
  "YOLO is off by default. With YOLO off, review the preview before confirming. YOLO only applies to your requests in this chat.",
].join("\n");
