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

type TokenResponse = {
  access_token?: unknown;
  refresh_token?: unknown;
  expires_in?: unknown;
  error?: unknown;
  error_description?: unknown;
};

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
  const payload = await response.json() as TokenResponse;
  if (!response.ok || typeof payload.access_token !== "string") {
    const detail = typeof payload.error_description === "string"
      ? payload.error_description
      : typeof payload.error === "string" ? payload.error : `HTTP ${response.status}`;
    throw new Error(`X OAuth refresh failed: ${detail}`);
  }
  return {
    accessToken: payload.access_token,
    refreshToken: typeof payload.refresh_token === "string" ? payload.refresh_token : config.refreshToken,
    ...(typeof payload.expires_in === "number" ? { expiresIn: payload.expires_in } : {}),
  };
}

export function isUnauthorizedXApiError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  return /\bHTTP 401\b/.test(message);
}
