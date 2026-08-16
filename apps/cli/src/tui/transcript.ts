import {
  BoxRenderable,
  type CliRenderer,
  MarkdownRenderable,
  type ScrollBoxRenderable,
  type SyntaxStyle,
  TextRenderable,
} from "@opentui/core";

import { palette } from "./theme";

export type MessageKind = "assistant" | "user" | "activity" | "error";

export type TranscriptMessage = {
  row: BoxRenderable;
  setText(text: string): void;
  finalize(text: string): void;
  body: TextRenderable | undefined;
};

/** Renders messages into the transcript scroll box; owns no conversation state. */
export function createTranscript(
  renderer: CliRenderer,
  transcript: ScrollBoxRenderable,
  markdownStyle: SyntaxStyle,
) {
  let messageId = 0;

  function addMessage(kind: MessageKind, content: string): TranscriptMessage {
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

  function clear() {
    for (const child of transcript.getChildren()) transcript.remove(child);
  }

  return { addMessage, clear };
}
