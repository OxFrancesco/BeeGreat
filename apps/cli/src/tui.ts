import {
  BoxRenderable,
  type CliRenderer,
  MarkdownRenderable,
  ScrollBoxRenderable,
  SelectRenderable,
  SelectRenderableEvents,
  type SelectOption,
  SyntaxStyle,
  TextRenderable,
  TextareaRenderable,
  createCliRenderer,
} from "@opentui/core";

import { scrubIdentifiers } from "@beegreat/tool-presentation";

import type { ToolActivityUpdate } from "./progress";
import type { PromptHistory } from "./prompt-history";
import type { BeeFollowUp, BeeQuestion } from "./reply";

const palette = {
  canvas: "#111111",
  surface: "#191919",
  surfaceMuted: "#222222",
  line: "#35312c",
  ink: "#eeeeee",
  inkSoft: "#a7a7a7",
  honey: "#dcae67",
  honeySurface: "#2e2822",
  honeyInk: "#ffe0c2",
  danger: "#f07858",
} as const;

const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
const READY_HINT =
  "  ⏎ send   ⇧⏎ newline   / commands   ↑↓ history   ctrl+c exit";
const PROMPT_HINT = "  ↑↓ choose   ⏎ select   esc type your own answer";
const PLACEHOLDER = "Message your personal assistant…";
const CUSTOM_ANSWER = "__bee_custom_answer__";

export const BEE_COMMANDS = [
  { name: "/new", description: "Start a fresh conversation" },
  { name: "/clear", description: "Clear the visible conversation" },
  { name: "/help", description: "Show commands and shortcuts" },
  { name: "/exit", description: "Leave Bee" },
] as const;

type BeeCommand = (typeof BEE_COMMANDS)[number];

function fuzzyMatch(value: string, query: string) {
  let queryIndex = 0;
  for (const character of value) {
    if (character === query[queryIndex]) queryIndex += 1;
  }
  return queryIndex === query.length;
}

export function commandSuggestions(value: string): BeeCommand[] {
  if (!value.startsWith("/") || /\s/.test(value)) return [];
  const query = value.toLowerCase();
  const nameMatches = BEE_COMMANDS.filter(({ name }) =>
    fuzzyMatch(name.toLowerCase(), query),
  );
  const matches = nameMatches.length
    ? nameMatches
    : BEE_COMMANDS.filter(({ name, description }) =>
    fuzzyMatch(`${name} ${description}`.toLowerCase(), query),
      );
  return matches.sort((left, right) => {
    const leftPrefix = left.name.startsWith(query) ? 0 : 1;
    const rightPrefix = right.name.startsWith(query) ? 0 : 1;
    return leftPrefix - rightPrefix || left.name.localeCompare(right.name);
  });
}

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

type MessageKind = "assistant" | "user" | "activity" | "error";

type PromptStep = {
  title: string;
  options: SelectOption[];
};

type ActivePrompt = {
  kind: "question" | "confirm";
  steps: PromptStep[];
  stepIndex: number;
  values: string[];
  displays: string[];
};

/** Builds sequential select steps with the shared global option numbering. */
export function questionPromptSteps(
  question: BeeQuestion,
): PromptStep[] | undefined {
  if (question.questions.some((prompt) => !prompt.options?.length)) {
    return undefined;
  }
  let optionNumber = 0;
  return question.questions.map((prompt) => ({
    title: `${scrubIdentifiers(prompt.header)} — ${scrubIdentifiers(prompt.question)}`,
    options: [
      ...(prompt.options ?? []).map((option) => {
        optionNumber += 1;
        return {
          name: scrubIdentifiers(option.label),
          description: option.description
            ? scrubIdentifiers(option.description)
            : "",
          value: String(optionNumber),
        };
      }),
      {
        name: "Type something else",
        description: "Answer in your own words",
        value: CUSTOM_ANSWER,
      },
    ],
  }));
}

export function createBeeTui(renderer: CliRenderer, options: BeeTuiOptions) {
  let messageId = 0;
  let busy = false;
  let closed = false;
  let suggestions: BeeCommand[] = [];
  let selectedSuggestion = 0;
  const historyEntries = [...(options.history?.entries ?? [])];
  let historyIndex = historyEntries.length;
  let historyDraft = "";
  const queue: string[] = [];
  let activePrompt: ActivePrompt | undefined;
  let bootActive = false;
  let spinnerFrame = 0;
  let workStartedAt = 0;
  let ticker: ReturnType<typeof setInterval> | undefined;
  const runningActivities = new Map<
    string,
    { body: TextRenderable; label: string }
  >();
  let resolveExit!: () => void;
  const exited = new Promise<void>((resolve) => {
    resolveExit = resolve;
  });

  renderer.setTerminalTitle("BeeGreat");
  renderer.setBackgroundColor(palette.canvas);

  const markdownStyle = SyntaxStyle.fromStyles({
    default: { fg: palette.ink },
    conceal: { fg: palette.inkSoft },
    "markup.heading": { fg: palette.honey, bold: true },
    "markup.strong": { fg: palette.ink, bold: true },
    "markup.italic": { fg: palette.ink, italic: true },
    "markup.list": { fg: palette.honey },
    "markup.quote": { fg: palette.inkSoft, italic: true },
    "markup.raw": { fg: palette.honeyInk },
    "markup.link": { fg: palette.honey, underline: true },
    "markup.link.label": { fg: palette.honey },
    "markup.link.url": { fg: palette.inkSoft, underline: true },
    "markup.strikethrough": { fg: palette.inkSoft, dim: true },
  });

  const screen = new BoxRenderable(renderer, {
    id: "bee-screen",
    width: "100%",
    height: "100%",
    backgroundColor: palette.canvas,
    flexDirection: "column",
    alignItems: "center",
  });
  const shell = new BoxRenderable(renderer, {
    id: "bee-shell",
    width: "100%",
    maxWidth: 100,
    height: "100%",
    backgroundColor: palette.canvas,
    flexDirection: "column",
  });
  screen.add(shell);

  const header = new BoxRenderable(renderer, {
    id: "bee-header",
    width: "100%",
    height: 3,
    backgroundColor: palette.canvas,
    paddingX: 2,
    flexDirection: "row",
    alignItems: "center",
    gap: 1,
  });
  header.add(
    new TextRenderable(renderer, {
      id: "bee-mark",
      content: "⬡",
      fg: palette.honey,
      width: 1,
      height: 1,
    }),
  );
  header.add(
    new TextRenderable(renderer, {
      id: "bee-title",
      content: "Bee",
      fg: palette.ink,
      width: 4,
      height: 1,
    }),
  );
  shell.add(header);

  const transcript = new ScrollBoxRenderable(renderer, {
    id: "bee-transcript",
    width: "100%",
    flexGrow: 1,
    scrollY: true,
    stickyScroll: true,
    stickyStart: "bottom",
    backgroundColor: palette.canvas,
    paddingX: 2,
    contentOptions: {
      flexDirection: "column",
      gap: 1,
    },
    scrollbarOptions: {
      visible: false,
      showArrows: false,
      trackOptions: { backgroundColor: palette.canvas },
    },
  });
  shell.add(transcript);

  function addMessage(kind: MessageKind, content: string) {
    messageId += 1;
    const row = new BoxRenderable(renderer, {
      id: `message-${messageId}`,
      width: "100%",
      height: "auto",
      backgroundColor:
        kind === "user" ? palette.honeySurface : palette.canvas,
      ...(kind === "user"
        ? { border: ["left"] as ["left"], borderColor: palette.honey }
        : {}),
      paddingLeft: kind === "user" ? 1 : 0,
      paddingRight: kind === "user" ? 1 : 0,
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 1,
    });

    if (kind !== "user") {
      row.add(
        new TextRenderable(renderer, {
          id: `mark-${messageId}`,
          content:
            kind === "assistant" ? "⬡" : kind === "error" ? "!" : "·",
          fg:
            kind === "error"
              ? palette.danger
              : kind === "assistant"
                ? palette.honey
                : palette.inkSoft,
          width: 1,
          height: 1,
        }),
      );
    }

    if (kind === "assistant") {
      // Streaming stays enabled for the renderable's lifetime: OpenTUI 0.5
      // blanks a MarkdownRenderable when streaming is turned off afterwards.
      let current = content;
      const body = new MarkdownRenderable(renderer, {
        id: `body-${messageId}`,
        content,
        syntaxStyle: markdownStyle,
        streaming: true,
        flexGrow: 1,
        height: "auto",
      });
      row.add(body);
      transcript.add(row);
      queueMicrotask(() => transcript.scrollTo(Number.MAX_SAFE_INTEGER));
      const setText = (text: string) => {
        if (text === current) return;
        current = text;
        body.content = text;
      };
      return {
        row,
        setText,
        finalize: setText,
        body: undefined as TextRenderable | undefined,
      };
    }

    const body = new TextRenderable(renderer, {
        id: `body-${messageId}`,
        content,
        fg:
          kind === "user"
            ? palette.honeyInk
            : kind === "error"
              ? palette.danger
              : kind === "activity"
                ? palette.inkSoft
                : palette.ink,
        flexGrow: 1,
        height: "auto",
        wrapMode: "word",
        selectable: kind !== "activity",
      });
    row.add(body);

    transcript.add(row);
    queueMicrotask(() => transcript.scrollTo(Number.MAX_SAFE_INTEGER));
    return {
      row,
      setText(text: string) {
        body.content = text;
      },
      finalize(text: string) {
        body.content = text;
      },
      body,
    };
  }

  function clearTranscript() {
    for (const child of transcript.getChildren()) transcript.remove(child);
    runningActivities.clear();
  }

  addMessage(
    "assistant",
    "Hi Francesco. What would you like to make progress on?",
  );

  const autocomplete = new BoxRenderable(renderer, {
    id: "bee-autocomplete",
    width: "auto",
    height: "auto",
    minWidth: 20,
    marginX: 2,
    border: true,
    borderColor: palette.line,
    backgroundColor: palette.surfaceMuted,
    flexDirection: "column",
    visible: false,
  });
  const autocompleteRows = BEE_COMMANDS.map((_, index) => {
    const row = new TextRenderable(renderer, {
      id: `bee-autocomplete-${index}`,
      content: "",
      fg: palette.ink,
      bg: palette.surfaceMuted,
      width: "100%",
      height: 1,
      paddingX: 1,
      visible: false,
    });
    autocomplete.add(row);
    return row;
  });
  shell.add(autocomplete);

  const promptPanel = new BoxRenderable(renderer, {
    id: "bee-prompt",
    width: "auto",
    minWidth: 20,
    height: "auto",
    marginX: 2,
    paddingX: 1,
    border: true,
    borderStyle: "rounded",
    borderColor: palette.honey,
    backgroundColor: palette.surface,
    flexDirection: "column",
    visible: false,
  });
  const promptTitle = new TextRenderable(renderer, {
    id: "bee-prompt-title",
    content: "",
    fg: palette.honeyInk,
    width: "100%",
    height: 1,
    wrapMode: "none",
    truncate: true,
  });
  const promptSelect = new SelectRenderable(renderer, {
    id: "bee-prompt-select",
    width: "100%",
    height: 2,
    options: [],
    backgroundColor: palette.surface,
    focusedBackgroundColor: palette.surface,
    textColor: palette.inkSoft,
    focusedTextColor: palette.ink,
    selectedBackgroundColor: palette.honeySurface,
    selectedTextColor: palette.honeyInk,
    descriptionColor: palette.inkSoft,
    selectedDescriptionColor: palette.inkSoft,
    showDescription: true,
    showScrollIndicator: false,
    wrapSelection: true,
  });
  promptPanel.add(promptTitle);
  promptPanel.add(promptSelect);
  shell.add(promptPanel);

  const composer = new BoxRenderable(renderer, {
    id: "bee-composer",
    width: "auto",
    minWidth: 20,
    height: 3,
    marginX: 2,
    paddingX: 1,
    border: true,
    borderStyle: "rounded",
    borderColor: palette.line,
    focusedBorderColor: palette.honey,
    backgroundColor: palette.surface,
    flexDirection: "column",
    justifyContent: "center",
  });
  const input = new TextareaRenderable(renderer, {
    id: "bee-input",
    width: "100%",
    height: 1,
    placeholder: PLACEHOLDER,
    placeholderColor: palette.inkSoft,
    backgroundColor: palette.surface,
    focusedBackgroundColor: palette.surface,
    textColor: palette.ink,
    focusedTextColor: palette.ink,
    cursorColor: palette.honey,
    keyBindings: [
      { name: "return", shift: true, action: "newline" },
      { name: "kpenter", shift: true, action: "newline" },
      { name: "return", meta: true, action: "newline" },
      { name: "kpenter", meta: true, action: "newline" },
    ],
  });
  composer.add(input);
  shell.add(composer);

  const footer = new TextRenderable(renderer, {
    id: "bee-footer",
    content: READY_HINT,
    fg: palette.inkSoft,
    width: "100%",
    height: 1,
    paddingLeft: 2,
    wrapMode: "none",
    truncate: true,
  });
  shell.add(footer);
  renderer.root.add(screen);

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

  function renderAutocomplete() {
    autocomplete.visible = suggestions.length > 0;
    autocompleteRows.forEach((row, index) => {
      const suggestion = suggestions[index];
      row.visible = suggestion !== undefined;
      if (!suggestion) return;
      const selected = index === selectedSuggestion;
      row.content = `${selected ? "›" : " "} ${suggestion.name.padEnd(9)} ${suggestion.description}`;
      row.fg = selected ? palette.honeyInk : palette.inkSoft;
      row.bg = selected ? palette.honeySurface : palette.surfaceMuted;
    });
  }

  function updateAutocomplete() {
    suggestions = commandSuggestions(inputValue());
    selectedSuggestion = 0;
    renderAutocomplete();
  }

  function hideAutocomplete() {
    suggestions = [];
    selectedSuggestion = 0;
    renderAutocomplete();
  }

  function completeSuggestion() {
    const suggestion = suggestions[selectedSuggestion];
    if (!suggestion) return false;
    setInputValue(suggestion.name);
    hideAutocomplete();
    return true;
  }

  function moveHistory(direction: -1 | 1) {
    if (!historyEntries.length) return;
    if (historyIndex === historyEntries.length) historyDraft = inputValue();
    historyIndex = Math.max(
      0,
      Math.min(historyEntries.length, historyIndex + direction),
    );
    setInputValue(
      historyIndex === historyEntries.length
        ? historyDraft
        : (historyEntries[historyIndex] ?? ""),
    );
    updateAutocomplete();
  }

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

  function paintActivity(
    body: TextRenderable,
    update: Pick<ToolActivityUpdate, "state" | "label">,
  ) {
    if (update.state === "running") {
      const frame = SPINNER_FRAMES[spinnerFrame % SPINNER_FRAMES.length];
      body.content = `${frame} ${update.label}`;
      body.fg = palette.inkSoft;
      return;
    }
    body.content = `${update.state === "done" ? "✓" : "✗"} ${update.label}`;
    body.fg = update.state === "done" ? palette.inkSoft : palette.danger;
  }

  function startTicker() {
    if (ticker) return;
    ticker = setInterval(() => {
      spinnerFrame += 1;
      for (const activity of runningActivities.values()) {
        paintActivity(activity.body, {
          state: "running",
          label: activity.label,
        });
      }
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
        steps: [
          {
            title: followUp.summary,
            options: [
              {
                name: "Yes",
                description: "Authorize this exact action",
                value: "yes",
              },
              { name: "No", description: "Cancel it", value: "no" },
            ],
          },
        ],
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

  function onActivity(update: ToolActivityUpdate) {
    const existing = runningActivities.get(update.id);
    if (existing) {
      existing.label = update.label;
      paintActivity(existing.body, update);
      if (update.state !== "running") runningActivities.delete(update.id);
      return;
    }
    const message = addMessage("activity", "");
    if (!message.body) return;
    paintActivity(message.body, update);
    if (update.state === "running") {
      runningActivities.set(update.id, {
        body: message.body,
        label: update.label,
      });
    }
  }

  async function submitPrompt(rawPrompt: string, display?: string) {
    const prompt = rawPrompt.trim();
    if (!prompt || closed) return;
    if (busy) {
      queue.push(prompt);
      setInputValue("");
      hideAutocomplete();
      refreshFooter();
      return;
    }
    setInputValue("");
    hideAutocomplete();
    dismissPrompt(false);
    historyIndex = historyEntries.length;
    historyDraft = "";

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
      if (historyEntries.at(-1) !== prompt) historyEntries.push(prompt);
      if (historyEntries.length > 50) historyEntries.shift();
      historyIndex = historyEntries.length;
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
          onActivity(update);
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
    updateAutocomplete();
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
        updateAutocomplete();
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

    if (key.name === "escape" && suggestions.length) {
      key.preventDefault();
      hideAutocomplete();
      return;
    }
    if ((key.name === "up" || key.name === "down") && suggestions.length) {
      key.preventDefault();
      const direction = key.name === "up" ? -1 : 1;
      selectedSuggestion =
        (selectedSuggestion + direction + suggestions.length) %
        suggestions.length;
      renderAutocomplete();
      return;
    }
    if (key.name === "tab" && completeSuggestion()) {
      key.preventDefault();
      return;
    }
    if (
      (key.name === "up" || key.name === "down") &&
      !inputValue().includes("\n")
    ) {
      key.preventDefault();
      moveHistory(key.name === "up" ? -1 : 1);
      return;
    }
    if (
      (key.name === "return" || key.name === "kpenter") &&
      !key.shift &&
      !key.meta &&
      !key.ctrl
    ) {
      key.preventDefault();
      if (suggestions.length && inputValue() !== suggestions[0]?.name) {
        completeSuggestion();
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
      await boot(onActivity);
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
