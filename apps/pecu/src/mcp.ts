import { createMcpHandler, fromJsonSchema, McpServer, requireScopes, type JsonSchemaType } from "@modelcontextprotocol/server";
import { CfWorkerJsonSchemaValidator } from "@modelcontextprotocol/server/validators/cf-worker";
import { z } from "zod";
import { mcpToolCatalog } from "./mcp-catalog";
import { mcpCallResultSchema, mcpToolCallSchema, type McpCallResult, type McpToolCall } from "./mcp-contract";
import { McpAuthError, mcpAuthResponse, mcpProtectedResourceMetadata, mcpResourceMetadataUrl, requireMcpScope, type McpAuthConfig, type PecuMcpPrincipal } from "./mcp-auth";
import { clerkUserIdSchema, senderIdSchema } from "./web-identity";

const principalSchema = z.object({
  userId: clerkUserIdSchema, senderId: senderIdSchema,
  clientId: z.string().min(1).max(2048), tokenId: z.string().min(1),
  scopes: z.array(z.string()), token: z.string().min(1),
  expiresAt: z.number().finite().optional(), resource: z.string().url(),
});
const validator = new CfWorkerJsonSchemaValidator();
const schemas = mcpToolCatalog.map(tool => ({
  ...tool,
  // SAFETY: Zod emits valid JSON Schema. SDK 2.2 types incorrectly narrow $vocabulary;
  // the worker validator checks the generated schema and rejects unknown keys.
  schema: fromJsonSchema<McpToolCall["arguments"]>(tool.inputSchema as JsonSchemaType, validator),
}));

export type PecuMcpEndpointOptions = McpAuthConfig & Readonly<{
  allowedOrigins?: readonly string[];
  authenticate(request: Request): Promise<PecuMcpPrincipal | null>;
  execute(principal: PecuMcpPrincipal, input: McpToolCall): Promise<McpCallResult>;
}>;

export function createPecuMcpEndpoint(options: PecuMcpEndpointOptions) {
  const resource = new URL(options.resource);
  const origins = new Set([resource.origin, ...options.allowedOrigins ?? []]);
  const metadataPath = new URL(mcpResourceMetadataUrl(options)).pathname;
  const handler = createMcpHandler(({ authInfo, requestInfo }) => {
    const principal = principalSchema.parse(authInfo?.extra?.pecu);
    const idempotencyKey = requestInfo?.headers.get("Idempotency-Key");
    const requestId = z.string().uuid().parse(idempotencyKey ?? crypto.randomUUID());
    const server = new McpServer({ name: "pecu", version: "0.1.0" }, {
      jsonSchemaValidator: validator,
      cacheHints: { "tools/list": { ttlMs: 30_000, cacheScope: "private" } },
      instructions: "Use Pecu tools with the user's existing account and Base wallet. Discover the exact schemas before calling tools. Transaction tools prepare previews and never submit funds from MCP. Review and confirm the specific preview in the signed-in Pecu app. MCP cannot enable YOLO, approve automation allowances or sign transactions. load_skills returns instructions for this caller. run_tools checks permission for every nested call. Research submission hooks are internal to Pecu's research agents. Use the same UUID Idempotency-Key header only when retrying the same tool call.",
    });
    for (const tool of schemas) {
      server.registerTool(tool.name, {
        description: tool.description,
        inputSchema: tool.schema,
        annotations: { readOnlyHint: tool.readOnly, destructiveHint: !tool.readOnly, openWorldHint: true },
        scopeChallenge: tool.scope === "pecu:write" ? requireScopes("pecu:read", "pecu:write") : requireScopes("pecu:read"),
        _meta: { "app.pecu/requiredScope": tool.scope },
      }, async argumentsValue => {
        try {
          requireMcpScope(principal, tool.scope);
          const input = mcpToolCallSchema.parse({ name: tool.name, arguments: argumentsValue, requestId });
          const result = mcpCallResultSchema.parse(await options.execute(principal, input));
          return { content: [{ type: "text", text: result.text }], isError: result.isError, _meta: { "app.pecu/requestId": requestId } };
        } catch {
          return { content: [{ type: "text", text: "Pecu could not finish this tool call. Try again." }], isError: true };
        }
      });
    }
    return server;
  }, { legacy: "stateless", maxRequestBodySize: 65_536 });

  return {
    close: () => handler.close(),
    async fetch(request: Request): Promise<Response> {
      const url = new URL(request.url);
      if (url.origin !== resource.origin || (request.headers.has("Host") && request.headers.get("Host") !== resource.host))
        return Response.json({ error: "Invalid request host" }, { status: 403 });
      const origin = request.headers.get("Origin");
      if (origin && !origins.has(origin)) return Response.json({ error: "Invalid request origin" }, { status: 403 });
      const cors = (response: Response): Response => {
        const headers = new Headers(response.headers);
        headers.set("X-Content-Type-Options", "nosniff");
        if (origin) {
          headers.set("Access-Control-Allow-Origin", origin);
          headers.set("Vary", "Origin");
          headers.set("Access-Control-Expose-Headers", "WWW-Authenticate, MCP-Protocol-Version");
        }
        return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
      };
      if ([metadataPath, "/.well-known/oauth-protected-resource"].includes(url.pathname) && request.method === "GET")
        return cors(Response.json(mcpProtectedResourceMetadata(options), { headers: { "Cache-Control": "public, max-age=300" } }));
      if (url.pathname !== resource.pathname) return cors(Response.json({ error: "Not found" }, { status: 404 }));
      if (request.method === "OPTIONS") return cors(new Response(null, { status: 204, headers: {
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Authorization, Content-Type, Accept, MCP-Protocol-Version, Mcp-Method, Mcp-Name, Idempotency-Key",
        "Access-Control-Max-Age": "600",
      } }));
      if (request.method !== "POST") return cors(new Response("Method not allowed", { status: 405, headers: { Allow: "POST, OPTIONS" } }));
      if (request.headers.has("Idempotency-Key") && !z.string().uuid().safeParse(request.headers.get("Idempotency-Key")).success)
        return cors(Response.json({ error: "Idempotency-Key must be a UUID" }, { status: 400 }));
      try {
        const principal = await options.authenticate(request);
        if (!principal || principal.resource !== options.resource || (principal.expiresAt !== undefined && principal.expiresAt <= Date.now() / 1000))
          throw new McpAuthError(401, "Connect your Pecu account to use these tools.");
        requireMcpScope(principal, "pecu:read");
        const response = await handler.fetch(request, { authInfo: {
          token: principal.token, clientId: principal.clientId, scopes: principal.scopes,
          expiresAt: principal.expiresAt, resource: new URL(options.resource),
          resourceMetadataUrl: mcpResourceMetadataUrl(options), extra: { pecu: principal },
        } });
        const headers = new Headers(response.headers);
        headers.set("Cache-Control", "no-store");
        return cors(new Response(response.body, { status: response.status, statusText: response.statusText, headers }));
      } catch (error) {
        return cors(mcpAuthResponse(error instanceof McpAuthError ? error : new McpAuthError(503, "Pecu's account connection is unavailable. Try again."), options));
      }
    },
  };
}
