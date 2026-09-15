import { z } from "zod";

function emptyToUndefined(value: unknown): unknown {
  return value === "" ? undefined : value;
}

const optionalString = z.preprocess(emptyToUndefined, z.string().min(1).optional());
const envSchema = z.object({
  CROSSMINT_API_KEY: z.string().startsWith("sk_production_", "A production Crossmint server key is required for Base mainnet"),
  CROSSMINT_WALLET_SECRET: z.string().min(32, "Use a stable wallet signer secret of at least 32 characters"),
  CHAT_PIN: z.string().min(4),
  X_ACCESS_TOKEN: optionalString,
  XURL_APP: optionalString,
  XURL_USERNAME: optionalString,
  CHAT_BOT_USER_ID: z.preprocess(emptyToUndefined, z.string().regex(/^\d+$/).optional()),
  CHAT_PEER_USER_IDS: z.string().default(""),
  BASE_RPC_URL: z.string().url().default("https://base-mainnet.g.alchemy.com/public"),
  ENABLE_MAINNET_EXECUTION: z.enum(["true", "false"]).default("false"),
  POLL_INTERVAL_MS: z.coerce.number().int().min(60_000).default(60_000),
  QUOTE_TTL_SECONDS: z.coerce.number().int().min(30).max(900).default(120),
  MAX_SLIPPAGE_BPS: z.coerce.number().int().min(1).max(300).default(100),
  WHOP_API_URL: z.string().url().default("https://api.whop.com/api/v1"),
  WHOP_API_VERSION_DATE: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).default("2026-09-13"),
  DEPOSIT_RELAY_MAX_USD: z.coerce.number().int().min(1).max(1_000_000).default(500),
  DEPOSIT_RELAY_DAILY_MAX_USD: z.coerce.number().int().min(1).default(2000),
  DATABASE_PATH: z.string().min(1).default(".data/pecu.sqlite"),
});

export type Config = Readonly<{
  crossmintApiKey: string;
  crossmintWalletSecret: string;
  chatPin: string;
  xAccessToken?: string;
  xurlApp?: string;
  xurlUsername?: string;
  chatBotUserId?: string;
  chatPeerUserIds: readonly string[];
  baseRpcUrl: string;
  enableMainnetExecution: boolean;
  pollIntervalMs: number;
  quoteTtlSeconds: number;
  maxSlippageBps: number;
  whopApiUrl: string;
  whopApiVersionDate: string;
  depositRelayMaxUsd: number;
  depositRelayDailyMaxUsd: number;
  databasePath: string;
}>;

export function loadConfig(env: Record<string, string | undefined> = Bun.env): Config {
  const value = envSchema.parse(env);
  return {
    crossmintApiKey: value.CROSSMINT_API_KEY,
    crossmintWalletSecret: value.CROSSMINT_WALLET_SECRET,
    chatPin: value.CHAT_PIN,
    ...(value.X_ACCESS_TOKEN === undefined ? {} : { xAccessToken: value.X_ACCESS_TOKEN }),
    ...(value.XURL_APP === undefined ? {} : { xurlApp: value.XURL_APP }),
    ...(value.XURL_USERNAME === undefined ? {} : { xurlUsername: value.XURL_USERNAME }),
    ...(value.CHAT_BOT_USER_ID === undefined ? {} : { chatBotUserId: value.CHAT_BOT_USER_ID }),
    chatPeerUserIds: value.CHAT_PEER_USER_IDS.split(",").map((id) => id.trim()).filter((id) => /^\d+$/.test(id)),
    baseRpcUrl: value.BASE_RPC_URL,
    enableMainnetExecution: value.ENABLE_MAINNET_EXECUTION === "true",
    pollIntervalMs: value.POLL_INTERVAL_MS,
    quoteTtlSeconds: value.QUOTE_TTL_SECONDS,
    maxSlippageBps: value.MAX_SLIPPAGE_BPS,
    whopApiUrl: value.WHOP_API_URL,
    whopApiVersionDate: value.WHOP_API_VERSION_DATE,
    depositRelayMaxUsd: value.DEPOSIT_RELAY_MAX_USD,
    depositRelayDailyMaxUsd: value.DEPOSIT_RELAY_DAILY_MAX_USD,
    databasePath: value.DATABASE_PATH,
  };
}
