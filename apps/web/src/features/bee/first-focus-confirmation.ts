type PendingConfirmation = {
  id: string
  confirm: () => Promise<boolean>
}

let pending: PendingConfirmation | null = null
let confirming = false

export function registerPendingFirstFocus(
  id: string,
  confirm: () => Promise<boolean>,
): () => void {
  pending = { id, confirm }
  return () => {
    if (pending?.id === id) pending = null
  }
}

export function clearPendingFirstFocus(id: string) {
  if (pending?.id === id) pending = null
}

export function isFirstFocusConfirmation(text: string): boolean {
  return /^(yes|yep|confirm|confirmed|looks good|create it|do it)[.!]?$/i.test(
    text.trim(),
  )
}

export function isHighlightCompletion(text: string): boolean {
  const command = text.trim()
  return (
    /^(i(?:'ve| have)? )?(completed|finished) ((my|the|this) )?(highlight|task|it)[.!]?$/i.test(
      command,
    ) ||
    /^(complete|finish) ((my|the|this) )?(highlight|task)[.!]?$/i.test(
      command,
    ) ||
    /^mark ((my|the|this) )?(highlight|task|it)( as)? done[.!]?$/i.test(command)
  )
}

export async function confirmPendingFirstFocus(): Promise<
  'confirmed' | 'failed' | 'none'
> {
  if (!pending || confirming) return 'none'
  confirming = true
  try {
    return (await pending.confirm()) ? 'confirmed' : 'failed'
  } finally {
    confirming = false
  }
}
