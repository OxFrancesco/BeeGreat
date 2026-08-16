import {
  type CliRenderer,
  SelectRenderableEvents,
  type SelectOption,
  createCliRenderer,
} from "@opentui/core";

import type { PromptHistory } from "./prompt-history";
import type { BeeFollowUp } from "./reply";
import type { ToolActivityUpdate } from "./progress";
import { createActivityLog } from "./tui/activity";
import { createAutocomplete } from "./tui/autocomplete";
import { BEE_COMMANDS } from "./tui/commands";
import { createHistoryNavigator } from "./tui/history";
import {
  type ActivePrompt,
  CUSTOM_ANSWER,
  confirmPromptSteps,
  questionPromptSteps,
} from "./tui/prompt-steps";
import {
  PLACEHOLDER,
  PROMPT_HINT,
  READY_HINT,
  SPINNER_FRAMES,
  createMarkdownStyle,
  palette,
} from "./tui/theme";
import { createTranscript } from "./tui/transcript";
import { buildBeeWidgets } from "./tui/widgets";

export { BEE_COMMANDS, commandSuggestions } from "./tui/commands";
export { questionPromptSteps } from "./tui/prompt-steps";

export type BeeTuiReply = {
  text: string;
  followUp?: BeeFollowUp;
};

export type BeeTuiOptions = {
  ask(
    prompt: string,
    onActivity: (update: ToolActivityUpdate) => void,
    onReply: (update: BeeReplyUpdate) => void,
  ): Promise<BeeTuiReply>;
  /** Background preparation (e.g. waking the local agent) shown as a live activity line. */
  boot?(onActivity: (update: ToolActivityUpdate) => void): Promise<void>;
  newConversation(): Promise<void>;
  friendlyError(error: unknown): string;
  history?: PromptHistory;
};

export type BeeReplyUpdate =
  | { type: "reset" }
  | { type: "replace"; text: string };

export function createBeeTui(renderer: CliRenderer, options: BeeTuiOptions) {
  let busy = false;
  let closed = false;
  const queue: string[] = [];
  let activePrompt: ActivePrompt | undefined;
  let bootActive = false;
  let spinnerFrame = 0;
  let workStartedAt = 0;
  let ticker: ReturnType<typeof setInterval> | undefined;
  let resolveExit!: () => void;
  const exited = new Promise<void>((resolve) => {
    resolveExit = resolve;
  });

  renderer.setTerminalTitle("BeeGreat");
  renderer.setBackgroundColor(palette.canvas);

  const {
    transcript,
    autocomplete,
    autocompleteRows,
    promptPanel,
    promptTitle,
    promptSelect,
    composer,
    input,
    footer,
  } = buildBeeWidgets(renderer);
  const { addMessage, clear: clearMessages } = createTranscript(
    renderer,
    transcript,
    createMarkdownStyle(),
  );

  const inputValue = () => input.plainText;

  function setInputValue(value: string) {
    input.setText(value);
    input.cursorOffset = value.length;
    autoGrowComposer();
  }

  function autoGrowComposer() {
    const lines = Math.min(6, Math.max(1, inputValue().split("\n").length));
    input.height = lines;
    composer.height = lines + 2;
  }

  const inputBridge = { getValue: inputValue, setValue: setInputValue };
  const completions = createAutocomplete(
    autocomplete,
    autocompleteRows,
    inputBridge,
  );
  const history = createHistoryNavigator(
    options.history?.entries ?? [],
    inputBridge,
  );
  const activityLog = createActivityLog(
    () => addMessage("activity", ""),
    () => spinnerFrame,
  );

  function clearTranscript() {
    clearMessages();
    activityLog.clear();
  }

  addMessage(
    "assistant",
    "Hi Francesco. What would you like to make progress on?",
  );

  function refreshFooter() {
    if (activePrompt) {
      footer.content = PROMPT_HINT;
      return;
    }
    if (busy) {
      const frame = SPINNER_FRAMES[spinnerFrame % SPINNER_FRAMES.length];
      const elapsed = Math.max(
        0,
        Math.round((Date.now() - workStartedAt) / 1000),
      );
      const queued = queue.length ? `   ${queue.length} queued` : "";
      footer.content = `  ${frame} Bee is working… ${elapsed}s${queued}   ctrl+c exit`;
      return;
    }
    footer.content = READY_HINT;
  }

  function startTicker() {
    if (ticker) return;
    ticker = setInterval(() => {
      spinnerFrame += 1;
      activityLog.repaintRunning();
      refreshFooter();
    }, 120);
  }

  function stopTicker() {
    if (!ticker) return;
    clearInterval(ticker);
    ticker = undefined;
  }

  function setReady() {
    composer.borderColor = palette.line;
    input.placeholder = PLACEHOLDER;
    if (!bootActive) stopTicker();
    refreshFooter();
    if (!activePrompt) input.focus();
  }

  function setWorking() {
    composer.borderColor = palette.honey;
    input.placeholder = "Bee is working — type to queue your next message…";
    workStartedAt = Date.now();
    startTicker();
    refreshFooter();
  }

  function close() {
    if (closed) return;
    closed = true;
    stopTicker();
    renderer.destroy();
    resolveExit();
  }

  function dismissPrompt(focusInput = true) {
    if (!activePrompt) return;
    activePrompt = undefined;
    promptPanel.visible = false;
    promptSelect.blur();
    if (focusInput && !closed) input.focus();
    refreshFooter();
  }

  function showPromptStep() {
    if (!activePrompt) return;
    const step = activePrompt.steps[activePrompt.stepIndex];
    if (!step) return;
    const progress =
      activePrompt.steps.length > 1
        ? ` (${activePrompt.stepIndex + 1}/${activePrompt.steps.length})`
        : "";
    promptTitle.content = `${step.title}${progress}`;
    promptSelect.options = step.options;
    promptSelect.height = step.options.length * 2;
    promptPanel.height = step.options.length * 2 + 3;
    promptSelect.setSelectedIndex(0);
    promptPanel.visible = true;
    input.blur();
    promptSelect.focus();
    refreshFooter();
  }

  function showFollowUp(followUp: BeeFollowUp) {
    if (closed || queue.length) return;
    if (followUp.kind === "confirm") {
      activePrompt = {
        kind: "confirm",
        steps: confirmPromptSteps(followUp.summary),
        stepIndex: 0,
        values: [],
        displays: [],
      };
      showPromptStep();
      return;
    }
    const steps = questionPromptSteps(followUp.question);
    if (!steps) {
      input.placeholder = "Type your answer…";
      input.focus();
      return;
    }
    activePrompt = {
      kind: "question",
      steps,
      stepIndex: 0,
      values: [],
      displays: [],
    };
    showPromptStep();
  }

  function handlePromptSelection(option: SelectOption) {
    if (!activePrompt) return;
    if (option.value === CUSTOM_ANSWER) {
      dismissPrompt();
      input.placeholder = "Type your answer…";
      return;
    }
    if (activePrompt.kind === "confirm") {
      dismissPrompt();
      void submitPrompt(String(option.value), option.name);
      return;
    }
    activePrompt.values.push(String(option.value));
    activePrompt.displays.push(option.name);
    if (activePrompt.stepIndex + 1 < activePrompt.steps.length) {
      activePrompt.stepIndex += 1;
      showPromptStep();
      return;
    }
    const values = activePrompt.values.join(", ");
    const display = activePrompt.displays.join(" · ");
    dismissPrompt();
    void submitPrompt(values, display);
  }

  promptSelect.on(
    SelectRenderableEvents.ITEM_SELECTED,
    (_index: number, option: SelectOption) => {
      handlePromptSelection(option);
    },
  );

  async function submitPrompt(rawPrompt: string, display?: string) {
    const prompt = rawPrompt.trim();
    if (!prompt || closed) return;
    if (busy) {
      queue.push(prompt);
      setInputValue("");
      completions.hide();
      refreshFooter();
      return;
    }
    setInputValue("");
    completions.hide();
    dismissPrompt(false);
    history.resetCursor();

    if (prompt === "/exit" || prompt === "/quit") {
      close();
      return;
    }
    if (prompt === "/clear") {
      clearTranscript();
      input.focus();
      return;
    }
    if (prompt === "/help") {
      addMessage(
        "assistant",
        BEE_COMMANDS.map(
          ({ name, description }) => `- \`${name}\` — ${description}`,
        ).join("\n"),
      );
      input.focus();
      return;
    }
    if (prompt === "/new") {
      busy = true;
      setWorking();
      try {
        await options.newConversation();
        clearTranscript();
        addMessage("assistant", "Fresh conversation. What is on your mind?");
      } catch (error) {
        addMessage("error", options.friendlyError(error));
      } finally {
        busy = false;
        setReady();
      }
      return;
    }

    // Select answers ("yes", "2") are transcript noise in prompt history.
    if (!display) {
      history.record(prompt);
      void options.history?.append(prompt);
    }

    busy = true;
    addMessage("user", display ?? prompt);
    const thinking = addMessage("activity", "✻ Thinking…");
    let thinkingVisible = true;
    const removeThinking = () => {
      if (!thinkingVisible) return;
      transcript.remove(thinking.row);
      thinkingVisible = false;
    };
    let streamed: ReturnType<typeof addMessage> | undefined;
    setWorking();
    try {
      const reply = await options.ask(
        prompt,
        (update) => {
          removeThinking();
          activityLog.onActivity(update);
        },
        (update) => {
          if (update.type === "reset") {
            if (streamed) transcript.remove(streamed.row);
            streamed = undefined;
            return;
          }
          if (!streamed && update.text) {
            removeThinking();
            streamed = addMessage("assistant", update.text);
          } else if (streamed) {
            streamed.setText(update.text);
          }
        },
      );
      removeThinking();
      if (streamed) streamed.finalize(reply.text);
      else addMessage("assistant", reply.text);
      if (reply.followUp) showFollowUp(reply.followUp);
    } catch (error) {
      removeThinking();
      if (streamed) transcript.remove(streamed.row);
      addMessage("error", options.friendlyError(error));
    } finally {
      busy = false;
      setReady();
      const next = queue.shift();
      if (next !== undefined) void submitPrompt(next);
    }
  }

  input.onContentChange = () => {
    autoGrowComposer();
    completions.update();
  };
  renderer.keyInput.on("keypress", (key) => {
    if (key.ctrl && key.name === "c") {
      key.preventDefault();
      if (activePrompt) {
        dismissPrompt();
        return;
      }
      if (inputValue()) {
        setInputValue("");
        completions.update();
        return;
      }
      close();
      return;
    }
    if (key.name === "escape" && activePrompt) {
      key.preventDefault();
      dismissPrompt();
      input.placeholder = "Type your answer…";
      return;
    }
    if (!input.focused) return;

    if (key.name === "escape" && completions.active) {
      key.preventDefault();
      completions.hide();
      return;
    }
    if ((key.name === "up" || key.name === "down") && completions.active) {
      key.preventDefault();
      completions.move(key.name === "up" ? -1 : 1);
      return;
    }
    if (key.name === "tab" && completions.complete()) {
      key.preventDefault();
      return;
    }
    if (
      (key.name === "up" || key.name === "down") &&
      !inputValue().includes("\n")
    ) {
      key.preventDefault();
      if (history.move(key.name === "up" ? -1 : 1)) completions.update();
      return;
    }
    if (
      (key.name === "return" || key.name === "kpenter") &&
      !key.shift &&
      !key.meta &&
      !key.ctrl
    ) {
      key.preventDefault();
      if (completions.active && inputValue() !== completions.firstName) {
        completions.complete();
        return;
      }
      void submitPrompt(inputValue());
    }
  });
  input.focus();

  async function runBoot(boot: NonNullable<BeeTuiOptions["boot"]>) {
    bootActive = true;
    startTicker();
    try {
      await boot(activityLog.onActivity);
    } catch (error) {
      if (!closed) addMessage("error", options.friendlyError(error));
    } finally {
      bootActive = false;
      if (!busy) stopTicker();
      if (!closed) refreshFooter();
    }
  }
  if (options.boot) void runBoot(options.boot);

  return { close, exited, input, submitPrompt };
}

export async function runBeeTui(options: BeeTuiOptions) {
  const renderer = await createCliRenderer({
    exitOnCtrlC: false,
    clearOnShutdown: true,
    screenMode: "alternate-screen",
    useMouse: true,
    enableMouseMovement: true,
    backgroundColor: palette.canvas,
    targetFps: 30,
  });
  const tui = createBeeTui(renderer, options);
  await tui.exited;
}
