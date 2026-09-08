import { expect, test } from 'bun:test';
import { JournalSession, type JournalRevision } from './journal-session';

const initial: JournalRevision = { title: '', body: 'Initial', tags: [], updatedAt: 1 };
function deferred<T>() { let resolve!: (value: T) => void; let reject!: (error: Error) => void; const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
function fixture(persist?: (draft: JournalRevision) => Promise<JournalRevision>) {
  let remote = initial;
  let stored: string | null = null;
  const calls: JournalRevision[] = [];
  const options = {
    persist: async (draft: Omit<JournalRevision, 'updatedAt'>, expectedUpdatedAt: number) => {
      calls.push({ ...draft, updatedAt: expectedUpdatedAt });
      if (persist) return persist({ ...draft, updatedAt: expectedUpdatedAt });
      if (expectedUpdatedAt !== remote.updatedAt) throw new Error('CONFLICT');
      remote = { ...draft, updatedAt: remote.updatedAt + 1 };
      return remote;
    },
    load: async () => remote,
    storage: { read: () => stored ? [stored] : [], write: (value: string | null) => { stored = value; } },
  };
  const session = new JournalSession(options);
  session.receive(initial);
  return { session, options, calls, setRemote: (value: JournalRevision) => { remote = value; }, stored: () => stored };
}

test('idle editors hydrate remote changes without writing them back', async () => {
  const f = fixture();
  f.session.receive({ ...initial, body: 'Another device', updatedAt: 2 });
  expect(f.session.getSnapshot()).toMatchObject({ draft: { body: 'Another device' }, status: 'saved', dirty: false });
  expect(await f.session.save()).toBe(true);
  expect(f.calls).toHaveLength(0);
});

test('local and remote changes require an explicit choice and keep local recovery', async () => {
  const f = fixture();
  f.session.edit({ body: 'My local version' });
  const remote = { ...initial, body: 'Another device', updatedAt: 2 };
  f.setRemote(remote); f.session.receive(remote);
  expect(f.session.getSnapshot().status).toBe('conflict');
  expect(await f.session.save()).toBe(false);
  expect(f.calls).toHaveLength(0);
  const restored = new JournalSession(f.options); restored.receive(remote);
  expect(restored.getSnapshot()).toMatchObject({ status: 'conflict', draft: { body: 'My local version' } });
  expect(await restored.resolve('keep')).toBe(true);
  expect(f.calls[0]).toMatchObject({ body: 'My local version', updatedAt: 2 });
  expect(f.stored()).toBeNull();
});

test('Done coalesces with autosave and waits for typing made during the request', async () => {
  const first = deferred<JournalRevision>();
  const second = deferred<JournalRevision>();
  let n = 0;
  const secondStarted = deferred<void>();
  const f = fixture(() => { if (++n === 1) return first.promise; secondStarted.resolve(); return second.promise; });
  f.session.edit({ body: 'First' });
  const autosave = f.session.save();
  await Promise.resolve();
  f.session.edit({ body: 'Second' });
  const done = f.session.save();
  expect(done).toBe(autosave);
  expect(f.calls).toHaveLength(1);
  first.resolve({ ...initial, body: 'First', updatedAt: 2 });
  await secondStarted.promise;
  expect(f.calls).toHaveLength(2);
  expect(f.calls[1]).toMatchObject({ body: 'Second', updatedAt: 2 });
  expect(f.session.getSnapshot().status).toBe('saving');
  second.resolve({ ...initial, body: 'Second', updatedAt: 3 });
  expect(await done).toBe(true);
  expect(f.session.getSnapshot()).toMatchObject({ status: 'saved', dirty: false, draft: { body: 'Second' } });
});

test('failed navigation saves retain a draft and reload restores it', async () => {
  const f = fixture(async () => { throw new Error('Offline'); });
  f.session.edit({ title: 'Before leaving', body: 'Latest keystroke' });
  expect(f.stored()).toContain('Latest keystroke');
  expect(await f.session.save()).toBe(false);
  expect(f.session.getSnapshot().status).toBe('error');
  const restored = new JournalSession(f.options); restored.receive(initial);
  expect(restored.getSnapshot()).toMatchObject({ status: 'unsaved', dirty: true, draft: { body: 'Latest keystroke' } });
  await restored.resolve('reload');
  expect(restored.getSnapshot()).toMatchObject({ status: 'saved', draft: { body: 'Initial' } });
});

test('a remote winner during an in-flight write is preserved after CAS rejection', async () => {
  const request = deferred<JournalRevision>();
  const f = fixture(() => request.promise);
  f.session.edit({ body: 'Local' });
  const save = f.session.save(); await Promise.resolve();
  const newer = { ...initial, body: 'Winner', updatedAt: 2 };
  f.setRemote(newer); f.session.receive(newer);
  request.reject(new Error('CONFLICT'));
  expect(await save).toBe(false);
  expect(f.session.getSnapshot()).toMatchObject({ status: 'conflict', draft: { body: 'Local' } });
  expect(f.calls).toHaveLength(1);
});

test('photo and flag changes rebase dirty text without creating a false conflict', async () => {
  const f = fixture(); f.session.edit({ body: 'Local' });
  const metadataOnly = { ...initial, updatedAt: 2 };
  f.setRemote(metadataOnly); f.session.receive(metadataOnly);
  expect(f.session.getSnapshot().status).toBe('unsaved');
  expect(await f.session.save()).toBe(true);
  expect(f.calls[0]?.updatedAt).toBe(2);
});
