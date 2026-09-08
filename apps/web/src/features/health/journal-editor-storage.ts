import type { JournalDraftStorage } from '@beegreat/tool-presentation'

function entryKey(userId: string, entryId: string) {
  return `journal-editor-${encodeURIComponent(userId)}-${encodeURIComponent(entryId)}`
}
function entryKeys(key: string) {
  return Object.keys(localStorage).filter(candidate => candidate === key || candidate.startsWith(`${key}:`))
}

export function journalEditorStorage(userId: string, entryId: string): JournalDraftStorage {
  const key = entryKey(userId, entryId)
  const ownKey = `${key}:${crypto.randomUUID()}`
  const generationKeys = [`journal-generation-${encodeURIComponent(userId)}`, `journal-generation-${key}`]
  let generations: Array<string | null> = []
  const current = () => generationKeys.every((item, index) => localStorage.getItem(item) === generations[index])
  return {
    read: () => {
      if (typeof window === 'undefined') return []
      generations = generationKeys.map(item => localStorage.getItem(item))
      return entryKeys(key).flatMap(candidate => { const value = localStorage.getItem(candidate); return value ? [value] : [] })
    },
    write: value => { if (!current()) return; if (value === null) localStorage.removeItem(ownKey); else localStorage.setItem(ownKey, value) },
    remove: unchangedValue => {
      if (!current()) return
      for (const candidate of entryKeys(key)) if (localStorage.getItem(candidate) === unchangedValue) localStorage.removeItem(candidate)
    },
  }
}

export function clearJournalEditorDrafts(userId: string, entryId?: string) {
  localStorage.setItem(entryId ? `journal-generation-${entryKey(userId, entryId)}` : `journal-generation-${encodeURIComponent(userId)}`, crypto.randomUUID())
  const keys = entryId ? entryKeys(entryKey(userId, entryId)) : Object.keys(localStorage).filter(key => key.startsWith(`journal-editor-${encodeURIComponent(userId)}-`))
  for (const key of keys) localStorage.removeItem(key)
}
