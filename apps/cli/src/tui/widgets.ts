import {
  BoxRenderable,
  type CliRenderer,
  ScrollBoxRenderable,
  SelectRenderable,
  TextRenderable,
  TextareaRenderable,
} from "@opentui/core";

import { BEE_COMMANDS } from "./commands";
import { PLACEHOLDER, READY_HINT, palette } from "./theme";

export type BeeWidgets = ReturnType<typeof buildBeeWidgets>;

/** Constructs the static widget tree and attaches it to the renderer root. */
export function buildBeeWidgets(renderer: CliRenderer) {
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

  return {
    screen,
    transcript,
    autocomplete,
    autocompleteRows,
    promptPanel,
    promptTitle,
    promptSelect,
    composer,
    input,
    footer,
  };
}
