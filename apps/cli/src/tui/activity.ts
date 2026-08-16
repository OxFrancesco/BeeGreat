import type { TextRenderable } from "@opentui/core";

import type { ToolActivityUpdate } from "../progress";
import { SPINNER_FRAMES, palette } from "./theme";
import type { TranscriptMessage } from "./transcript";

/** Tracks running tool-activity lines and paints their spinner/done/error states. */
export function createActivityLog(
  addActivityMessage: () => TranscriptMessage,
  currentFrame: () => number,
) {
  const running = new Map<string, { body: TextRenderable; label: string }>();

  function paint(
    body: TextRenderable,
    update: Pick<ToolActivityUpdate, "state" | "label">,
  ) {
    if (update.state === "running") {
      const frame = SPINNER_FRAMES[currentFrame() % SPINNER_FRAMES.length];
      body.content = `${frame} ${update.label}`;
      body.fg = palette.inkSoft;
      return;
    }
    body.content = `${update.state === "done" ? "✓" : "✗"} ${update.label}`;
    body.fg = update.state === "done" ? palette.inkSoft : palette.danger;
  }

  function onActivity(update: ToolActivityUpdate) {
    const existing = running.get(update.id);
    if (existing) {
      existing.label = update.label;
      paint(existing.body, update);
      if (update.state !== "running") running.delete(update.id);
      return;
    }
    const message = addActivityMessage();
    if (!message.body) return;
    paint(message.body, update);
    if (update.state === "running") {
      running.set(update.id, { body: message.body, label: update.label });
    }
  }

  function repaintRunning() {
    for (const activity of running.values()) {
      paint(activity.body, { state: "running", label: activity.label });
    }
  }

  function clear() {
    running.clear();
  }

  return { onActivity, repaintRunning, clear };
}
