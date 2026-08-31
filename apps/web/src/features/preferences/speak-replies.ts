import { useSyncExternalStore } from 'react'

const STORAGE_KEY = 'bee.speakReplies'
const listeners = new Set<() => void>()
let memoryValue: boolean | undefined

function readPreference() {
  if (memoryValue !== undefined) return memoryValue
  if (!('window' in globalThis)) return true
  try {
    memoryValue = window.localStorage.getItem(STORAGE_KEY) !== 'off'
  } catch {
    memoryValue = true
  }
  return memoryValue
}

export function setSpeakReplies(enabled: boolean) {
  memoryValue = enabled
  if ('window' in globalThis) {
    try {
      window.localStorage.setItem(STORAGE_KEY, enabled ? 'on' : 'off')
    } catch {
      // The in-memory preference still works when storage is unavailable.
    }
  }
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useSpeakReplies() {
  return useSyncExternalStore(subscribe, readPreference, () => true)
}
