import type { FlueConversationMessage } from '@flue/sdk';

export type StoredChatMessage = {
  id: string;
  contentJson: string;
  createdAt: number;
};

function messageKeys(message: FlueConversationMessage) {
  return [
    `id:${message.id}`,
    ...(message.submissionId ? [`submission:${message.submissionId}`] : []),
  ];
}

function messageTimestamp(message: FlueConversationMessage, fallback: number) {
  const value = message.metadata?.timestamp;
  const parsed = typeof value === 'string' ? Date.parse(value) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : fallback;
}

/** Combines Convex's durable transcript with Flue's live streaming envelope. */
export function mergeConvexMessages(
  rows: StoredChatMessage[] | undefined,
  flueMessages: FlueConversationMessage[],
) {
  if (!rows?.length) return flueMessages;
  const ordered = rows.flatMap((row) => {
    try {
      return [
        {
          message: JSON.parse(row.contentJson) as FlueConversationMessage,
          createdAt: row.createdAt,
        },
      ];
    } catch {
      return [];
    }
  });
  const position = new Map<string, number>();
  for (const [index, entry] of ordered.entries()) {
    for (const key of messageKeys(entry.message)) position.set(key, index);
  }
  const fallbackTimestamp =
    ordered.reduce((latest, entry) => Math.max(latest, entry.createdAt), 0) + 1;
  for (const [index, message] of flueMessages.entries()) {
    const existing = messageKeys(message)
      .map((key) => position.get(key))
      .find((value) => value !== undefined);
    if (existing === undefined) {
      const nextIndex = ordered.length;
      for (const key of messageKeys(message)) position.set(key, nextIndex);
      ordered.push({
        message,
        createdAt: messageTimestamp(message, fallbackTimestamp + index),
      });
    } else {
      for (const key of messageKeys(message)) position.set(key, existing);
      ordered[existing] = { ...ordered[existing], message };
    }
  }
  return ordered
    .sort((left, right) => left.createdAt - right.createdAt)
    .map(({ message }) => message);
}
