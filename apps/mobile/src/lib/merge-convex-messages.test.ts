// @ts-expect-error Bun provides this runtime module without a workspace type package.
import { describe, expect, test } from 'bun:test';
import type { FlueConversationMessage } from '@flue/sdk';

import {
  mergeConvexMessages,
  messagesForConvexSync,
} from './merge-convex-messages';

function userMessage(id: string, submissionId: string): FlueConversationMessage {
  return {
    id,
    submissionId,
    role: 'user',
    metadata: { timestamp: '2026-07-12T10:00:00.000Z' },
    parts: [{ type: 'text', text: 'Create a weekly planning task', state: 'done' }],
  };
}

describe('mergeConvexMessages', () => {
  test('reconciles one voice submission across canonical and optimistic ids', () => {
    const canonical = userMessage('message:durable-1', 'submission-1');
    const optimistic = userMessage('local:bee:user_1:1', 'submission-1');

    const result = mergeConvexMessages(
      [{ id: canonical.id, contentJson: JSON.stringify(canonical), createdAt: 1 }],
      [optimistic],
    );

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe(optimistic.id);
  });

  test('keeps an admitted optimistic user message durable across a live-session remount', () => {
    const admitted = userMessage('local:bee:user_1:1', 'submission-1');
    const syncable = messagesForConvexSync([admitted]);

    expect(syncable).toHaveLength(1);
    expect(syncable[0]?.id).toBe('submission:submission-1');

    const result = mergeConvexMessages(
      syncable.map((message) => ({
        id: message.id,
        contentJson: JSON.stringify(message),
        createdAt: 1,
      })),
      [],
    );

    expect(result).toHaveLength(1);
    expect(result[0]?.parts[0]).toMatchObject({
      type: 'text',
      text: 'Create a weekly planning task',
    });
  });

  test('collapses legacy id-keyed and submission-keyed copies of the same user turn', () => {
    const legacy = userMessage('message:durable-1', 'submission-1');
    const stable = userMessage('submission:submission-1', 'submission-1');

    const result = mergeConvexMessages(
      [
        { id: legacy.id, contentJson: JSON.stringify(legacy), createdAt: 1 },
        { id: stable.id, contentJson: JSON.stringify(stable), createdAt: 1 },
      ],
      [legacy],
    );

    expect(result).toHaveLength(1);
  });
});
