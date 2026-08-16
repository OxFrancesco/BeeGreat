type InputBridge = {
  getValue(): string;
  setValue(value: string): void;
};

/** Up/down recall over past prompts, preserving the in-progress draft. */
export function createHistoryNavigator(
  initialEntries: readonly string[],
  input: InputBridge,
) {
  const entries = [...initialEntries];
  let index = entries.length;
  let draft = "";

  /** Returns false when there is no history to navigate. */
  function move(direction: -1 | 1) {
    if (!entries.length) return false;
    if (index === entries.length) draft = input.getValue();
    index = Math.max(0, Math.min(entries.length, index + direction));
    input.setValue(index === entries.length ? draft : (entries[index] ?? ""));
    return true;
  }

  function resetCursor() {
    index = entries.length;
    draft = "";
  }

  function record(prompt: string) {
    if (entries.at(-1) !== prompt) entries.push(prompt);
    if (entries.length > 50) entries.shift();
    index = entries.length;
  }

  return { move, resetCursor, record };
}
