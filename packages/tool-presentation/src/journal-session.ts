import { z } from 'zod';
import { compareDrafts, type JournalDraft, type JournalSaveState } from './journal-draft';

const draftSchema = z.object({ title: z.string().max(160), body: z.string().max(50_000), tags: z.array(z.string().max(30)).max(10) });
const revisionSchema = draftSchema.extend({ updatedAt: z.number().int().nonnegative() });
const backupSchema = z.object({ version: z.literal(1), savedAt: z.number(), draft: draftSchema, base: revisionSchema });
export type JournalRevision = JournalDraft & { updatedAt: number };
export type JournalDraftStorage = { read: () => string[]; write: (value: string | null) => void; remove?: (unchangedValue: string) => void };
export type JournalSessionState = { draft: JournalDraft; status: JournalSaveState; dirty: boolean; error?: string };

function copyDraft(value: JournalDraft): JournalDraft {
  return { title: value.title, body: value.body, tags: [...value.tags] };
}

export class JournalSession {
  private base?: JournalRevision;
  private remote?: JournalRevision;
  private queuedRemote?: JournalRevision;
  private backup?: z.infer<typeof backupSchema>;
  private recoveredSource?: string;
  private running?: Promise<boolean>;
  private savedAt = 0;
  private listeners = new Set<() => void>();
  private state: JournalSessionState = { draft: { title: '', body: '', tags: [] }, status: 'loading', dirty: false };

  constructor(private readonly options: {
    persist: (draft: JournalDraft, expectedUpdatedAt: number) => Promise<JournalRevision>;
    load: () => Promise<JournalRevision | null>;
    storage: JournalDraftStorage;
  }) {
    try {
      const copies = options.storage.read();
      for (const raw of copies) {
        try {
          const candidate = backupSchema.parse(JSON.parse(raw));
          if (!this.backup || candidate.savedAt > this.backup.savedAt) { this.backup = candidate; this.recoveredSource = raw; }
        } catch { /* A second native copy may still be readable. */ }
      }
      if (copies.length && !this.backup) this.state = { ...this.state, error: 'The offline draft could not be read.' };
      this.savedAt = this.backup?.savedAt ?? 0;
    } catch { this.state = { ...this.state, error: 'Offline draft storage is unavailable.' }; }
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };
  getSnapshot = () => this.state;

  private publish(status: JournalSaveState, error?: string) {
    const dirty = !!this.base && !compareDrafts(this.state.draft, this.base);
    try {
      if (this.base) {
        this.savedAt = Math.max(Date.now(), this.savedAt + 1);
        this.options.storage.write(dirty ? JSON.stringify({ version: 1, savedAt: this.savedAt, base: this.base, draft: this.state.draft }) : null);
        if (!dirty && this.recoveredSource) {
          this.options.storage.remove?.(this.recoveredSource);
          this.recoveredSource = undefined;
        }
      }
    } catch { error = 'The offline copy could not be saved. Keep this editor open until saving succeeds.'; }
    this.state = { ...this.state, status, dirty, error };
    for (const listener of this.listeners) listener();
  }

  receive = (value: JournalRevision) => {
    if (this.running) {
      if (!this.queuedRemote || value.updatedAt > this.queuedRemote.updatedAt) this.queuedRemote = value;
      return;
    }
    this.reconcile(value);
  };

  private reconcile(value: JournalRevision) {
    if (!this.base) {
      const backup = this.backup;
      this.backup = undefined;
      if (backup && !compareDrafts(backup.draft, value)) {
        this.base = backup.base;
        this.state = { ...this.state, draft: copyDraft(backup.draft) };
      } else {
        this.base = value;
        this.state = { ...this.state, draft: copyDraft(value) };
        this.publish('saved');
        return;
      }
    }
    if (value.updatedAt < this.base.updatedAt) {
      if (this.state.status === 'loading') this.publish('error', 'Waiting for the latest saved entry. Your offline draft is retained.');
      return;
    }
    if (compareDrafts(this.state.draft, this.base)) {
      this.base = value;
      this.remote = undefined;
      this.state = { ...this.state, draft: copyDraft(value) };
      this.publish('saved');
    } else if (compareDrafts(value, this.base) || compareDrafts(value, this.state.draft)) {
      this.base = value;
      this.remote = undefined;
      this.publish(compareDrafts(this.state.draft, value) ? 'saved' : 'unsaved');
    } else {
      this.remote = value;
      this.publish('conflict', 'This entry changed elsewhere. Your draft is still here.');
    }
  }

  edit = (patch: Partial<JournalDraft>) => {
    if (!this.base) return;
    this.state = { ...this.state, draft: copyDraft({ ...this.state.draft, ...patch }) };
    this.publish(this.remote ? 'conflict' : this.running ? 'saving' : compareDrafts(this.state.draft, this.base) ? 'saved' : 'unsaved', this.remote ? 'This entry changed elsewhere. Your draft is still here.' : undefined);
  };

  save = (): Promise<boolean> => {
    if (this.running) return this.running;
    if (!this.base || this.remote) return Promise.resolve(false);
    if (!this.state.dirty) return Promise.resolve(true);
    // Defer the body until running is set, including synchronous subscribers.
    const operation = Promise.resolve().then(async () => {
      try {
        while (this.base && !compareDrafts(this.state.draft, this.base)) {
          const snapshot = copyDraft(this.state.draft);
          this.publish('saving');
          const updated = await this.options.persist(snapshot, this.base.updatedAt);
          this.base = updated;
          // Preserve typing during the request; only normalize the saved draft
          // when the user has not changed it since this request began.
          if (compareDrafts(this.state.draft, snapshot)) this.state = { ...this.state, draft: copyDraft(updated) };
          const queued = this.queuedRemote;
          this.queuedRemote = undefined;
          if (queued && queued.updatedAt > updated.updatedAt) this.reconcile(queued);
          if (this.remote) return false;
        }
        this.publish('saved');
        return true;
      } catch (cause) {
        const queued = this.queuedRemote;
        this.queuedRemote = undefined;
        try {
          const latest = await this.options.load();
          if (latest) this.reconcile(latest);
          else if (queued) this.reconcile(queued);
        } catch { if (queued) this.reconcile(queued); }
        if (!this.remote) this.publish('error', cause instanceof Error ? cause.message : 'This entry is not saved yet.');
        return false;
      } finally {
        this.running = undefined;
        const queued = this.queuedRemote;
        this.queuedRemote = undefined;
        if (queued) this.reconcile(queued);
      }
    });
    this.running = operation;
    return operation;
  };

  resolve = async (choice: 'reload' | 'keep') => {
    if (this.running) await this.running;
    try {
      const latest = await this.options.load();
      if (!latest) throw new Error('This entry is no longer available. Your offline draft is retained.');
      this.base = latest;
      this.remote = undefined;
      this.queuedRemote = undefined;
      if (choice === 'reload') this.state = { ...this.state, draft: copyDraft(latest) };
      this.publish(compareDrafts(this.state.draft, latest) ? 'saved' : 'unsaved');
      return choice === 'keep' ? await this.save() : true;
    } catch (cause) {
      this.publish('error', cause instanceof Error ? cause.message : 'Could not load the saved entry.');
      return false;
    }
  };

  discard = () => {
    this.remote = undefined;
    if (this.base) this.state = { ...this.state, draft: copyDraft(this.base) };
    this.publish('saved');
  };
}
