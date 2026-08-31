import { useSyncExternalStore } from 'react'

import type { Hotkey } from '@tanstack/react-hotkeys'

export type HotkeyAction =
  'bee' | 'goals' | 'hive' | 'mind' | 'talk' | 'settings'

export type HotkeyBindings = Record<HotkeyAction, Hotkey>

export const HOTKEY_ACTION_LABELS = {
  bee: 'Open Bee',
  goals: 'Open Goals',
  hive: 'Open Hive',
  mind: 'Open Mind',
  talk: 'Talk to Bee',
  settings: 'Open Settings',
} satisfies Record<HotkeyAction, string>

export const DEFAULT_HOTKEYS = {
  bee: 'Mod+Shift+1',
  goals: 'Mod+Shift+2',
  hive: 'Mod+Shift+3',
  mind: 'Mod+Shift+4',
  talk: 'Mod+Shift+V',
  settings: 'Mod+Shift+S',
} satisfies HotkeyBindings

const STORAGE_KEY = 'bee.hotkeys'
const listeners = new Set<() => void>()
let memoryValue: HotkeyBindings | undefined

function readBindings() {
  if (memoryValue) return memoryValue
  if (!('window' in globalThis)) return DEFAULT_HOTKEYS
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    // SAFETY: `bee.hotkeys` is only written by `writeBindings`, which persists
    // a JSON object of `Hotkey` strings keyed by `HotkeyAction`; TypeScript
    // cannot re-derive the template-literal `Hotkey` union from parsed JSON.
    const stored = raw ? (JSON.parse(raw) as Partial<HotkeyBindings>) : {}
    memoryValue = { ...DEFAULT_HOTKEYS, ...stored }
  } catch {
    memoryValue = DEFAULT_HOTKEYS
  }
  return memoryValue
}

function writeBindings(next: HotkeyBindings) {
  memoryValue = next
  if ('window' in globalThis) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    } catch {
      // The in-memory bindings still work when storage is unavailable.
    }
  }
  listeners.forEach((listener) => listener())
}

export function setHotkeyBinding(action: HotkeyAction, hotkey: Hotkey) {
  writeBindings({ ...readBindings(), [action]: hotkey })
}

export function resetHotkeyBindings() {
  writeBindings({ ...DEFAULT_HOTKEYS })
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useHotkeyBindings(): HotkeyBindings {
  return useSyncExternalStore(subscribe, readBindings, () => DEFAULT_HOTKEYS)
}
