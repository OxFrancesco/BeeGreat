import { expect, test } from 'bun:test'
import { JournalSession } from '@beegreat/tool-presentation'
import { clearJournalEditorDrafts, journalEditorStorage } from './journal-editor-storage'

const base = { title: '', body: 'Saved', tags: [], updatedAt: 1 }

test('independent editors retain their drafts and deleted-account writers cannot recreate them', async () => {
  const oldStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  const oldWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')
  const values: Record<string, string> = {}
  Object.defineProperties(values, {
    getItem: { value: (key: string) => values[key] ?? null },
    setItem: { value: (key: string, value: string) => { values[key] = value } },
    removeItem: { value: (key: string) => { delete values[key] } },
  })
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: values })
  Object.defineProperty(globalThis, 'window', { configurable: true, value: {} })
  try {
    const make = (entryId = 'entryA') => new JournalSession({ storage: journalEditorStorage('user_A', entryId), load: () => Promise.resolve(base), persist: () => Promise.reject(new Error('Offline')) })
    const first = make(); const idle = make()
    first.receive(base); idle.receive(base)
    first.edit({ body: 'First tab draft' })
    idle.receive({ ...base, updatedAt: 2 })
    const restored = make(); restored.receive(base)
    expect(restored.getSnapshot().draft.body).toBe('First tab draft')
    idle.edit({ body: 'Second tab draft' })
    expect(Object.values(values).some(value => value.includes('First tab draft'))).toBe(true)
    expect(Object.values(values).some(value => value.includes('Second tab draft'))).toBe(true)

    let reject!: (error: Error) => void
    const pending = new JournalSession({ storage: journalEditorStorage('user_A', 'entryA'), load: () => Promise.resolve(base), persist: () => new Promise((_resolve, no) => { reject = no }) })
    pending.receive(base); pending.edit({ body: 'Pending secret' })
    const saving = pending.save(); await Promise.resolve()
    clearJournalEditorDrafts('user_A')
    reject(new Error('Account deleted'))
    await saving
    first.edit({ body: 'Late old-tab write' })
    expect(Object.keys(values).filter(key => key.startsWith('journal-editor-'))).toEqual([])

    const next = make(); next.receive(base); next.edit({ body: 'New session' })
    const otherEntry = make('entryB'); otherEntry.receive(base); otherEntry.edit({ body: 'Keep entry B' })
    clearJournalEditorDrafts('user_A', 'entryA')
    next.edit({ body: 'Late removed-entry write' })
    expect(Object.values(values).some(value => value.includes('Keep entry B'))).toBe(true)
    expect(Object.values(values).some(value => value.includes('Late removed-entry write'))).toBe(false)
  } finally {
    if (oldStorage) Object.defineProperty(globalThis, 'localStorage', oldStorage); else Reflect.deleteProperty(globalThis, 'localStorage')
    if (oldWindow) Object.defineProperty(globalThis, 'window', oldWindow); else Reflect.deleteProperty(globalThis, 'window')
  }
})
