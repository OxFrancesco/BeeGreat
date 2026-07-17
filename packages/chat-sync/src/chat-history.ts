import type { FlueConversationMessage } from '@flue/sdk';

export type StoredChatMessage = {
  id: string;
  contentJson: string;
  createdAt: number;
};

export type ChatMessageSyncEnvelope = {
  id: string;
  role: 'user' | 'assistant';
  contentJson: string;
  createdAt: number;
};

const LIVE_SYNC_TAIL_SIZE = 8;

function messageKeys(message: FlueConversationMessage) {
  return [
    `id:${message.id}`,
    ...(message.role === 'user' && message.submissionId
      ? [`submission:${message.submissionId}`]
      : []),
  ];
}

function messageTimestamp(message: FlueConversationMessage, fallback: number) {
  const value = message.metadata?.timestamp;
  const parsed = typeof value === 'string' ? Date.parse(value) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : fallback;
}

function findMessagePosition(
  entry: { message: FlueConversationMessage; createdAt: number },
  position: Map<string, number>,
) {
  return messageKeys(entry.message)
    .map((key) => position.get(key))
    .find((value) => value !== undefined);
}

/** Gives admitted user turns a stable key while Flue reconciles its local echo. */
export function messagesForConvexSync(messages: FlueConversationMessage[]) {
  return messages.flatMap((message) => {
    if (message.role === 'user' && message.submissionId) {
      return [{ ...message, id: `submission:${message.submissionId}` }];
    }
    if (message.id.startsWith('local:')) {
      return [];
    }
    return [message];
  });
}

/** Serializes only unknown messages and the active tail of a live snapshot. */
export function changedMessagesForConvexSync(
  messages: FlueConversationMessage[],
  knownContent: ReadonlyMap<string, string>,
): ChatMessageSyncEnvelope[] {
  const syncable = messagesForConvexSync(messages);
  const tailStart = Math.max(0, syncable.length - LIVE_SYNC_TAIL_SIZE);

  return syncable.flatMap((message, index) => {
    const previous = knownContent.get(message.id);
    if (previous !== undefined && index < tailStart) return [];

    const contentJson = JSON.stringify(message);
    if (previous === contentJson) return [];

    return [{
      id: message.id,
      role: message.role,
      contentJson,
      createdAt: messageTimestamp(message, index),
    }];
  });
}

/** Combines the durable transcript with Flue's live streaming envelope. */
export function mergeConvexMessages(
  rows: StoredChatMessage[] | undefined,
  flueMessages: FlueConversationMessage[],
) {
  const ordered: { message: FlueConversationMessage; createdAt: number }[] = [];
  const position = new Map<string, number>();

  for (const row of rows ?? []) {
    try {
      const message = JSON.parse(row.contentJson) as FlueConversationMessage;
      const entry = {
        message,
        createdAt: messageTimestamp(message, row.createdAt),
      };
      const existing = findMessagePosition(entry, position);
      if (existing === undefined) {
        const nextIndex = ordered.length;
        ordered.push(entry);
        for (const key of messageKeys(message)) position.set(key, nextIndex);
      } else {
        const previous = ordered[existing];
        ordered[existing] = {
          message,
          createdAt: Math.min(previous.createdAt, entry.createdAt),
        };
        for (const key of [
          ...messageKeys(previous.message),
          ...messageKeys(message),
        ]) {
          position.set(key, existing);
        }
      }
    } catch {
      // One malformed stored envelope should not hide the rest of the chat.
    }
  }

  const fallbackTimestamp =
    ordered.reduce((latest, entry) => Math.max(latest, entry.createdAt), 0) + 1;

  for (const [index, message] of flueMessages.entries()) {
    const entry = {
      message,
      createdAt: messageTimestamp(message, fallbackTimestamp + index),
    };
    const existing = findMessagePosition(entry, position);
    if (existing === undefined) {
      const nextIndex = ordered.length;
      for (const key of messageKeys(message)) position.set(key, nextIndex);
      ordered.push(entry);
    } else {
      for (const key of messageKeys(message)) position.set(key, existing);
      ordered[existing] = { ...ordered[existing], message };
    }
  }

  return ordered
    .sort((left, right) => left.createdAt - right.createdAt)
    .map(({ message }) => message);
}
