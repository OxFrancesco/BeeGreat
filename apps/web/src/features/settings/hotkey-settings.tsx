import { formatForDisplay, useHotkeyRecorder } from '@tanstack/react-hotkeys'
import { useEffect, useState } from 'react'

import {
  HOTKEY_ACTION_LABELS,
  resetHotkeyBindings,
  setHotkeyBinding,
  useHotkeyBindings,
} from '../preferences/hotkeys'
import type { HotkeyAction } from '../preferences/hotkeys'

// SAFETY: `HOTKEY_ACTION_LABELS` declares exactly one label per
// `HotkeyAction`, so its keys are precisely that union; `Object.keys` cannot
// carry the literal key evidence itself.
const ACTIONS = Object.keys(HOTKEY_ACTION_LABELS) as Array<HotkeyAction>

export function HotkeySettings() {
  const bindings = useHotkeyBindings()
  const [editing, setEditing] = useState<HotkeyAction>()
  // Bindings come from localStorage and display platform glyphs (⌘ vs Ctrl),
  // so the rows render only after mount to keep hydration deterministic.
  const [mounted, setMounted] = useState(false)
  const recorder = useHotkeyRecorder({
    onRecord: (hotkey) => {
      if (editing) setHotkeyBinding(editing, hotkey)
      setEditing(undefined)
    },
    onCancel: () => setEditing(undefined),
  })

  useEffect(() => setMounted(true), [])

  if (!mounted) return null

  return (
    <div className="hotkey-settings">
      {ACTIONS.map((action) => {
        const recording = editing === action && recorder.isRecording
        return (
          <div className="setting-row" key={action}>
            <div>
              <h3>{HOTKEY_ACTION_LABELS[action]}</h3>
              <p>
                {recording
                  ? 'Press a key combination — Esc cancels'
                  : 'Works anywhere in the app'}
              </p>
            </div>
            <button
              className={`hotkey-record-button${recording ? ' is-recording' : ''}`}
              type="button"
              aria-label={`Change shortcut for ${HOTKEY_ACTION_LABELS[action]}`}
              onClick={() => {
                if (recording) {
                  recorder.cancelRecording()
                  return
                }
                setEditing(action)
                recorder.startRecording()
              }}
            >
              {recording ? (
                'Recording…'
              ) : (
                <kbd>{formatForDisplay(bindings[action])}</kbd>
              )}
            </button>
          </div>
        )
      })}
      <button
        className="text-button hotkey-reset"
        type="button"
        onClick={() => {
          setEditing(undefined)
          recorder.cancelRecording()
          resetHotkeyBindings()
        }}
      >
        Reset shortcuts to defaults
      </button>
    </div>
  )
}
