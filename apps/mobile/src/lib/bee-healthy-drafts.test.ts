// @ts-expect-error Bun provides this runtime module without a workspace type package.
import { expect, test } from 'bun:test';

test('all current-user drafts are listed and snapshot cleanup preserves a newer local edit', async () => {
  const entries = new Map<string, string>();
  entries.set('bee-healthy-drafts-v1', JSON.stringify({ version: 1, drafts: {
    'user_draftA:2026-07-01': { journal: 'Old reflection', updatedAt: 1 },
    'user_draftA:2026-09-07': { journal: 'Yesterday', updatedAt: 2 },
    'user_draftB:2026-09-07': { journal: 'Another account', updatedAt: 3 },
  } }));
  const oldStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const oldOs = process.env.EXPO_OS;
  process.env.EXPO_OS = 'web';
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => { entries.set(key, value); },
  } });
  try {
    const { listJournalDrafts, clearJournalDraft, persistJournalDraft } = await import('./bee-healthy-drafts');
    const { drafts } = await listJournalDrafts('user_draftA');
    expect(drafts.map(d => d.localDate)).toEqual(['2026-07-01', '2026-09-07']);
    await persistJournalDraft('user_draftA', '2026-09-07', 'Newer local edit');
    await clearJournalDraft('user_draftA', drafts[1]!.localDate, drafts[1]);
    expect((await listJournalDrafts('user_draftA')).drafts[1]?.journal).toBe('Newer local edit');
    await clearJournalDraft('user_draftA', drafts[0]!.localDate, drafts[0]);
    expect((await listJournalDrafts('user_draftA')).drafts).toHaveLength(1);
    expect((await listJournalDrafts('user_draftB')).drafts[0]?.journal).toBe('Another account');
  } finally {
    if (oldStorage) Object.defineProperty(globalThis, 'localStorage', oldStorage);
    else Reflect.deleteProperty(globalThis, 'localStorage');
    if (oldOs === undefined) delete process.env.EXPO_OS;
    else process.env.EXPO_OS = oldOs;
  }
});
