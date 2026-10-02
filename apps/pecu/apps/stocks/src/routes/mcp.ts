import { createFileRoute } from "@tanstack/react-router";
import { pecuMcpEndpoint } from "../lib/mcp-server";

const handle = ({ request }: { request: Request }) => pecuMcpEndpoint.fetch(request);
export const Route = createFileRoute("/mcp")({
  server: { handlers: { GET: handle, POST: handle, DELETE: handle, OPTIONS: handle, HEAD: handle } },
});
