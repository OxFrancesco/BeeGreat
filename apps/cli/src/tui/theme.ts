import { SyntaxStyle } from "@opentui/core";

export const palette = {
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

export const SPINNER_FRAMES = [
  "⠋",
  "⠙",
  "⠹",
  "⠸",
  "⠼",
  "⠴",
  "⠦",
  "⠧",
  "⠇",
  "⠏",
];
export const READY_HINT =
  "  ⏎ send   ⇧⏎ newline   / commands   ↑↓ history   ctrl+c exit";
export const PROMPT_HINT = "  ↑↓ choose   ⏎ select   esc type your own answer";
export const PLACEHOLDER = "Message your personal assistant…";

export function createMarkdownStyle() {
  return SyntaxStyle.fromStyles({
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
}
