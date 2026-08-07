import { useSyncExternalStore } from 'react'

export type VoiceMode = 'voice-note' | 'conversation'

const STORAGE_KEY = 'bee.voiceMode'
const listeners = new Set<() => void>()
let memoryValue: VoiceMode | undefined

function readPreference(): VoiceMode {
  if (memoryValue) return memoryValue
  if (typeof window === 'undefined') return 'voice-note'
  try {
    memoryValue =
      window.localStorage.getItem(STORAGE_KEY) === 'conversation'
        ? 'conversation'
        : 'voice-note'
  } catch {
    memoryValue = 'voice-note'
  }
  return memoryValue
}

export function setVoiceMode(mode: VoiceMode) {
  memoryValue = mode
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(STORAGE_KEY, mode)
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

export function useVoiceMode() {
  return useSyncExternalStore(subscribe, readPreference, () => 'voice-note')
}
