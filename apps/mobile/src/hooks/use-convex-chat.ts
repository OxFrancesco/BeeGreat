import { api } from '@beegreat/backend/convex/_generated/api';
import type { FlueConversationMessage } from '@flue/sdk';
import { useMutation, useQuery } from 'convex/react';
import { useCallback, useEffect, useMemo, useRef } from 'react';

export type ChatThread = {
  id: number;
  createdAt: number;
  title?: string;
};

const DEFAULT_THREAD: ChatThread = { id: 0, createdAt: 0 };

export function useChatThreads() {
  return useQuery(api.chat.listThreads, {}) ?? [DEFAULT_THREAD];
}

export function useActiveChatThread() {
  return useQuery(api.chat.getActiveThread, {}) ?? 0;
}

export function useChatThreadActions() {
  const create = useMutation(api.chat.createThread);
  const activate = useMutation(api.chat.setActiveThread);
  const title = useMutation(api.chat.setThreadTitle);

  return {
    createThread: useCallback(() => create({}), [create]),
    activateThread: useCallback(
      (threadId: number) => activate({ threadId }),
      [activate],
    ),
    titleThread: useCallback(
      (threadId: number, nextTitle: string) => title({ threadId, title: nextTitle }),
      [title],
    ),
  };
}

function messageTimestamp(message: FlueConversationMessage, fallback: number) {
  const value = message.metadata?.timestamp;
  const parsed = typeof value === 'string' ? Date.parse(value) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * Mirrors Flue's durable execution transcript into Convex, then renders the
 * realtime Convex subscription. Local streaming parts temporarily win until
 * their newest canonical envelope reaches Convex.
 */
export function useConvexMessages(
  threadId: number,
  flueMessages: FlueConversationMessage[],
) {
  const rows = useQuery(api.chat.listMessages, { threadId });
  const sync = useMutation(api.chat.syncMessages);
  const fingerprint = useMemo(
    () =>
      JSON.stringify(
        flueMessages
          .filter((message) => !message.id.startsWith('local:'))
          .map((message) => [message.id, message]),
      ),
    [flueMessages],
  );
  const lastSynced = useRef('');

  useEffect(() => {
    if (!fingerprint || fingerprint === '[]' || fingerprint === lastSynced.current) return;
    const timer = setTimeout(() => {
      const canonical = flueMessages.filter((message) => !message.id.startsWith('local:'));
      const run = async () => {
        for (let offset = 0; offset < canonical.length; offset += 200) {
          const chunk = canonical.slice(offset, offset + 200).map((message, index) => ({
            id: message.id,
            role: message.role,
            contentJson: JSON.stringify(message),
            createdAt: messageTimestamp(message, offset + index),
          }));
          await sync({ threadId, messages: chunk });
        }
        lastSynced.current = fingerprint;
      };
      void run().catch(() => {
        // Flue remains readable if Convex is temporarily offline; its next
        // transcript update retries the idempotent sync.
      });
    }, 120);
    return () => clearTimeout(timer);
  }, [fingerprint, flueMessages, sync, threadId]);

  return useMemo(() => {
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
    const position = new Map(ordered.map((entry, index) => [entry.message.id, index]));
    const fallbackTimestamp =
      ordered.reduce((latest, entry) => Math.max(latest, entry.createdAt), 0) + 1;
    for (const [index, message] of flueMessages.entries()) {
      const existing = position.get(message.id);
      if (existing === undefined) {
        position.set(message.id, ordered.length);
        ordered.push({
          message,
          createdAt: messageTimestamp(message, fallbackTimestamp + index),
        });
      } else {
        ordered[existing] = { ...ordered[existing], message };
      }
    }
    return ordered.sort((left, right) => left.createdAt - right.createdAt).map(({ message }) => message);
  }, [flueMessages, rows]);
}
