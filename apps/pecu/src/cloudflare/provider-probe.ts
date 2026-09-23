export async function probeChatGptBoundary() {
  const startedAt = Date.now();
  const response = await fetch("https://chatgpt.com/backend-api/codex/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer pecu-diagnostic-invalid-token",
      "User-Agent": "opencode/0.0.0-beta-18684",
      originator: "opencode",
    },
    body: JSON.stringify({ model: "gpt-6-sol", input: "Reply exactly OK.", stream: true, store: false }),
    signal: AbortSignal.timeout(15_000),
  });
  return {
    status: response.status,
    elapsedMs: Date.now() - startedAt,
    contentType: response.headers.get("content-type"),
    server: response.headers.get("server"),
    body: (await response.text()).replace(/<(style|script|svg)\b[^>]*>[\s\S]*?<\/\1>/gi, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 2_000),
  };
}
