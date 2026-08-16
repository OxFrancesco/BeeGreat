// Journal autosave semantics shared by the web and mobile editors. The
// debounce timers and React wiring stay per app; only the pure draft
// comparison and save-state copy live here so the editors cannot drift.

export type JournalDraft = { title: string; body: string; tags: string[] };

export type JournalSaveState =
  | "loading"
  | "saved"
  | "unsaved"
  | "saving"
  | "error";

/**
 * True when two drafts would persist identically. Tags are compared
 * element by element (never joined) so a tag that happens to contain a
 * would-be separator can never make two different drafts look equal.
 */
export function compareDrafts(left: JournalDraft, right: JournalDraft): boolean {
  return (
    left.title === right.title &&
    left.body === right.body &&
    left.tags.length === right.tags.length &&
    left.tags.every((tag, index) => tag === right.tags[index])
  );
}

export type SaveStateLabels = {
  /**
   * Copy for the "error" state. Web ships "Not saved" while mobile ships
   * "Couldn’t save", so each caller must state its choice explicitly.
   */
  error: string;
};

/** The status line above the editor ("Saving…", "Unsaved changes", …). */
export function formatSaveState(
  state: JournalSaveState,
  labels: SaveStateLabels,
): string {
  switch (state) {
    case "loading":
      return "Loading…";
    case "saving":
      return "Saving…";
    case "unsaved":
      return "Unsaved changes";
    case "error":
      return labels.error;
    default:
      return "Saved";
  }
}
