import { z } from "zod";

const environmentSchema = z.object({
  ALCHEMY_RPC_URL: z.string().optional().catch(undefined),
  BASE_RPC_URL: z.string().optional().catch(undefined),
  ENABLE_MAINNET_EXECUTION: z.string().optional().catch(undefined),
  XCHAT_POLLING_ENABLED: z.string().optional().catch(undefined),
  POLL_INTERVAL_MS: z.string().optional().catch(undefined),
  QUOTE_TTL_SECONDS: z.string().optional().catch(undefined),
  MAX_SLIPPAGE_BPS: z.string().optional().catch(undefined),
  CHAT_PEER_USER_IDS: z.string().optional().catch(undefined),
  X_WEBHOOK_URL: z.string().optional().catch(undefined),
  WHOP_API_URL: z.string().optional().catch(undefined),
  WHOP_API_VERSION_DATE: z.string().optional().catch(undefined),
  DEPOSIT_RELAY_MAX_USD: z.string().optional().catch(undefined),
  DEPOSIT_RELAY_DAILY_MAX_USD: z.string().optional().catch(undefined),
  NANSEN_API_URL: z.string().optional().catch(undefined),
  CROSSMINT_API_KEY: z.string().optional().catch(undefined),
  CROSSMINT_WALLET_SECRET: z.string().optional().catch(undefined),
  CHAT_PIN: z.string().optional().catch(undefined),
  X_ACCESS_TOKEN: z.string().optional().catch(undefined),
  X_OAUTH_CLIENT_ID: z.string().optional().catch(undefined),
  X_OAUTH_CLIENT_SECRET: z.string().optional().catch(undefined),
  X_OAUTH_REFRESH_TOKEN: z.string().optional().catch(undefined),
  X_BEARER_TOKEN: z.string().optional().catch(undefined),
  X_CONSUMER_SECRET: z.string().optional().catch(undefined),
  CHAT_BOT_USER_ID: z.string().optional().catch(undefined),
  ADMIN_TOKEN: z.string().optional().catch(undefined),
  EXA_API_KEY: z.string().optional().catch(undefined),
  WHOP_API_KEY: z.string().optional().catch(undefined),
  WHOP_WEBHOOK_SECRET: z.string().optional().catch(undefined),
  NANSEN_API_KEY: z.string().optional().catch(undefined),
  TYPESAFE_API_KEY: z.string().optional().catch(undefined),
  OPENROUTER_API_KEY: z.string().optional().catch(undefined),
  POSTHOG_ENABLED: z.string().optional().catch(undefined),
});
type WorkerEnvironment = Partial<Record<keyof z.output<typeof environmentSchema>, string>>;

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
  analyticsEnabled: boolean;
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
  typesafeApiKey?: string;
  nansenApiUrl: string;
  openRouterApiKey?: string;
}>;

export function loadWorkerConfig(env: WorkerEnvironment): WorkerConfig {
  const environment = environmentSchema.parse(env);
  const value = publicConfigSchema.parse({
    BASE_RPC_URL: (environment.ALCHEMY_RPC_URL || undefined) ?? (environment.BASE_RPC_URL || undefined),
    ENABLE_MAINNET_EXECUTION: (environment.ENABLE_MAINNET_EXECUTION || undefined),
    XCHAT_POLLING_ENABLED: (environment.XCHAT_POLLING_ENABLED || undefined),
    POLL_INTERVAL_MS: (environment.POLL_INTERVAL_MS || undefined),
    QUOTE_TTL_SECONDS: (environment.QUOTE_TTL_SECONDS || undefined),
    MAX_SLIPPAGE_BPS: (environment.MAX_SLIPPAGE_BPS || undefined),
    CHAT_PEER_USER_IDS: (environment.CHAT_PEER_USER_IDS || undefined),
    X_WEBHOOK_URL: (environment.X_WEBHOOK_URL || undefined),
    WHOP_API_URL: (environment.WHOP_API_URL || undefined),
    WHOP_API_VERSION_DATE: (environment.WHOP_API_VERSION_DATE || undefined),
    DEPOSIT_RELAY_MAX_USD: (environment.DEPOSIT_RELAY_MAX_USD || undefined),
    DEPOSIT_RELAY_DAILY_MAX_USD: (environment.DEPOSIT_RELAY_DAILY_MAX_USD || undefined),
    NANSEN_API_URL: (environment.NANSEN_API_URL || undefined),
  });
  const crossmintApiKey = (environment.CROSSMINT_API_KEY || undefined);
  const crossmintWalletSecret = (environment.CROSSMINT_WALLET_SECRET || undefined);
  const chatPin = (environment.CHAT_PIN || undefined);
  const xAccessToken = (environment.X_ACCESS_TOKEN || undefined);
  const xOAuthClientId = (environment.X_OAUTH_CLIENT_ID || undefined);
  const xOAuthClientSecret = (environment.X_OAUTH_CLIENT_SECRET || undefined);
  const xOAuthRefreshToken = (environment.X_OAUTH_REFRESH_TOKEN || undefined);
  const xBearerToken = (environment.X_BEARER_TOKEN || undefined);
  const xConsumerSecret = (environment.X_CONSUMER_SECRET || undefined);
  const chatBotUserId = (environment.CHAT_BOT_USER_ID || undefined);
  const adminToken = (environment.ADMIN_TOKEN || undefined);
  return {
    baseRpcUrl: value.BASE_RPC_URL,
    enableMainnetExecution: value.ENABLE_MAINNET_EXECUTION === "true",
    xchatPollingEnabled: value.XCHAT_POLLING_ENABLED === "true",
    analyticsEnabled: environment.POSTHOG_ENABLED === "true",
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
    ...optionalConfig("exaApiKey", (environment.EXA_API_KEY || undefined)),
    ...optionalConfig("whopApiKey", (environment.WHOP_API_KEY || undefined)),
    ...optionalConfig("whopWebhookSecret", (environment.WHOP_WEBHOOK_SECRET || undefined)),
    ...optionalConfig("nansenApiKey", (environment.NANSEN_API_KEY || undefined)),
    ...optionalConfig("typesafeApiKey", (environment.TYPESAFE_API_KEY || undefined)),
    ...optionalConfig("openRouterApiKey", (environment.OPENROUTER_API_KEY || undefined)),
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
