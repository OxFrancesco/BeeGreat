import type { FlueConversationMessage } from '@flue/sdk';

import {
  changedMessagesForConvexSync,
  type ChatMessageSyncEnvelope,
} from './chat-history';

const SYNC_DEBOUNCE_MS = 120;
const SYNC_RETRY_MAX_MS = 15_000;
const SYNC_BATCH_SIZE = 200;

/** Persists one batch; resolution (a Convex mutation's null) is the only signal consumed. */
type SyncBatch = (messages: ChatMessageSyncEnvelope[]) => Promise<null | void>;
type ReportSyncError = (cause: unknown) => void;

/** The one deterministic Convex rejection the queue reacts to structurally. */
type SyncRejectionCode = 'TOO_LARGE';

/** Reads a ConvexError-style `{ data: { code } }` rejection off a sync failure. */
function syncErrorCode(cause: unknown): SyncRejectionCode | undefined {
  if (!(cause instanceof Object) || !('data' in cause)) return undefined;
  const data = cause.data;
  if (!(data instanceof Object) || !('code' in data)) return undefined;
  return data.code === 'TOO_LARGE' ? 'TOO_LARGE' : undefined;
}

/** Debounces live envelopes and serializes writes without losing a newer delta. */
export class TranscriptSyncQueue {
  private readonly sent = new Map<string, string>();
  private readonly pending = new Map<string, ChatMessageSyncEnvelope>();
  private readonly inFlight = new Map<string, ChatMessageSyncEnvelope>();
  private timer?: ReturnType<typeof setTimeout>;
  private flushing = false;
  private retryCount = 0;
  private disposed = false;

  constructor(
    private readonly syncBatch: SyncBatch,
    private readonly reportError: ReportSyncError,
  ) {}

  enqueue(messages: FlueConversationMessage[]) {
    if (this.disposed) return;
    const known = new Map(this.sent);
    for (const message of this.inFlight.values()) {
      known.set(message.id, message.contentJson);
    }
    for (const message of this.pending.values()) {
      known.set(message.id, message.contentJson);
    }
    for (const message of changedMessagesForConvexSync(messages, known)) {
      this.pending.set(message.id, message);
    }
    this.schedule();
  }

  activate() {
    this.disposed = false;
    this.schedule();
  }

  dispose() {
    this.disposed = true;
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined;
  }

  private isActive() {
    return !this.disposed;
  }

  private schedule(delay = SYNC_DEBOUNCE_MS) {
    if (
      this.disposed ||
      this.flushing ||
      this.timer ||
      this.pending.size === 0
    ) {
      return;
    }
    this.timer = setTimeout(() => {
      this.timer = undefined;
      void this.flush();
    }, delay);
  }

  private async flush() {
    if (this.disposed || this.flushing || this.pending.size === 0) return;

    this.flushing = true;
    const batch = [...this.pending.values()];
    this.pending.clear();
    for (const message of batch) this.inFlight.set(message.id, message);
    let retryDelay = SYNC_DEBOUNCE_MS;

    try {
      for (let offset = 0; offset < batch.length; offset += SYNC_BATCH_SIZE) {
        await this.persistChunk(batch.slice(offset, offset + SYNC_BATCH_SIZE));
      }
      this.retryCount = 0;
    } catch (error) {
      if (this.isActive()) {
        for (const message of this.inFlight.values()) {
          if (!this.pending.has(message.id)) this.pending.set(message.id, message);
        }
        this.inFlight.clear();
        const shouldReport = this.retryCount === 0;
        retryDelay = Math.min(
          1_000 * 2 ** this.retryCount,
          SYNC_RETRY_MAX_MS,
        );
        this.retryCount += 1;
        if (shouldReport) this.reportError(error);
      }
    } finally {
      this.flushing = false;
      this.schedule(retryDelay);
    }
  }

  private markHandled(messages: ChatMessageSyncEnvelope[]) {
    for (const message of messages) {
      this.sent.set(message.id, message.contentJson);
      this.inFlight.delete(message.id);
    }
  }

  private async persistChunk(messages: ChatMessageSyncEnvelope[]): Promise<void> {
    try {
      await this.syncBatch(messages);
      this.markHandled(messages);
    } catch (error) {
      const code = syncErrorCode(error);
      if (code === 'TOO_LARGE' && messages.length > 1) {
        const middle = Math.ceil(messages.length / 2);
        await this.persistChunk(messages.slice(0, middle));
        await this.persistChunk(messages.slice(middle));
        return;
      }
      if (code === 'TOO_LARGE') {
        // A deterministic rejection must not poison every later delta.
        // Mark this envelope handled; changed content can still be retried.
        this.markHandled(messages);
        this.reportError(error);
        return;
      }
      throw error;
    }
  }
}
