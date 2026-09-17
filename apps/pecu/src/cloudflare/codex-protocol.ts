export const codexEndpoint = "https://chatgpt.com/backend-api/codex/responses";
export const codexModel = "gpt-5.6-sol";
export const codexSmallModel = "gpt-5.6-luna";
export const maxCodexRequestBytes = 8 * 1024 * 1024;

const requestHeaders = ["authorization", "chatgpt-account-id", "content-type", "accept", "originator", "session-id", "user-agent", "openai-beta", "x-codex-beta-features"];
const responseHeaders = ["content-type", "cache-control", "x-request-id", "openai-processing-ms", "retry-after", "cf-ray"];

export async function handleCodexRequest(request: Request, send: (request: Request) => Promise<Response>): Promise<Response> {
  const url = new URL(request.url);
  if (url.pathname !== "/responses" || url.search || request.method !== "POST") return new Response(null, { status: 404 });
  if (!request.headers.get("authorization")?.startsWith("Bearer ") || !request.headers.get("chatgpt-account-id")) {
    return Response.json({ error: { message: "ChatGPT subscription authorization is required" } }, { status: 401 });
  }
  const reader = request.body?.getReader();
  if (!reader) return new Response(null, { status: 400 });
  const chunks: ArrayBuffer[] = [];
  let length = 0;
  for (;;) {
    const chunk = await reader.read();
    if (chunk.done) break;
    length += chunk.value.byteLength;
    if (length > maxCodexRequestBytes) {
      await reader.cancel();
      return new Response(null, { status: 413 });
    }
    chunks.push(new Uint8Array(chunk.value).buffer);
  }
  const body = await new Blob(chunks).text();
  try {
    const input = JSON.parse(body);
    if ((input?.model !== codexModel && input?.model !== codexSmallModel) || input.store !== false || input.stream !== true) throw new Error("Invalid Codex request");
  } catch {
    return Response.json({ error: { message: "Expected the configured Codex model with stream enabled and storage disabled" } }, { status: 400 });
  }
  const headers = new Headers();
  for (const name of requestHeaders) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  const response = await send(new Request(codexEndpoint, {
    method: "POST", headers, body, redirect: "manual",
    signal: AbortSignal.any([request.signal, AbortSignal.timeout(120_000)]),
  }));
  const outputHeaders = new Headers();
  for (const name of responseHeaders) {
    const value = response.headers.get(name);
    if (value) outputHeaders.set(name, value);
  }
  return new Response(response.body, { status: response.status, headers: outputHeaders });
}
