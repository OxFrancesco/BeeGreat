// @ts-expect-error Bun provides this runtime module without a workspace type package.
import { describe, expect, test } from 'bun:test';
import type { FlueConversationMessage } from '@flue/sdk';

import { mergeConvexMessages } from './merge-convex-messages';

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
});
