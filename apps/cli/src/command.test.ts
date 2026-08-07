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
    expect(parseCommand(["--help"])).toEqual({ kind: "help" });
  });

  test("rejects an empty explicit prompt", () => {
    expect(() => parseCommand(["ask"])).toThrow("Tell Bee what to do");
  });
});
