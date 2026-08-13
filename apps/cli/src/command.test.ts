import { describe, expect, test } from "bun:test";

import { parseCommand } from "./command";

describe("Bee CLI commands", () => {
  test("treats unqualified words as a one-shot prompt", () => {
    expect(parseCommand(["Plan", "my", "day"])).toEqual({
      kind: "ask",
      prompt: "Plan my day",
    });
  });

  test("supports explicit chat, ask, auth, new, and help commands", () => {
    expect(parseCommand([])).toEqual({ kind: "chat" });
    expect(parseCommand(["chat"])).toEqual({ kind: "chat" });
    expect(parseCommand(["ask", "Find", "my", "focus"])).toEqual({
      kind: "ask",
      prompt: "Find my focus",
    });
    expect(parseCommand(["new"])).toEqual({ kind: "new" });
    expect(parseCommand(["login"])).toEqual({ kind: "login" });
    expect(parseCommand(["logout"])).toEqual({ kind: "logout" });
    expect(parseCommand(["telegram"])).toEqual({
      kind: "telegram",
      action: "connect",
    });
    expect(parseCommand(["telegram", "notify", "Focus", "now"])).toEqual({
      kind: "telegram",
      action: "notify",
      message: "Focus now",
    });
    expect(parseCommand(["buddytg", "whoami"])).toEqual({
      kind: "buddytg",
      args: ["whoami"],
    });
    expect(parseCommand(["--help"])).toEqual({ kind: "help" });
  });

  test("rejects an empty explicit prompt", () => {
    expect(() => parseCommand(["ask"])).toThrow("Tell Bee what to do");
  });

  test("validates Telegram subcommands", () => {
    expect(() => parseCommand(["telegram", "notify"])).toThrow(
      "Tell Bee what to send",
    );
    expect(() => parseCommand(["telegram", "wat"])).toThrow(
      "telegram connect|status|disconnect|notify",
    );
  });

  test("parses iMessage subcommands", () => {
    expect(parseCommand(["imessage"])).toEqual({
      kind: "imessage",
      action: "status",
    });
    expect(parseCommand(["imessage", "status"])).toEqual({
      kind: "imessage",
      action: "status",
    });
    expect(parseCommand(["imessage", "disconnect"])).toEqual({
      kind: "imessage",
      action: "disconnect",
    });
    expect(parseCommand(["imessage", "disconnect", "+15551234567"])).toEqual({
      kind: "imessage",
      action: "disconnect",
      address: "+15551234567",
    });
    expect(() => parseCommand(["imessage", "wat"])).toThrow(
      "imessage status|disconnect",
    );
    expect(() => parseCommand(["imessage", "status", "extra"])).toThrow(
      "does not accept arguments",
    );
  });
});
