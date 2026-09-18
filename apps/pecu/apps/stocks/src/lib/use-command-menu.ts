import { useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { chatCommands, type ChatCommand } from "../../../../src/commands";

/**
 * Slash-command completion for the composers. The menu lists commands that
 * start with the draft, Enter or Tab accepts the active one, Escape dismisses
 * until the draft changes.
 */
export function useCommandMenu(
  draft: string,
  setDraft: (value: string) => void,
) {
  const listboxId = useId();
  const [activeIndex, setActiveIndex] = useState(0);
  const [dismissedAt, setDismissedAt] = useState<string | null>(null);
  const items = useMemo(
    () =>
      draft.startsWith("/")
        ? chatCommands.filter((command) =>
            command.command.toLowerCase().startsWith(draft.toLowerCase()),
          )
        : [],
    [draft],
  );
  const itemsKey = items.map((item) => item.command).join("\n");
  const previousItems = useRef(itemsKey);
  if (previousItems.current !== itemsKey) {
    previousItems.current = itemsKey;
    if (activeIndex !== 0) setActiveIndex(0);
  }
  const dismissed = dismissedAt === draft;
  const open =
    items.length > 0 &&
    !dismissed &&
    !(
      items.length === 1 &&
      items[0]!.command.toLowerCase() === draft.trim().toLowerCase() &&
      !items[0]!.args
    );
  const select = (item: ChatCommand) =>
    setDraft(item.command + (item.args ? " " : ""));
  const onKeyDown = (event: KeyboardEvent) => {
    if (!open) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % items.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex(
        (index) => (index - 1 + items.length) % items.length,
      );
    } else if (event.key === "Enter" || event.key === "Tab") {
      event.preventDefault();
      select(items[activeIndex]!);
    } else if (event.key === "Escape") {
      event.preventDefault();
      setDismissedAt(draft);
    }
  };
  return {
    open,
    items,
    activeIndex,
    setActiveIndex,
    select,
    onKeyDown,
    listboxId,
    optionId: (index: number) => `${listboxId}-${index}`,
  };
}
