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
      ask: async () => "Done.",
      newConversation: async () => undefined,
      friendlyError: String,
    });
    await setup.renderOnce();
    const frame = setup.captureCharFrame();

    expect(frame).toContain("⬡ Bee");
    expect(frame).not.toContain("ready");
    expect(frame).not.toContain("local agent");
    expect(frame).not.toContain("●");
    expect(frame).toContain("What would you like to make progress on?");
    expect(frame).toContain("Message your personal assistant");
  });

  test("adds user and assistant messages without leaving the TUI", async () => {
    const setup = await createTestRenderer({ width: 80, height: 24 });
    renderer = setup.renderer;
    const tui = createBeeTui(renderer, {
      ask: async (_prompt, progress) => {
        progress("Searched your Mind ✓");
        return "Your next focus is ready.";
      },
      newConversation: async () => undefined,
      friendlyError: String,
    });

    await tui.submitPrompt("Plan my day");
    await setup.renderOnce();
    const frame = setup.captureCharFrame();
    expect(frame).toContain("Plan my day");
    expect(frame).toContain("Searched your Mind ✓");
    expect(frame).toContain("Your next focus is ready.");
  });

  test("streams the final agent step without retaining an earlier draft", async () => {
    const setup = await createTestRenderer({ width: 80, height: 24 });
    renderer = setup.renderer;
    const tui = createBeeTui(renderer, {
      ask: async (_prompt, _progress, reply) => {
        reply({ type: "reset" });
        reply({ type: "replace", text: "First draft." });
        reply({ type: "reset" });
        reply({ type: "replace", text: "Final answer." });
        return "Final answer.";
      },
      newConversation: async () => undefined,
      friendlyError: String,
    });

    await tui.submitPrompt("Hello");
    await setup.renderOnce();
    const frame = setup.captureCharFrame();
    expect(frame).toContain("Final answer.");
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
        return "On it.";
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
      ask: async () => "Done.",
      newConversation: async () => undefined,
      friendlyError: String,
    });

    await setup.mockInput.typeText("/n");
    await setup.renderOnce();
    expect(setup.captureCharFrame()).toContain("/new");
    expect(setup.captureCharFrame()).toContain("Start a fresh conversation");
    expect(setup.captureCharFrame()).not.toContain("/clear");

    setup.mockInput.pressTab();
    expect(tui.input.value).toBe("/new");
  });

  test("recalls recent prompts with the up arrow", async () => {
    const setup = await createTestRenderer({ width: 80, height: 24 });
    renderer = setup.renderer;
    const tui = createBeeTui(renderer, {
      ask: async () => "Done.",
      newConversation: async () => undefined,
      friendlyError: String,
      history: {
        entries: ["Earlier prompt"],
        append: async () => undefined,
      },
    });

    setup.mockInput.pressArrow("up");
    expect(tui.input.value).toBe("Earlier prompt");
  });
});
