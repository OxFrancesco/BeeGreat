type DisplayedWeb3 = { actionId: string; summary: string; expiresAt: number }
const displayed = new Map<string, DisplayedWeb3>()
const keyFor = (userId: string, threadId: number) => JSON.stringify([userId, threadId])

export function recordDisplayedWeb3(userId: string, threadId: number, confirmation?: { actionId: string; summary: string }) {
  const key = keyFor(userId, threadId)
  displayed.delete(key)
  if (!confirmation) return
  if (displayed.size >= 1000) displayed.delete(displayed.keys().next().value!)
  displayed.set(key, { ...confirmation, expiresAt: Date.now() + 15 * 60_000 })
}

export function getDisplayedWeb3(userId: string, threadId: number) {
  const key = keyFor(userId, threadId)
  const current = displayed.get(key)
  if (!current || current.expiresAt <= Date.now()) {
    displayed.delete(key)
    return null
  }
  return current
}
