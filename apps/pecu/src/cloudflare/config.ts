import { z } from "zod";

function envString(env: object, name: string): string | undefined {
  const value = Reflect.get(env, name);
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function optionalConfig(name: keyof WorkerConfig, value: string | undefined): Partial<WorkerConfig> {
  return value ? { [name]: value } : {};
}

const publicConfigSchema = z.object({
  BASE_RPC_URL: z.string().url().default("https://mainnet.base.org"),
  ENABLE_MAINNET_EXECUTION: z.enum(["true", "false"]).default("false"),
  XCHAT_POLLING_ENABLED: z.enum(["true", "false"]).default("false"),
  POLL_INTERVAL_MS: z.coerce.number().int().min(60_000).default(60_000),
  QUOTE_TTL_SECONDS: z.coerce.number().int().min(30).max(900).default(120),
  MAX_SLIPPAGE_BPS: z.coerce.number().int().min(1).max(300).default(100),
  CHAT_PEER_USER_IDS: z.string().default(""),
  X_WEBHOOK_URL: z.string().url().optional(),
  WHOP_API_URL: z.string().url().default("https://api.whop.com/api/v1"),
  WHOP_API_VERSION_DATE: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).default("2026-09-13"),
  DEPOSIT_RELAY_MAX_USD: z.coerce.number().int().min(1).max(1_000_000).default(500),
  DEPOSIT_RELAY_DAILY_MAX_USD: z.coerce.number().int().min(1).default(2000),
  NANSEN_API_URL: z.string().url().default("https://api.nansen.ai/api/v1"),
});

export type WorkerConfig = Readonly<{
  baseRpcUrl: string;
  enableMainnetExecution: boolean;
  xchatPollingEnabled: boolean;
  pollIntervalMs: number;
  quoteTtlSeconds: number;
  maxSlippageBps: number;
  chatPeerUserIds: readonly string[];
  crossmintApiKey?: string;
  crossmintWalletSecret?: string;
  chatPin?: string;
  xAccessToken?: string;
  xOAuthClientId?: string;
  xOAuthClientSecret?: string;
  xOAuthRefreshToken?: string;
  xBearerToken?: string;
  xConsumerSecret?: string;
  xWebhookUrl?: string;
  chatBotUserId?: string;
  adminToken?: string;
  exaApiKey?: string;
  whopApiKey?: string;
  whopWebhookSecret?: string;
  whopApiUrl: string;
  whopApiVersionDate: string;
  depositRelayMaxUsd: number;
  depositRelayDailyMaxUsd: number;
  nansenApiKey?: string;
  nansenApiUrl: string;
}>;

export function loadWorkerConfig(env: object): WorkerConfig {
  const value = publicConfigSchema.parse({
    BASE_RPC_URL: envString(env, "ALCHEMY_RPC_URL") ?? envString(env, "BASE_RPC_URL"),
    ENABLE_MAINNET_EXECUTION: envString(env, "ENABLE_MAINNET_EXECUTION"),
    XCHAT_POLLING_ENABLED: envString(env, "XCHAT_POLLING_ENABLED"),
    POLL_INTERVAL_MS: envString(env, "POLL_INTERVAL_MS"),
    QUOTE_TTL_SECONDS: envString(env, "QUOTE_TTL_SECONDS"),
    MAX_SLIPPAGE_BPS: envString(env, "MAX_SLIPPAGE_BPS"),
    CHAT_PEER_USER_IDS: envString(env, "CHAT_PEER_USER_IDS"),
    X_WEBHOOK_URL: envString(env, "X_WEBHOOK_URL"),
    WHOP_API_URL: envString(env, "WHOP_API_URL"),
    WHOP_API_VERSION_DATE: envString(env, "WHOP_API_VERSION_DATE"),
    DEPOSIT_RELAY_MAX_USD: envString(env, "DEPOSIT_RELAY_MAX_USD"),
    DEPOSIT_RELAY_DAILY_MAX_USD: envString(env, "DEPOSIT_RELAY_DAILY_MAX_USD"),
    NANSEN_API_URL: envString(env, "NANSEN_API_URL"),
  });
  const crossmintApiKey = envString(env, "CROSSMINT_API_KEY");
  const crossmintWalletSecret = envString(env, "CROSSMINT_WALLET_SECRET");
  const chatPin = envString(env, "CHAT_PIN");
  const xAccessToken = envString(env, "X_ACCESS_TOKEN");
  const xOAuthClientId = envString(env, "X_OAUTH_CLIENT_ID");
  const xOAuthClientSecret = envString(env, "X_OAUTH_CLIENT_SECRET");
  const xOAuthRefreshToken = envString(env, "X_OAUTH_REFRESH_TOKEN");
  const xBearerToken = envString(env, "X_BEARER_TOKEN");
  const xConsumerSecret = envString(env, "X_CONSUMER_SECRET");
  const chatBotUserId = envString(env, "CHAT_BOT_USER_ID");
  const adminToken = envString(env, "ADMIN_TOKEN");
  return {
    baseRpcUrl: value.BASE_RPC_URL,
    enableMainnetExecution: value.ENABLE_MAINNET_EXECUTION === "true",
    xchatPollingEnabled: value.XCHAT_POLLING_ENABLED === "true",
    pollIntervalMs: value.POLL_INTERVAL_MS,
    quoteTtlSeconds: value.QUOTE_TTL_SECONDS,
    maxSlippageBps: value.MAX_SLIPPAGE_BPS,
    chatPeerUserIds: value.CHAT_PEER_USER_IDS.split(",").map((id) => id.trim()).filter((id) => /^\d+$/.test(id)),
    ...optionalConfig("crossmintApiKey", crossmintApiKey),
    ...optionalConfig("crossmintWalletSecret", crossmintWalletSecret),
    ...optionalConfig("chatPin", chatPin),
    ...optionalConfig("xAccessToken", xAccessToken),
    ...optionalConfig("xOAuthClientId", xOAuthClientId),
    ...optionalConfig("xOAuthClientSecret", xOAuthClientSecret),
    ...optionalConfig("xOAuthRefreshToken", xOAuthRefreshToken),
    ...optionalConfig("xBearerToken", xBearerToken),
    ...optionalConfig("xConsumerSecret", xConsumerSecret),
    ...optionalConfig("xWebhookUrl", value.X_WEBHOOK_URL),
    ...optionalConfig("chatBotUserId", chatBotUserId),
    ...optionalConfig("adminToken", adminToken),
    ...optionalConfig("exaApiKey", envString(env, "EXA_API_KEY")),
    ...optionalConfig("whopApiKey", envString(env, "WHOP_API_KEY")),
    ...optionalConfig("whopWebhookSecret", envString(env, "WHOP_WEBHOOK_SECRET")),
    ...optionalConfig("nansenApiKey", envString(env, "NANSEN_API_KEY")),
    whopApiUrl: value.WHOP_API_URL,
    whopApiVersionDate: value.WHOP_API_VERSION_DATE,
    depositRelayMaxUsd: value.DEPOSIT_RELAY_MAX_USD,
    depositRelayDailyMaxUsd: value.DEPOSIT_RELAY_DAILY_MAX_USD,
    nansenApiUrl: value.NANSEN_API_URL,
  };
}

export function runtimeConfigurationError(config: WorkerConfig): string | undefined {
  if (!config.crossmintApiKey?.startsWith("sk_production_")) return "CROSSMINT_API_KEY is missing or is not a production key";
  if (!config.crossmintWalletSecret || config.crossmintWalletSecret.length < 32) return "CROSSMINT_WALLET_SECRET must contain at least 32 characters";
  if (!config.xAccessToken) return "X_ACCESS_TOKEN is missing";
  if (config.xchatPollingEnabled && !config.xOAuthClientId) return "X_OAUTH_CLIENT_ID is missing while XChat polling is enabled";
  if (config.xchatPollingEnabled && !config.xOAuthRefreshToken) return "X_OAUTH_REFRESH_TOKEN is missing while XChat polling is enabled";
  if (!config.chatPin || config.chatPin.length < 4) return "CHAT_PIN must contain at least 4 characters";
  return undefined;
}
