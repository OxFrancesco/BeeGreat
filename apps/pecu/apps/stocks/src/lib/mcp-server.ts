import { createPecuMcpEndpoint } from "../../../../src/mcp";
import { mcpCallResultSchema, mcpScopeSchema } from "../../../../src/mcp-contract";
import { agentRequest } from "./server";
import { pecuMcpAuthenticate, pecuMcpConfig } from "./mcp-auth";

const config = pecuMcpConfig();
export const pecuMcpEndpoint = createPecuMcpEndpoint({
  ...config,
  authenticate: request => pecuMcpAuthenticate(request, config),
  execute: async (principal, input) => {
    const response = await agentRequest("mcp-call", {
      ...input,
      identity: { userId: principal.userId, senderId: principal.senderId },
      clientId: principal.clientId,
      scopes: principal.scopes.filter(scope => mcpScopeSchema.safeParse(scope).success),
    });
    if (!response.ok) throw new Error("Pecu tool connection is unavailable");
    return mcpCallResultSchema.parse(await response.json());
  },
});
