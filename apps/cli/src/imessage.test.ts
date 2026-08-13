import { describe, expect, test } from "bun:test";

import { runImessageCommand } from "./imessage";

describe("Bee CLI iMessage", () => {
  test("lists linked senders through the authenticated agent boundary", async () => {
    let request: Request | undefined;
    const result = await runImessageCommand(
      { action: "status" },
      { agentUrl: "https://bee.example/", accessToken: "clerk-token" },
      {
        fetch: async (input, init) => {
          request = new Request(input, init);
          return Response.json({
            connections: [
              {
                address: "+15551234567",
                addressKind: "phone",
                connectedAt: Date.parse("2026-08-01T00:00:00Z"),
              },
            ],
          });
        },
      },
    );

    expect(result).toContain("+15551234567");
    expect(request?.url).toBe("https://bee.example/cli/imessage");
    expect(request?.headers.get("authorization")).toBe("Bearer clerk-token");
    expect(await request?.json()).toEqual({ action: "status" });
  });

  test("explains how to link when nothing is connected", async () => {
    const result = await runImessageCommand(
      { action: "status" },
      { agentUrl: "https://bee.example", accessToken: "clerk-token" },
      { fetch: async () => Response.json({ connections: [] }) },
    );
    expect(result).toContain("not connected");
  });

  test("disconnects one exact address", async () => {
    let body: unknown;
    const result = await runImessageCommand(
      { action: "disconnect", address: "+15551234567" },
      { agentUrl: "https://bee.example", accessToken: "clerk-token" },
      {
        fetch: async (_input, init) => {
          body = JSON.parse(String(init?.body));
          return Response.json({ disconnected: 1 });
        },
      },
    );
    expect(body).toEqual({ action: "disconnect", address: "+15551234567" });
    expect(result).toBe("Disconnected 1 iMessage address from BeeGreat.");
  });

  test("surfaces agent errors", async () => {
    await expect(
      runImessageCommand(
        { action: "status" },
        { agentUrl: "https://bee.example", accessToken: "clerk-token" },
        {
          fetch: async () =>
            Response.json({ error: "Sign in to talk to Bee." }, { status: 401 }),
        },
      ),
    ).rejects.toThrow("Sign in to talk to Bee.");
  });
});
