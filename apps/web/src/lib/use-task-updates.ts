import { TaskUpdates } from '@beegreat/chat-sync'
import { useState, useSyncExternalStore } from 'react'

export function useTaskUpdates() {
  const [updates] = useState(() => new TaskUpdates())
  const states = useSyncExternalStore(
    updates.subscribe,
    updates.getSnapshot,
    updates.getSnapshot,
  )
  return { states, run: updates.run.bind(updates) }
}
