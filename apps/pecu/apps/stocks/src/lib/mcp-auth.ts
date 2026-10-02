import { clerkClient } from "@clerk/tanstack-react-start/server";
import { env } from "cloudflare:workers";
import { z } from "zod";
import { jsonValueSchema, type JsonValue } from "../../../../src/json-contract";
import {
  McpAuthError,
  mcpAuthConfig,
  mcpBearerToken,
  mcpVerifiedClerkAuthorization,
  type McpAuthConfig,
  type PecuMcpPrincipal,
} from "../../../../src/mcp-auth";
import { webSenderId } from "../../../../src/web-identity";

export function pecuMcpConfig(): McpAuthConfig {
  return mcpAuthConfig(
    import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
    import.meta.env.VITE_PECU_MCP_URL || "https://pecu.app/mcp",
  );
}

export async function pecuMcpIdentity(request: Request, config: McpAuthConfig): Promise<PecuMcpPrincipal> {
  const bearer = mcpBearerToken(request);
  const client = clerkClient();
  let verified: JsonValue;
  try {
    if (!env.CLERK_SECRET_KEY) throw new McpAuthError(503, "Pecu's account connection is unavailable. Try again.");
    const response = await fetch("https://api.clerk.com/oauth_applications/access_tokens/verify", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.CLERK_SECRET_KEY}`, "Content-Type": "application/json", "Cache-Control": "no-store" },
      body: JSON.stringify({ access_token: bearer }),
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(10000),
    });
    if ([400, 404, 422].includes(response.status)) throw new McpAuthError(401, "Your Pecu connection is invalid or has expired. Connect again.");
    if (!response.ok) throw new McpAuthError(503, "Pecu could not verify your connection. Try again.");
    verified = jsonValueSchema.parse(await response.json());
  } catch (error) {
    if (error instanceof McpAuthError) throw error;
    throw new McpAuthError(503, "Pecu could not verify your connection. Try again.");
  }
  const authorization = mcpVerifiedClerkAuthorization(verified, config.resource);
  if (authorization.expiresAt === undefined && !bearer.startsWith("oat_"))
    throw new McpAuthError(401, "Pecu could not verify this OAuth access token's expiry.");
  try {
    const user = await client.users.getUser(authorization.userId);
    if (user.banned || user.locked) throw new McpAuthError(401, "This Pecu account is unavailable.");
    return { ...authorization, senderId: webSenderId(authorization.userId, user.externalAccounts), token: bearer, resource: config.resource };
  } catch (error) {
    if (error instanceof McpAuthError) throw error;
    throw new McpAuthError(503, "Pecu could not load your account. Try again.");
  }
}

export async function pecuMcpAuthenticate(request: Request, config: McpAuthConfig): Promise<PecuMcpPrincipal | null> {
  try {
    return await pecuMcpIdentity(request, config);
  } catch (error) {
    if (error instanceof McpAuthError && error.status === 401) return null;
    throw error;
  }
}

export async function pecuMcpAuthorizationMetadata(config: McpAuthConfig): Promise<Response> {
  try {
    const response = await fetch(new URL("/.well-known/oauth-authorization-server", config.issuer), {
      redirect: "error",
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error("Clerk OAuth metadata is unavailable.");
    const metadata = z.object({ issuer: z.literal(config.issuer) }).loose().parse(await response.json());
    return Response.json(metadata, { headers: { "Cache-Control": "public, max-age=300", "X-Content-Type-Options": "nosniff" } });
  } catch {
    return Response.json({ error: "Pecu's OAuth connection is unavailable. Try again." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
