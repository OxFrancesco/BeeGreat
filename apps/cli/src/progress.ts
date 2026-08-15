import {
  getToolCopy,
  type ToolActivityState,
} from "@beegreat/tool-presentation";
import type { ConversationStreamChunk } from "@flue/sdk";

type ToolActivity = { name: string; input: unknown };

export type ToolActivityUpdate = {
  id: string;
  state: ToolActivityState;
  label: string;
};

function activityLabel(activity: ToolActivity, state: ToolActivityState) {
  const copy = getToolCopy(activity.name, state, activity.input);
  return [copy.powerup ?? copy.specialist, copy.label]
    .filter(Boolean)
    .join(": ");
}

/** Emits one update per tool call so a TUI can rewrite the line in place. */
export function createToolActivityTracker(
  emit: (update: ToolActivityUpdate) => void,
) {
  const tools = new Map<string, ToolActivity>();

  return (event: ConversationStreamChunk) => {
    if (event.type === "tool-input") {
      const activity = { name: event.toolName, input: event.input };
      tools.set(event.toolCallId, activity);
      emit({
        id: event.toolCallId,
        state: "running",
        label: activityLabel(activity, "running"),
      });
      return;
    }
    if (event.type !== "tool-output" && event.type !== "tool-output-error")
      return;
    const activity = tools.get(event.toolCallId);
    if (!activity) return;
    const state = event.type === "tool-output" ? "done" : "error";
    emit({
      id: event.toolCallId,
      state,
      label: activityLabel(activity, state),
    });
  };
}

export function createTerminalProgress(write: (line: string) => void) {
  return createToolActivityTracker((update) => write(update.label));
}
