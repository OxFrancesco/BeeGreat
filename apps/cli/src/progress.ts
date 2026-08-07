import { getToolCopy } from "@beegreat/tool-presentation";
import type { ConversationStreamChunk } from "@flue/sdk";

type ToolActivity = { name: string; input: unknown };

export function createTerminalProgress(write: (line: string) => void) {
  const tools = new Map<string, ToolActivity>();

  return (event: ConversationStreamChunk) => {
    if (event.type === "tool-input") {
      const activity = { name: event.toolName, input: event.input };
      tools.set(event.toolCallId, activity);
      const copy = getToolCopy(activity.name, "running", activity.input);
      write(
        [copy.powerup ?? copy.specialist, copy.label]
          .filter(Boolean)
          .join(": "),
      );
      return;
    }
    if (event.type !== "tool-output" && event.type !== "tool-output-error")
      return;
    const activity = tools.get(event.toolCallId);
    if (!activity) return;
    const copy = getToolCopy(
      activity.name,
      event.type === "tool-output" ? "done" : "error",
      activity.input,
    );
    write(
      [copy.powerup ?? copy.specialist, copy.label].filter(Boolean).join(": "),
    );
  };
}
