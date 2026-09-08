import { randomUUID } from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';
import type { JournalDraftStorage } from '@beegreat/tool-presentation';

const nativeGenerations = new Map<string, number>();

function entryKey(userId: string, entryId: string) {
  return `journal-editor-${encodeURIComponent(userId)}-${encodeURIComponent(entryId)}`;
}
function entryKeys(key: string) {
  return Object.keys(localStorage).filter(candidate => candidate === key || candidate.startsWith(`${key}:`));
}
function entryFiles(key: string) {
  return new Directory(Paths.document).list().filter((file): file is File => file instanceof File && (file.name.startsWith(`${key}:`) || file.name === `${key}.json` || file.name === `${key}.backup.json`));
}

export function journalEditorStorage(userId: string, entryId: string): JournalDraftStorage {
  const key = entryKey(userId, entryId);
  const ownKey = `${key}:${randomUUID()}`;
  const generationKeys = [`journal-generation-${encodeURIComponent(userId)}`, `journal-generation-${key}`];
  let generations: (string | number | null | undefined)[] = [];
  const current = () => generationKeys.every((item, index) => (process.env.EXPO_OS === 'web' ? localStorage.getItem(item) : nativeGenerations.get(item)) === generations[index]);
  if (process.env.EXPO_OS === 'web') return {
    read: () => { generations = generationKeys.map(item => localStorage.getItem(item)); return entryKeys(key).flatMap(candidate => { const value = localStorage.getItem(candidate); return value ? [value] : []; }); },
    write: value => { if (!current()) return; if (value === null) localStorage.removeItem(ownKey); else localStorage.setItem(ownKey, value); },
    remove: unchangedValue => { if (!current()) return; for (const candidate of entryKeys(key)) if (localStorage.getItem(candidate) === unchangedValue) localStorage.removeItem(candidate); },
  };
  const primary = new File(Paths.document, `${ownKey}.json`);
  const backup = new File(Paths.document, `${ownKey}.backup.json`);
  return {
    read: () => { generations = generationKeys.map(item => nativeGenerations.get(item)); return entryFiles(key).map(file => file.textSync()); },
    write: value => {
      if (!current()) return;
      for (const file of [backup, primary]) {
        if (value === null) { if (file.exists) file.delete(); }
        else { file.create({ intermediates: true, overwrite: true }); file.write(value); }
      }
    },
    remove: unchangedValue => { if (!current()) return; for (const file of entryFiles(key)) if (file.textSync() === unchangedValue) file.delete(); },
  };
}

export function clearJournalEditorDrafts(userId: string, entryId?: string) {
  const generationKey = entryId ? `journal-generation-${entryKey(userId, entryId)}` : `journal-generation-${encodeURIComponent(userId)}`;
  if (process.env.EXPO_OS === 'web') localStorage.setItem(generationKey, randomUUID());
  else nativeGenerations.set(generationKey, (nativeGenerations.get(generationKey) ?? 0) + 1);
  const prefix = `journal-editor-${encodeURIComponent(userId)}-`;
  if (process.env.EXPO_OS === 'web') {
    const keys = entryId ? entryKeys(entryKey(userId, entryId)) : Object.keys(localStorage).filter(key => key.startsWith(prefix));
    for (const key of keys) localStorage.removeItem(key);
    return;
  }
  const files = entryId ? entryFiles(entryKey(userId, entryId)) : new Directory(Paths.document).list().filter((file): file is File => file instanceof File && file.name.startsWith(prefix));
  for (const file of files) file.delete();
}
