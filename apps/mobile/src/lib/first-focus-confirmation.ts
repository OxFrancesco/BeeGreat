type PendingConfirmation = {
  id: string;
  confirm: () => Promise<boolean>;
};

let pending: PendingConfirmation | null = null;
let confirming = false;

/**
 * Registers the newest visible first-focus preview. This tiny bridge lets the
 * shared voice/text input confirm the exact same client-side mutation as the
 * card button without putting React state in the transport layer.
 */
export function registerPendingFirstFocus(id: string, confirm: () => Promise<boolean>): () => void {
  pending = { id, confirm };
  return () => {
    if (pending?.id === id) pending = null;
  };
}

export function clearPendingFirstFocus(id: string) {
  if (pending?.id === id) pending = null;
}

export function isFirstFocusConfirmation(text: string): boolean {
  return /^(yes|yep|confirm|confirmed|looks good|create it|do it)[.!]?$/i.test(text.trim());
}

/** Matches explicit completion commands without hijacking conversational uses of “done”. */
export function isHighlightCompletion(text: string): boolean {
  const command = text.trim();
  return (
    /^(i(?:'ve| have)? )?(completed|finished) ((my|the|this) )?(highlight|task|it)[.!]?$/i.test(
      command,
    ) ||
    /^(complete|finish) ((my|the|this) )?(highlight|task)[.!]?$/i.test(command) ||
    /^mark ((my|the|this) )?(highlight|task|it)( as)? done[.!]?$/i.test(command)
  );
}

export type PendingConfirmationResult = 'confirmed' | 'failed' | 'none';

/** Confirms the newest preview and reports whether its authoritative write succeeded. */
export async function confirmPendingFirstFocus(): Promise<PendingConfirmationResult> {
  if (!pending || confirming) return 'none';
  confirming = true;
  try {
    return (await pending.confirm()) ? 'confirmed' : 'failed';
  } finally {
    confirming = false;
  }
}
