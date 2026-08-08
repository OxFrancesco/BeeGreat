import { describe, expect, test } from "bun:test";

import { runTelegramCommand } from "./telegram";

describe("Bee CLI Telegram", () => {
  test("uses the authenticated Bee agent boundary for status", async () => {
    let request: Request | undefined;
    const result = await runTelegramCommand(
      { action: "status" },
      { agentUrl: "https://bee.example/", accessToken: "clerk-token" },
      {
        fetch: async (input, init) => {
          request = new Request(input, init);
          return Response.json({
            status: "connected",
            displayName: "Francesco",
            username: "francesco",
          });
        },
      },
    );

    expect(result).toBe("Telegram is connected as @francesco.");
    expect(request?.url).toBe("https://bee.example/cli/telegram");
    expect(request?.headers.get("authorization")).toBe("Bearer clerk-token");
    expect(await request?.json()).toEqual({ action: "status" });
  });

  test("opens Telegram Login and waits for the linked account", async () => {
    const actions: string[] = [];
    let openedUrl: string | undefined;
    const result = await runTelegramCommand(
      { action: "connect" },
      { agentUrl: "https://bee.example", accessToken: "clerk-token" },
      {
        fetch: async (_input, init) => {
          const body = JSON.parse(String(init?.body)) as { action: string };
          actions.push(body.action);
          return Response.json(
            body.action === "connect"
              ? { authorizationUrl: "https://oauth.telegram.org/auth?fixture=1" }
              : actions.length === 1
                ? { status: "missing" }
                : { status: "connected", displayName: "Francesco" },
          );
        },
        openBrowser: async (url) => {
          openedUrl = url;
        },
        sleep: async () => undefined,
      },
    );

    expect(openedUrl).toBe("https://oauth.telegram.org/auth?fixture=1");
    expect(actions).toEqual(["status", "connect", "status"]);
    expect(result).toBe("Telegram is connected as Francesco.");
  });
});
