import { describe, expect, test } from "bun:test";
import { codexEndpoint, codexModel, handleCodexRequest, maxCodexRequestBytes } from "../src/cloudflare/codex-protocol";
import { codexContainerFetch } from "../src/cloudflare/codex-fetch";

function request(patch: Record<string, unknown> = {}, path = "/responses") {
  return new Request(`https://codex.internal${path}`, {
    method: "POST",
    headers: { authorization: "Bearer test-token", "chatgpt-account-id": "test-account", "content-type": "application/json", "x-unrelated-secret": "must-not-forward" },
    body: JSON.stringify({ model: codexModel, stream: true, store: false, input: [], ...patch }),
  });
}

describe("Codex container transport", () => {
  test("allows Luna with the same subscription and storage protections", async () => {
    const response = await handleCodexRequest(request({ model: "gpt-6-luna" }), async (outbound) => {
      expect(await outbound.json()).toMatchObject({ model: "gpt-6-luna", store: false, stream: true });
      return new Response("ok");
    });
    expect(response.status).toBe(200);
    expect((await handleCodexRequest(request({ model: "gpt-6-luna", store: true }), async () => { throw new Error("must not send"); })).status).toBe(400);
  });
  test("keeps the Codex request and event stream intact without forwarding unrelated headers", async () => {
    const frames = 'data: {"type":"response.completed"}\n\n';
    let calls = 0;
    const response = await handleCodexRequest(request(), async (outbound) => {
      calls++;
      expect(outbound.url).toBe(codexEndpoint);
      expect(outbound.redirect).toBe("manual");
      expect(outbound.headers.get("authorization")).toBe("Bearer test-token");
      expect(outbound.headers.get("chatgpt-account-id")).toBe("test-account");
      expect(outbound.headers.has("x-unrelated-secret")).toBe(false);
      expect(await outbound.json()).toMatchObject({ model: codexModel, stream: true, store: false });
      return new Response(frames, { headers: { "content-type": "text/event-stream", "x-request-id": "request-1", "set-cookie": "must-not-forward" } });
    });
    expect(calls).toBe(1);
    expect(response.headers.get("x-request-id")).toBe("request-1");
    expect(response.headers.has("set-cookie")).toBe(false);
    expect(await response.text()).toBe(frames);
  });

  test("rejects unsupported paths, missing subscription authorization, storage, and oversized bodies before sending", async () => {
    const send = async () => { throw new Error("Must not send rejected requests"); };
    expect((await handleCodexRequest(request({}, "/other"), send)).status).toBe(404);
    expect((await handleCodexRequest(request({}, "/responses?destination=example.com"), send)).status).toBe(404);
    expect((await handleCodexRequest(request({ model: "other" }), send)).status).toBe(400);
    expect((await handleCodexRequest(request({ store: true }), send)).status).toBe(400);
    const missing = request();
    missing.headers.delete("authorization");
    expect((await handleCodexRequest(missing, send)).status).toBe(401);
    expect((await handleCodexRequest(request({ input: "a".repeat(maxCodexRequestBytes) }), send)).status).toBe(413);
  });

  test("preserves provider errors and never retries them", async () => {
    let calls = 0;
    const response = await handleCodexRequest(request(), async () => {
      calls++;
      return new Response('{"error":{"message":"rate limited"}}', { status: 429, headers: { "retry-after": "30" } });
    });
    expect(calls).toBe(1);
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("30");
  });

  test("routes a Codex request through the private service binding", async () => {
    let received: Request | undefined;
    const send = codexContainerFetch({ fetch: async (input) => {
      received = new Request(input);
      return new Response("stream");
    } });
    const original = request();
    const response = await send(new Request(codexEndpoint, original));
    expect(received?.url).toBe("https://codex.internal/responses");
    expect(received?.headers.get("chatgpt-account-id")).toBe("test-account");
    expect(await received?.json()).toMatchObject({ model: codexModel });
    expect(await response.text()).toBe("stream");
  });
});
