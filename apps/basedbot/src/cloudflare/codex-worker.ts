import { Container } from "@cloudflare/containers";

export class CodexContainer extends Container {
  override defaultPort = 8080;
  override sleepAfter = "5m";
}

type CodexEnv = { CODEX: DurableObjectNamespace<CodexContainer> };

export default {
  fetch(request: Request, env: CodexEnv): Promise<Response> | Response {
    const url = new URL(request.url);
    if (url.pathname !== "/responses" || url.search || request.method !== "POST") return new Response(null, { status: 404 });
    return env.CODEX.getByName("basedbot").fetch(request);
  },
} satisfies ExportedHandler<CodexEnv>;
