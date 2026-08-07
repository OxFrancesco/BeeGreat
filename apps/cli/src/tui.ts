import {
  BoxRenderable,
  type CliRenderer,
  InputRenderable,
  InputRenderableEvents,
  ScrollBoxRenderable,
  TextRenderable,
  createCliRenderer,
} from "@opentui/core";

import type { PromptHistory } from "./prompt-history";

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

export type BeeTuiOptions = {
  ask(
    prompt: string,
    onProgress: (message: string) => void,
    onReply: (update: BeeReplyUpdate) => void,
  ): Promise<string>;
  newConversation(): Promise<void>;
  friendlyError(error: unknown): string;
  history?: PromptHistory;
};

export type BeeReplyUpdate =
  | { type: "reset" }
  | { type: "replace"; text: string };

type MessageKind = "assistant" | "user" | "activity" | "error";

export function createBeeTui(renderer: CliRenderer, options: BeeTuiOptions) {
  let messageId = 0;
  let busy = false;
  let closed = false;
  let suggestions: BeeCommand[] = [];
  let selectedSuggestion = 0;
  const historyEntries = [...(options.history?.entries ?? [])];
  let historyIndex = historyEntries.length;
  let historyDraft = "";
  let resolveExit!: () => void;
  const exited = new Promise<void>((resolve) => {
    resolveExit = resolve;
  });

  renderer.setTerminalTitle("BeeGreat");
  renderer.setBackgroundColor(palette.canvas);

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
    return { row, body };
  }

  function clearTranscript() {
    for (const child of transcript.getChildren()) transcript.remove(child);
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
  const input = new InputRenderable(renderer, {
    id: "bee-input",
    width: "100%",
    value: "",
    placeholder: "Message your personal assistant…",
    placeholderColor: palette.inkSoft,
    backgroundColor: palette.surface,
    focusedBackgroundColor: palette.surface,
    textColor: palette.ink,
    focusedTextColor: palette.ink,
    cursorColor: palette.honey,
  });
  composer.add(input);
  shell.add(composer);

  const footer = new TextRenderable(renderer, {
    id: "bee-footer",
    content: "  / commands   ↑↓ history   ↵ send   ctrl+c exit",
    fg: palette.inkSoft,
    width: "100%",
    height: 1,
    paddingLeft: 2,
    wrapMode: "none",
    truncate: true,
  });
  shell.add(footer);
  renderer.root.add(screen);

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
    suggestions = commandSuggestions(input.value);
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
    input.value = suggestion.name;
    input.cursorOffset = suggestion.name.length;
    hideAutocomplete();
    return true;
  }

  function moveHistory(direction: -1 | 1) {
    if (!historyEntries.length) return;
    if (historyIndex === historyEntries.length) historyDraft = input.value;
    historyIndex = Math.max(
      0,
      Math.min(historyEntries.length, historyIndex + direction),
    );
    input.value =
      historyIndex === historyEntries.length
        ? historyDraft
        : (historyEntries[historyIndex] ?? "");
    input.cursorOffset = input.value.length;
    updateAutocomplete();
  }

  function setReady() {
    composer.borderColor = palette.line;
    input.placeholder = "Message your personal assistant…";
    footer.content = "  / commands   ↑↓ history   ↵ send   ctrl+c exit";
    input.focus();
  }

  function setWorking(message = "Bee is working…") {
    composer.borderColor = palette.honey;
    input.placeholder = message;
    footer.content = `  ${message}`;
    input.blur();
  }

  function close() {
    if (closed) return;
    closed = true;
    renderer.destroy();
    resolveExit();
  }

  async function submitPrompt(rawPrompt: string) {
    const prompt = rawPrompt.trim();
    if (!prompt || busy || closed) return;
    input.value = "";
    hideAutocomplete();
    historyIndex = historyEntries.length;
    historyDraft = "";

    if (prompt === "/exit" || prompt === "/quit") {
      close();
      return;
    }
    if (prompt === "/clear") {
      clearTranscript();
      return;
    }
    if (prompt === "/help") {
      addMessage(
        "assistant",
        BEE_COMMANDS.map(
          ({ name, description }) => `${name.padEnd(8)} ${description}`,
        ).join("\n"),
      );
      return;
    }
    if (prompt === "/new") {
      busy = true;
      setWorking("Starting a fresh conversation…");
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

    if (historyEntries.at(-1) !== prompt) historyEntries.push(prompt);
    if (historyEntries.length > 50) historyEntries.shift();
    historyIndex = historyEntries.length;
    void options.history?.append(prompt);

    busy = true;
    addMessage("user", prompt);
    const thinking = addMessage("activity", "Thinking…");
    let thinkingVisible = true;
    let streamed: ReturnType<typeof addMessage> | undefined;
    setWorking();
    try {
      const reply = await options.ask(
        prompt,
        (message) => {
          addMessage("activity", message);
        },
        (update) => {
          if (update.type === "reset") {
            if (streamed) transcript.remove(streamed.row);
            streamed = undefined;
            return;
          }
          if (!streamed && update.text) {
            if (thinkingVisible) {
              transcript.remove(thinking.row);
              thinkingVisible = false;
            }
            streamed = addMessage("assistant", update.text);
          } else if (streamed) {
            streamed.body.content = update.text;
          }
        },
      );
      if (thinkingVisible) transcript.remove(thinking.row);
      if (streamed) streamed.body.content = reply;
      else addMessage("assistant", reply);
    } catch (error) {
      if (thinkingVisible) transcript.remove(thinking.row);
      if (streamed) transcript.remove(streamed.row);
      addMessage("error", options.friendlyError(error));
    } finally {
      busy = false;
      setReady();
    }
  }

  input.on(InputRenderableEvents.INPUT, updateAutocomplete);
  renderer.keyInput.on("keypress", (key) => {
    if (key.ctrl && key.name === "c") {
      key.preventDefault();
      close();
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
    if (key.name === "up" || key.name === "down") {
      key.preventDefault();
      moveHistory(key.name === "up" ? -1 : 1);
      return;
    }
    if (
      key.name === "return" ||
      key.name === "linefeed" ||
      key.name === "kpenter"
    ) {
      key.preventDefault();
      if (suggestions.length && input.value !== suggestions[0]?.name) {
        completeSuggestion();
        return;
      }
      void submitPrompt(input.value);
    }
  });
  input.focus();

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
