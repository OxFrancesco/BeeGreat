import { describe, expect, test } from "bun:test";

import { parseBeeReply, projectBeeReply } from "./reply";

describe("Bee CLI replies", () => {
  test("renders generated task UI without exposing machine ids or raw JSON", () => {
    const reply = projectBeeReply(`Here is your next focus.

\`\`\`beeui
{"components":[{"type":"tasks","title":"Today","items":[{"id":"j970abcdefghijklmno1234567890abc","title":"Draft the launch note","done":false,"due":"Friday"}]}]}
\`\`\``);

    expect(reply).toBe(
      "Here is your next focus.\n\nToday\n[ ] Draft the launch note — Friday",
    );
    expect(reply).not.toContain("j970");
    expect(reply).not.toContain('"components"');
  });

  test("renders confirmation and first-focus cards as terminal actions", () => {
    const raw = `Ready when you are.
\`\`\`beeui
{"components":[{"type":"first_focus","requestId":"request_123456789","goalTitle":"Ship BeeGreat","projectTitle":"CLI","taskTitle":"Run the smoke test"},{"type":"confirm","summary":"Publish the release","action":"publish"}]}
\`\`\``;
    const reply = projectBeeReply(raw);

    expect(reply).toContain("Your first focus");
    expect(reply).toContain("Goal: Ship BeeGreat");
    expect(reply).toContain("Reply yes to create it or no to cancel.");
    expect(reply).toContain("Publish the release");
    expect(reply).not.toContain("request_123456789");
    expect(parseBeeReply(raw).firstFocus).toEqual({
      requestId: "request_123456789",
      goalTitle: "Ship BeeGreat",
      projectTitle: "CLI",
      taskTitle: "Run the smoke test",
    });
  });

  test("retains guarded Web3 confirmation data outside visible text", () => {
    const reply = parseBeeReply(`Check this carefully.
\`\`\`beeui
{"components":[{"type":"confirm","summary":"Swap 10 USDC for ETH","action":"web3","payload":{"web3ActionId":"action_123456789"}}]}
\`\`\``);

    expect(reply.web3Confirmation).toEqual({
      actionId: "action_123456789",
      summary: "Swap 10 USDC for ETH",
    });
    expect(reply.text).not.toContain("action_123456789");
  });
});
