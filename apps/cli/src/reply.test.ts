import { describe, expect, test } from "bun:test";

import {
  parseBeeReply,
  projectBeeReply,
  projectStreamingBeeReply,
  resolveQuestionAnswer,
} from "./reply";

describe("Bee CLI replies", () => {
  test("does not expose an incomplete generative UI payload while streaming", () => {
    expect(
      projectStreamingBeeReply(
        'Here is your plan.\n```beeui\n{"components":[{"type":"tasks","items":[{"id":"task_machine_id',
      ),
    ).toBe("Here is your plan.");
  });

  test("renders generated task UI without exposing machine ids or raw JSON", () => {
    const reply = projectBeeReply(`Here is your next focus.

\`\`\`beeui
{"components":[{"type":"tasks","title":"Today","items":[{"id":"j970abcdefghijklmno1234567890abc","title":"Draft the launch note","done":false,"due":"Friday"}]}]}
\`\`\``);

    expect(reply).toBe(
      "Here is your next focus.\n\n**Today**\n☐ Draft the launch note — Friday\nReply with the exact Task you want Bee to work with.",
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
    expect(reply).toContain("Reply **yes** to create it or **no** to cancel.");
    expect(reply).toContain("Publish the release");
    expect(reply).not.toContain("request_123456789");
    expect(parseBeeReply(raw).firstFocus).toEqual({
      type: "first_focus",
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

  test("renders numbered question choices and resolves a selected answer", () => {
    const reply = parseBeeReply(`One detail first.
\`\`\`beeui
{"components":[{"type":"question","questions":[{"header":"Network","question":"Which network should I use?","options":[{"label":"Base","description":"Use the Base position."},{"label":"Arbitrum","description":"Use Arbitrum instead."}]}]}]}
\`\`\``);

    expect(reply.text).toContain("Network — Which network should I use?");
    expect(reply.text).toContain("[1] Base — Use the Base position.");
    expect(reply.text).toContain("[2] Arbitrum — Use Arbitrum instead.");
    expect(reply.text).toContain("Reply with a number or type your own answer.");
    expect(resolveQuestionAnswer(reply.question, "2")).toBe(
      'For “Which network should I use?”, my answer is “Arbitrum”.',
    );
    expect(resolveQuestionAnswer(reply.question, "A different chain")).toBe(
      "A different chain",
    );
  });

  test("resolves one numbered choice for each question", () => {
    const reply = parseBeeReply(`Choose both.
\`\`\`beeui
{"components":[{"type":"question","questions":[{"header":"Network","question":"Which network?","options":[{"label":"Base"},{"label":"Arbitrum"}]},{"header":"Speed","question":"Which speed?","options":[{"label":"Fast"},{"label":"Careful"}]}]}]}
\`\`\``);

    expect(reply.text).toContain("Reply with one number per question");
    expect(resolveQuestionAnswer(reply.question, "1, 4")).toBe(
      'For “Which network?”, my answer is “Base”.\nFor “Which speed?”, my answer is “Careful”.',
    );
    expect(resolveQuestionAnswer(reply.question, "1")).toBe("1");
  });

  test("extracts a generic confirmation for the interactive prompt", () => {
    const reply = parseBeeReply(`Ready to publish.
\`\`\`beeui
{"components":[{"type":"confirm","summary":"Publish the release","action":"publish"}]}
\`\`\``);

    expect(reply.confirmation).toEqual({ summary: "Publish the release" });
    expect(reply.web3Confirmation).toBeUndefined();
  });

  test("keeps Devin session and pull request links in the terminal projection", () => {
    const reply = projectBeeReply(`Devin is on it.
\`\`\`beeui
{"components":[{"type":"devin","title":"Fix the flaky test","status":"working","sessionId":"devin-abc123456","sessionUrl":"https://app.devin.ai/sessions/abc123456","pullRequests":[{"url":"https://github.com/org/repo/pull/7","state":"open"}]}]}
\`\`\``);

    expect(reply).toContain("Fix the flaky test");
    expect(reply).toContain("Pull request — open");
    expect(reply).toContain("https://github.com/org/repo/pull/7");
    expect(reply).toContain("https://app.devin.ai/sessions/abc123456");
    expect(reply).not.toContain("devin-abc123456");
  });

  test("degrades unknown components instead of silently dropping them", () => {
    const reply = projectBeeReply(`Take a look.
\`\`\`beeui
{"components":[{"type":"hologram","body":"Something new"}]}
\`\`\``);

    expect(reply).toContain(
      "Bee shared an interactive card that can’t be displayed here. Open BeeGreat to continue.",
    );
    expect(reply).not.toContain("hologram");
  });

  test("drops malformed question cards instead of presenting invalid choices", () => {
    const reply = parseBeeReply(`Please choose.
\`\`\`beeui
{"components":[{"type":"question","questions":[{"header":"Network","question":"Which network?","options":[{"label":"Base"}]}]}]}
\`\`\``);

    expect(reply).toEqual({ text: "Please choose." });
  });
});
