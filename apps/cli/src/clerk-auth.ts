import { startOAuthCallback } from "./callback-server";
import type { ClerkCredentials, CredentialStore } from "./credential-store";
import {
  isFiniteJsonNumber,
  isJsonObject,
  isJsonString,
  type JsonValue,
} from "./json";
import { createPkce, randomState } from "./oauth";

type ClerkAuthConfig = {
  issuer: string;
  clientId: string;
};

type ClerkAuthDependencies = {
  fetch(input: string | URL | Request, init?: RequestInit): Promise<Response>;
  store: CredentialStore;
  openBrowser(url: string): Promise<void>;
};

type TokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
};

async function defaultOpenBrowser(url: string) {
  const command =
    process.platform === "darwin"
      ? ["open", url]
      : process.platform === "win32"
        ? ["cmd", "/c", "start", "", url]
        : ["xdg-open", url];
  const child = Bun.spawn(command, { stdout: "ignore", stderr: "ignore" });
  if ((await child.exited) !== 0) {
    throw new Error(`Open this URL to sign in:\n${url}`);
  }
}

function tokenResponse(value: JsonValue): TokenResponse {
  if (!isJsonObject(value))
    throw new Error("Clerk returned an invalid token response.");
  if (
    !isJsonString(value.access_token) ||
    !isFiniteJsonNumber(value.expires_in)
  ) {
    const description = isJsonString(value.error_description)
      ? value.error_description
      : "Clerk did not return an access token.";
    throw new Error(description);
  }
  const tokens: TokenResponse = {
    access_token: value.access_token,
    expires_in: value.expires_in,
  };
  if (isJsonString(value.refresh_token)) {
    tokens.refresh_token = value.refresh_token;
  }
  return tokens;
}

export function createClerkCliAuth(
  config: ClerkAuthConfig,
  dependencies: Pick<ClerkAuthDependencies, "store"> &
    Partial<Omit<ClerkAuthDependencies, "store">>,
) {
  const fetcher = dependencies.fetch ?? fetch;
  const openBrowser = dependencies.openBrowser ?? defaultOpenBrowser;
  const issuer = config.issuer.replace(/\/$/, "");
  let cached: ClerkCredentials | undefined;

  async function exchange(body: URLSearchParams) {
    const response = await fetcher(`${issuer}/oauth/token`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
    });
    const value: JsonValue = await response.json().catch(() => null);
    if (!response.ok)
      throw new Error(`Clerk token exchange failed (HTTP ${response.status}).`);
    return tokenResponse(value);
  }

  async function userId(accessToken: string) {
    const response = await fetcher(`${issuer}/oauth/userinfo`, {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    const value: JsonValue = await response.json().catch(() => null);
    const subject = isJsonObject(value)
      ? (value.sub ?? value.user_id)
      : undefined;
    if (!response.ok || !isJsonString(subject)) {
      throw new Error("Clerk could not identify the signed-in user.");
    }
    return subject;
  }

  async function login() {
    const pkce = createPkce();
    const state = randomState();
    const callback = startOAuthCallback(state);
    const authorize = new URL(`${issuer}/oauth/authorize`);
    authorize.search = new URLSearchParams({
      response_type: "code",
      client_id: config.clientId,
      redirect_uri: callback.redirectUri,
      scope: "openid profile email offline_access",
      code_challenge: pkce.challenge,
      code_challenge_method: "S256",
      state,
    }).toString();
    try {
      await openBrowser(authorize.toString());
    } catch (error) {
      callback.cancel();
      throw error;
    }
    const result = await callback.result;
    const tokens = await exchange(
      new URLSearchParams({
        grant_type: "authorization_code",
        client_id: config.clientId,
        redirect_uri: result.redirectUri,
        code: result.code,
        code_verifier: pkce.verifier,
      }),
    );
    if (!tokens.refresh_token)
      throw new Error("Clerk did not return a refresh token.");
    const credentials: ClerkCredentials = {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: Date.now() + tokens.expires_in * 1_000,
      userId: await userId(tokens.access_token),
    };
    await dependencies.store.save(credentials);
    cached = credentials;
    return credentials;
  }

  async function refresh(credentials: ClerkCredentials) {
    const tokens = await exchange(
      new URLSearchParams({
        grant_type: "refresh_token",
        client_id: config.clientId,
        refresh_token: credentials.refreshToken,
      }),
    );
    const updated = {
      ...credentials,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? credentials.refreshToken,
      expiresAt: Date.now() + tokens.expires_in * 1_000,
    };
    await dependencies.store.save(updated);
    cached = updated;
    return updated;
  }

  return {
    async session(options: { forceLogin?: boolean } = {}) {
      if (options.forceLogin) return await login();
      const stored = cached ?? (await dependencies.store.load());
      cached = stored;
      if (!stored) return await login();
      if (stored.expiresAt > Date.now() + 30_000) return stored;
      try {
        return await refresh(stored);
      } catch {
        await dependencies.store.clear();
        return await login();
      }
    },
    async logout() {
      const stored = cached ?? (await dependencies.store.load());
      if (stored) {
        await fetcher(`${issuer}/oauth/revoke`, {
          method: "POST",
          headers: { "content-type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            token: stored.refreshToken,
            client_id: config.clientId,
          }),
        }).catch(() => undefined);
      }
      await dependencies.store.clear();
      cached = undefined;
    },
  };
}
