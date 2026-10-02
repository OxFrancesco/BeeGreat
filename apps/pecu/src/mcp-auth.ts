import { z } from "zod";
import type { JsonInput } from "./json-contract";
import { clerkUserIdSchema } from "./web-identity";

export const PECU_MCP_SCOPES = ["pecu:read", "pecu:write"] as const;
export type PecuMcpScope = (typeof PECU_MCP_SCOPES)[number];
export type McpAuthConfig = Readonly<{ resource: string; issuer: string }>;
export type McpAuthorization = Readonly<{
  userId: string;
  clientId: string;
  tokenId: string;
  scopes: string[];
  expiresAt?: number;
}>;
export type PecuMcpPrincipal = McpAuthorization & Readonly<{
  senderId: string;
  token: string;
  resource: string;
}>;

export class McpAuthError extends Error {
  constructor(
    readonly status: 401 | 403 | 503,
    message: string,
    readonly scope?: PecuMcpScope,
  ) {
    super(message);
    this.name = "McpAuthError";
  }
}

function safeUrl(value: string, allowLocal = false): URL {
  const url = new URL(value);
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if ((url.protocol !== "https:" && !(allowLocal && local && url.protocol === "http:")) || url.username || url.password || url.search || url.hash)
    throw new Error("Use an HTTPS URL without credentials, query parameters or a fragment.");
  return url;
}

export function clerkOAuthIssuer(publishableKey: string): string {
  const encoded = /^pk_(?:live|test)_([A-Za-z0-9_-]+)$/.exec(publishableKey)?.[1];
  if (!encoded) throw new Error("Pecu's Clerk publishable key is unavailable.");
  let hostname: string;
  try {
    hostname = atob(encoded.replace(/-/g, "+").replace(/_/g, "/")).replace(/\$$/, "");
  } catch {
    throw new Error("Pecu's Clerk publishable key is invalid.");
  }
  if (!/^[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?$/.test(hostname) || !hostname.includes("."))
    throw new Error("Pecu's Clerk frontend domain is invalid.");
  return safeUrl(`https://${hostname}`).origin;
}

export function mcpAuthConfig(publishableKey: string, resource = "https://pecu.app/mcp"): McpAuthConfig {
  const endpoint = safeUrl(resource, true);
  if (!endpoint.pathname.endsWith("/mcp")) throw new Error("Pecu's MCP resource URL must end in /mcp.");
  return { issuer: clerkOAuthIssuer(publishableKey), resource: endpoint.href };
}

export function mcpResourceMetadataUrl(config: McpAuthConfig): string {
  const resource = new URL(config.resource);
  return new URL(`/.well-known/oauth-protected-resource${resource.pathname}`, resource.origin).href;
}

export function mcpProtectedResourceMetadata(config: McpAuthConfig) {
  return {
    resource: config.resource,
    resource_name: "Pecu",
    authorization_servers: [config.issuer],
    bearer_methods_supported: ["header"],
    scopes_supported: [PECU_MCP_SCOPES[0]],
  };
}

export function mcpBearerToken(request: Request): string {
  const value = request.headers.get("Authorization") ?? "";
  const token = /^Bearer ([A-Za-z0-9._~+/-]+=*)$/i.exec(value)?.[1];
  if (!token || token.length > 16384) throw new McpAuthError(401, "Connect your Pecu account to use these tools.");
  if (token.startsWith("oat_")) return token;
  const jwt = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token);
  if (jwt) {
    try {
      const part = token.split(".")[0];
      const header: unknown = JSON.parse(atob(part.replace(/-/g, "+").replace(/_/g, "/")));
      if (z.object({ typ: z.enum(["at+jwt", "application/at+jwt"]) }).safeParse(header).success) return token;
    } catch {}
  }
  throw new McpAuthError(401, "Use the OAuth connection for Pecu. Browser session tokens are not accepted.");
}

const verifiedOAuthSchema = z.object({
  id: z.string().min(1),
  clientId: z.string().min(1),
  subject: clerkUserIdSchema,
  type: z.enum(["oauth:access_token", "oauth_token"]),
  scopes: z.array(z.string()),
  revoked: z.literal(false),
  expired: z.literal(false),
  expiration: z.number().finite().positive().nullable(),
  aud: z.union([z.string().min(1), z.array(z.string().min(1)).min(1)]),
});

const verifiedClerkOAuthSchema = verifiedOAuthSchema.omit({ clientId: true, type: true }).extend({
  object: z.literal("clerk_idp_oauth_access_token"),
  client_id: z.string().min(1),
  active: z.literal(true).optional(),
});

export function mcpVerifiedClerkAuthorization(input: JsonInput, resource: string, now = Date.now()): McpAuthorization {
  const parsed = verifiedClerkOAuthSchema.safeParse(input);
  if (!parsed.success) throw new McpAuthError(401, "Pecu could not verify this OAuth access token.");
  const { client_id, ...token } = parsed.data;
  return mcpVerifiedAuthorization({ ...token, type: "oauth:access_token", clientId: client_id }, resource, now);
}

export function mcpVerifiedAuthorization(input: JsonInput, resource: string, now = Date.now()): McpAuthorization {
  const parsed = verifiedOAuthSchema.safeParse(input);
  if (!parsed.success) throw new McpAuthError(401, "Pecu could not verify this OAuth access token.");
  const token = parsed.data;
  if (![token.aud].flat().includes(resource)) throw new McpAuthError(401, "This access token was issued for a different service.");
  const authorization = { userId: token.subject, clientId: token.clientId, tokenId: token.id, scopes: token.scopes };
  if (token.expiration === null) return authorization;
  const expiration = token.expiration < 1e12 ? token.expiration * 1000 : token.expiration;
  if (expiration <= now) throw new McpAuthError(401, "Your Pecu connection has expired. Connect again.");
  return { ...authorization, expiresAt: Math.floor(expiration / 1000) };
}

export function requireMcpScope(auth: McpAuthorization, scope: PecuMcpScope): void {
  if (!auth.scopes.includes(scope)) throw new McpAuthError(403, "Allow this permission in Pecu to use this tool.", scope);
}

export function mcpAuthResponse(error: McpAuthError, config: McpAuthConfig): Response {
  const headers = new Headers({ "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
  if (error.status !== 503) {
    const scope = error.scope ?? PECU_MCP_SCOPES[0];
    const challenge = error.status === 403 ? ', error="insufficient_scope"' : ', error="invalid_token"';
    headers.set("WWW-Authenticate", `Bearer resource_metadata="${mcpResourceMetadataUrl(config)}", scope="${scope}"${challenge}`);
  }
  return Response.json({ error: error.message }, { status: error.status, headers });
}
