import { createFileRoute } from "@tanstack/react-router";
import { pecuMcpEndpoint } from "../lib/mcp-server";

export const Route = createFileRoute("/.well-known/oauth-protected-resource")({
  server: { handlers: { GET: ({ request }) => pecuMcpEndpoint.fetch(request) } },
});
