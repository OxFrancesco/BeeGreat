import { chatGptConnectionRequired } from "../../../../src/inference-recovery";
export function connectionFixture() {
  if (!new URLSearchParams(location.search).has("connection-test")) return;
  const messages: object[] = [];
  let login: object | null = null;
  window.fetch = async (input, init) => {
    const path = new URL(String(input), location.origin).pathname;
    if (path.endsWith("/inference-connect")) login = { url: "https://auth.openai.com/codex/device", instructions: "Enter code: DEMO-1234", userCode: "DEMO-1234", expiresAt: Date.now() + 600000 };
    if (path.endsWith("/inference-disconnect")) login = null;
    if (/\/inference(?:-connect|-disconnect)?$/.test(path)) return Response.json({ model: "openai/gpt-5.6-sol", reasoning: "high", connected: false, checkedAt: Date.now(), lastResponse: null, loginState: login ? "pending" : null, login });
    if (path.endsWith("/threads")) return Response.json({ threads: [], olderCursor: null, newerCursor: null });
    if (path.endsWith("/turn")) {
      const body = JSON.parse(String(init?.body));
      messages.push({ id: `stocks:test:${body.requestId}`, text: body.text, createdAt: Date.now(), reply: { text: chatGptConnectionRequired, preview: null, recovery: "connect_chatgpt" } });
      return Response.json({ status: "complete" });
    }
    if (path.endsWith("/state")) return Response.json({ wallet: "0x1234567890123456789012345678901234567890", yolo: false, messages, stocks: null, stocksAt: null, basket: null });
    throw new Error("Connection fixture does not start OAuth or execute transactions.");
  };
}
