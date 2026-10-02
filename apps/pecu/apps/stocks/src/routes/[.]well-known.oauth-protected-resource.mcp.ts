import { createFileRoute } from "@tanstack/react-router";
import { pecuMcpEndpoint } from "../lib/mcp-server";

export const Route = createFileRoute("/.well-known/oauth-protected-resource/mcp")({
  server: { handlers: { GET: ({ request }) => pecuMcpEndpoint.fetch(request) } },
});
