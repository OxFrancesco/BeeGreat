import { afterEach, describe, expect, test } from "bun:test";
import { createTestRenderer, type TestRenderer } from "@opentui/core/testing";

import { createBeeTui } from "./tui";

let renderer: TestRenderer | undefined;

afterEach(() => {
  renderer?.destroy();
  renderer = undefined;
});

describe("Bee OpenTUI", () => {
  test("renders the calm-hive conversation shell", async () => {
    const setup = await createTestRenderer({ width: 80, height: 24 });
    renderer = setup.renderer;
    createBeeTui(renderer, {
      ask: async () => ({ text: "Done." }),
      newConversation: async () => undefined,
      friendlyError: String,
    });
    const frame = await setup.waitForFrame((frame) =>
      frame.includes("What would you like to make progress on?"),
    );

    expect(frame).toContain("⬡ Bee");
    expect(frame).not.toContain("ready");
    expect(frame).not.toContain("local agent");
    expect(frame).not.toContain("●");
    expect(frame).toContain("Message your personal assistant");
  });

  test("updates a tool activity line in place from running to done", async () => {
    const setup = await createTestRenderer({ width: 80, height: 24 });
    renderer = setup.renderer;
    const tui = createBeeTui(renderer, {
      ask: async (_prompt, onActivity) => {
        onActivity({
          id: "tool-1",
          state: "running",
          label: "Searching your Mind…",
        });
        onActivity({
          id: "tool-1",
          state: "done",
          label: "Searched your Mind",
        });
        return { text: "Your next focus is ready." };
      },
      newConversation: async () => undefined,
      friendlyError: String,
    });

    await tui.submitPrompt("Plan my day");
    const frame = await setup.waitForFrame((frame) =>
      frame.includes("Your next focus is ready."),
    );
    expect(frame).toContain("Plan my day");
    expect(frame).toContain("✓ Searched your Mind");
    expect(frame).not.toContain("Searching your Mind…");
  });

  test("streams the final agent step without retaining an earlier draft", async () => {
    const setup = await createTestRenderer({ width: 80, height: 24 });
    renderer = setup.renderer;
    const tui = createBeeTui(renderer, {
      ask: async (_prompt, _activity, reply) => {
        reply({ type: "reset" });
        reply({ type: "replace", text: "First draft." });
        reply({ type: "reset" });
        reply({ type: "replace", text: "Final answer." });
        return { text: "Final answer." };
      },
      newConversation: async () => undefined,
      friendlyError: String,
    });

    await tui.submitPrompt("Hello");
    const frame = await setup.waitForFrame((frame) =>
      frame.includes("Final answer."),
    );
    expect(frame).not.toContain("First draft.");
    expect(frame.match(/Final answer\./g)).toHaveLength(1);
  });

  test("submits the focused composer with Enter", async () => {
    const setup = await createTestRenderer({ width: 80, height: 24 });
    renderer = setup.renderer;
    const prompts: string[] = [];
    createBeeTui(renderer, {
      ask: async (prompt) => {
        prompts.push(prompt);
        return { text: "On it." };
      },
      newConversation: async () => undefined,
      friendlyError: String,
    });

    await setup.mockInput.typeText("Plan my day");
    setup.mockInput.pressEnter();
    await setup.waitFor(() => prompts.length === 1);
    expect(prompts).toEqual(["Plan my day"]);
  });

  test("offers OpenCode-style slash command completion", async () => {
    const setup = await createTestRenderer({ width: 80, height: 24 });
    renderer = setup.renderer;
    const tui = createBeeTui(renderer, {
      ask: async () => ({ text: "Done." }),
      newConversation: async () => undefined,
      friendlyError: String,
    });

    await setup.mockInput.typeText("/n");
    await setup.renderOnce();
    expect(setup.captureCharFrame()).toContain("/new");
    expect(setup.captureCharFrame()).toContain("Start a fresh conversation");
    expect(setup.captureCharFrame()).not.toContain("/clear");

    setup.mockInput.pressTab();
    expect(tui.input.plainText).toBe("/new");
  });

  test("recalls recent prompts with the up arrow", async () => {
    const setup = await createTestRenderer({ width: 80, height: 24 });
    renderer = setup.renderer;
    const tui = createBeeTui(renderer, {
      ask: async () => ({ text: "Done." }),
      newConversation: async () => undefined,
      friendlyError: String,
      history: {
        entries: ["Earlier prompt"],
        append: async () => undefined,
      },
    });

    setup.mockInput.pressArrow("up");
    expect(tui.input.plainText).toBe("Earlier prompt");
  });

  test("answers an ask-user question through the interactive select", async () => {
    const setup = await createTestRenderer({ width: 80, height: 24 });
    renderer = setup.renderer;
    const prompts: string[] = [];
    const tui = createBeeTui(renderer, {
      ask: async (prompt) => {
        prompts.push(prompt);
        if (prompts.length > 1) return { text: "Arbitrum it is." };
        return {
          text: "One detail first.",
          followUp: {
            kind: "question",
            question: {
              questions: [
                {
                  header: "Network",
                  question: "Which network should I use?",
                  options: [
                    { label: "Base", description: "Use the Base position." },
                    { label: "Arbitrum", description: "Use Arbitrum instead." },
                  ],
                },
              ],
            },
          },
        };
      },
      newConversation: async () => undefined,
      friendlyError: String,
    });

    await tui.submitPrompt("Move the position");
    const frame = await setup.waitForFrame((frame) =>
      frame.includes("Network — Which network should I use?"),
    );
    expect(frame).toContain("Base");
    expect(frame).toContain("Type something else");

    setup.mockInput.pressArrow("down");
    setup.mockInput.pressEnter();
    await setup.waitFor(() => prompts.length === 2);
    expect(prompts[1]).toBe("2");

    await setup.waitForFrame((frame) => frame.includes("Arbitrum it is."));
  });

  test("collects one select answer per question before replying", async () => {
    const setup = await createTestRenderer({ width: 80, height: 24 });
    renderer = setup.renderer;
    const prompts: string[] = [];
    const tui = createBeeTui(renderer, {
      ask: async (prompt) => {
        prompts.push(prompt);
        if (prompts.length > 1) return { text: "Done." };
        return {
          text: "Two details first.",
          followUp: {
            kind: "question",
            question: {
              questions: [
                {
                  header: "Network",
                  question: "Which network?",
                  options: [{ label: "Base" }, { label: "Arbitrum" }],
                },
                {
                  header: "Speed",
                  question: "Which speed?",
                  options: [{ label: "Fast" }, { label: "Careful" }],
                },
              ],
            },
          },
        };
      },
      newConversation: async () => undefined,
      friendlyError: String,
    });

    await tui.submitPrompt("Move it");
    await setup.waitForFrame((frame) => frame.includes("(1/2)"));

    setup.mockInput.pressEnter();
    await setup.waitForFrame((frame) => frame.includes("(2/2)"));

    setup.mockInput.pressArrow("down");
    setup.mockInput.pressEnter();
    await setup.waitFor(() => prompts.length === 2);
    expect(prompts[1]).toBe("1, 4");
  });

  test("confirms a guarded action through the yes/no select", async () => {
    const setup = await createTestRenderer({ width: 80, height: 24 });
    renderer = setup.renderer;
    const prompts: string[] = [];
    const tui = createBeeTui(renderer, {
      ask: async (prompt) => {
        prompts.push(prompt);
        if (prompts.length > 1) return { text: "Confirmed." };
        return {
          text: "Needs your confirmation.",
          followUp: { kind: "confirm", summary: "Swap 10 USDC for ETH" },
        };
      },
      newConversation: async () => undefined,
      friendlyError: String,
    });

    await tui.submitPrompt("Prepare the swap");
    const frame = await setup.waitForFrame((frame) =>
      frame.includes("Swap 10 USDC for ETH"),
    );
    expect(frame).toContain("Yes");
    expect(frame).toContain("No");

    setup.mockInput.pressEnter();
    await setup.waitFor(() => prompts.length === 2);
    expect(prompts[1]).toBe("yes");
  });

  test("dismisses an interactive prompt with escape to type a custom answer", async () => {
    const setup = await createTestRenderer({ width: 80, height: 24 });
    renderer = setup.renderer;
    const prompts: string[] = [];
    const tui = createBeeTui(renderer, {
      ask: async (prompt) => {
        prompts.push(prompt);
        if (prompts.length > 1) return { text: "Understood." };
        return {
          text: "Needs your confirmation.",
          followUp: { kind: "confirm", summary: "Swap 10 USDC for ETH" },
        };
      },
      newConversation: async () => undefined,
      friendlyError: String,
    });

    await tui.submitPrompt("Prepare the swap");
    await setup.waitForFrame((frame) => frame.includes("Swap 10 USDC for ETH"));
    setup.mockInput.pressEscape();
    // A lone ESC is only emitted after the terminal disambiguation timeout.
    await new Promise((resolve) => setTimeout(resolve, 150));
    await setup.mockInput.typeText("use only half");
    setup.mockInput.pressEnter();
    await setup.waitFor(() => prompts.length === 2);
    expect(prompts[1]).toBe("use only half");
  });

  test("shows background boot progress as a live activity line", async () => {
    const setup = await createTestRenderer({ width: 80, height: 24 });
    renderer = setup.renderer;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    createBeeTui(renderer, {
      ask: async () => ({ text: "Done." }),
      boot: async (onActivity) => {
        onActivity({
          id: "agent-boot",
          state: "running",
          label: "Waking up the local Bee agent…",
        });
        await gate;
        onActivity({
          id: "agent-boot",
          state: "done",
          label: "Local Bee agent is ready",
        });
      },
      newConversation: async () => undefined,
      friendlyError: String,
    });

    const booting = await setup.waitForFrame((frame) =>
      frame.includes("Waking up the local Bee agent…"),
    );
    expect(booting).toContain("Message your personal assistant");

    release();
    const ready = await setup.waitForFrame((frame) =>
      frame.includes("✓ Local Bee agent is ready"),
    );
    expect(ready).not.toContain("Waking up the local Bee agent…");
  });

  test("queues a prompt typed while Bee is working", async () => {
    const setup = await createTestRenderer({ width: 80, height: 24 });
    renderer = setup.renderer;
    const prompts: string[] = [];
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const tui = createBeeTui(renderer, {
      ask: async (prompt) => {
        prompts.push(prompt);
        if (prompts.length === 1) await gate;
        return { text: `Answered ${prompt}.` };
      },
      newConversation: async () => undefined,
      friendlyError: String,
    });

    const first = tui.submitPrompt("First question");
    await setup.mockInput.typeText("Second question");
    setup.mockInput.pressEnter();
    release();
    await first;
    await setup.waitFor(() => prompts.length === 2);
    expect(prompts).toEqual(["First question", "Second question"]);
  });
});
