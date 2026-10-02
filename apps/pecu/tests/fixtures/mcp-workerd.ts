import { createPecuMcpEndpoint } from "../../src/mcp";
import { McpAuthError, mcpBearerToken, mcpVerifiedClerkAuthorization } from "../../src/mcp-auth";
import { mcpToolCatalog } from "../../src/mcp-catalog";
import { jsonObjectSchema } from "../../src/json-contract";
import { webSenderId } from "../../src/web-identity";

type FixtureEnv = Readonly<{ MCP_FIXTURE_RESOURCE: string }>;
let endpoint: ReturnType<typeof createPecuMcpEndpoint> | undefined;
let dispatches = 0;

export default {
  async fetch(request: Request, env: FixtureEnv): Promise<Response> {
    const path = new URL(request.url).pathname;
    if (path === "/healthz") return Response.json({ fixture: "pecu-mcp-workerd", tools: mcpToolCatalog.length });
    if (path === "/dispatches") return Response.json({ dispatches });
    endpoint ??= createPecuMcpEndpoint({
      resource: env.MCP_FIXTURE_RESOURCE,
      issuer: "https://clerk-mcp-fixture.example",
      async authenticate(input) {
        const token = mcpBearerToken(input);
        if (token !== "oat_fixture_read" && token !== "oat_fixture_write") throw new McpAuthError(401, "Unknown fixture token.");
        const authorization = mcpVerifiedClerkAuthorization({
          object: "clerk_idp_oauth_access_token", id: "fixture-token", client_id: "fixture-client",
          subject: "user_McpWorkerd", scopes: token === "oat_fixture_write" ? ["pecu:read", "pecu:write"] : ["pecu:read"],
          revoked: false, expired: false, expiration: Math.floor(Date.now() / 1000) + 3600, aud: [env.MCP_FIXTURE_RESOURCE],
        }, env.MCP_FIXTURE_RESOURCE);
        return { ...authorization, senderId: webSenderId(authorization.userId, []), token, resource: env.MCP_FIXTURE_RESOURCE };
      },
      async execute(principal, input) {
        dispatches++;
        const tool = mcpToolCatalog.find(tool => tool.name === input.name);
        if (!tool) throw new Error("Unknown fixture tool");
        const argumentsValue = jsonObjectSchema.parse(tool.input.parse(input.arguments));
        return { text: JSON.stringify({ senderId: principal.senderId, name: input.name, arguments: argumentsValue, requestId: input.requestId }), isError: false };
      },
    });
    return endpoint.fetch(request);
  },
};
