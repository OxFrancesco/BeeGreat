import { z } from "zod";

export type XOAuthRefreshConfig = Readonly<{
  clientId: string;
  clientSecret?: string;
  refreshToken: string;
}>;

export type XOAuthTokens = Readonly<{
  accessToken: string;
  refreshToken: string;
  expiresIn?: number;
}>;

type Fetcher = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

const tokenResponse = z.object({
  access_token: z.string().optional().catch(undefined),
  refresh_token: z.string().optional().catch(undefined),
  expires_in: z.number().optional().catch(undefined),
  error: z.string().optional().catch(undefined),
  error_description: z.string().optional().catch(undefined),
});

function basicCredentials(clientId: string, clientSecret: string): string {
  return btoa(`${encodeURIComponent(clientId)}:${encodeURIComponent(clientSecret)}`);
}

export async function refreshXOAuthToken(
  config: XOAuthRefreshConfig,
  request: Fetcher = fetch,
): Promise<XOAuthTokens> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: config.refreshToken,
  });
  const headers = new Headers({ "Content-Type": "application/x-www-form-urlencoded" });
  if (config.clientSecret) {
    headers.set("Authorization", `Basic ${basicCredentials(config.clientId, config.clientSecret)}`);
  } else {
    body.set("client_id", config.clientId);
  }

  const response = await request("https://api.x.com/2/oauth2/token", {
    method: "POST",
    headers,
    body,
  });
  const decoded = tokenResponse.safeParse(await response.json());
  const payload = decoded.success ? decoded.data : undefined;
  if (!response.ok || payload?.access_token === undefined) {
    const detail = payload?.error_description ?? payload?.error ?? `HTTP ${response.status}`;
    throw new Error(`X OAuth refresh failed: ${detail}`);
  }
  const tokens: XOAuthTokens = {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token ?? config.refreshToken,
  };
  return payload.expires_in === undefined ? tokens : { ...tokens, expiresIn: payload.expires_in };
}

export function isUnauthorizedXApiError(cause: unknown): boolean {
  const message = cause instanceof Error ? cause.message : z.string().catch("").parse(cause);
  return /\bHTTP 401\b/.test(message);
}
