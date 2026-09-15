import { handleCodexRequest, maxCodexRequestBytes } from "../cloudflare/codex-protocol";

Bun.serve({
  port: 8080,
  hostname: "0.0.0.0",
  maxRequestBodySize: maxCodexRequestBytes,
  idleTimeout: 150,
  async fetch(request) {
    if (new URL(request.url).pathname === "/health" && request.method === "GET") return new Response("OK");
    try {
      return await handleCodexRequest(request, (outbound) => fetch(outbound));
    } catch {
      return Response.json({ error: { message: "Codex transport request failed" } }, { status: 502 });
    }
  },
});
