import { describe, expect, test } from 'bun:test';
import type { FlueConversationMessage } from '@flue/sdk';

import {
  changedMessagesForConvexSync,
  mergeConvexMessages,
  messagesForConvexSync,
} from './index';

function message(
  id: string,
  role: 'user' | 'assistant',
  text: string,
  submissionId?: string,
): FlueConversationMessage {
  return {
    id,
    role,
    ...(submissionId ? { submissionId } : {}),
    parts: [{ type: 'text', text, state: 'done' }],
  };
}

describe('chat history', () => {
  test('keeps distinct user and assistant turns that share a submission', () => {
    const user = message('user:1', 'user', 'Hello', 'submission:1');
    const assistant = message(
      'assistant:1',
      'assistant',
      'Hi!',
      'submission:1',
    );

    expect(mergeConvexMessages([], [user, assistant])).toEqual([
      user,
      assistant,
    ]);
  });

  test('waits for admission before giving a local user turn a durable id', () => {
    const pending = message('local:1', 'user', 'Hello');
    const admitted = message('local:1', 'user', 'Hello', 'submission:1');

    expect(messagesForConvexSync([pending])).toEqual([]);
    expect(messagesForConvexSync([admitted])).toEqual([
      { ...admitted, id: 'submission:submission:1' },
    ]);
  });

  test('lets each live streaming envelope replace its stale durable copy', () => {
    const durable = message('assistant:1', 'assistant', 'Hel');
    const first = message('assistant:1', 'assistant', 'Hello');
    const second = message('assistant:1', 'assistant', 'Hello from Bee');
    const row = {
      id: durable.id,
      contentJson: JSON.stringify(durable),
      createdAt: 1,
    };

    expect(mergeConvexMessages([row], [first])).toEqual([first]);
    expect(mergeConvexMessages([row], [second])).toEqual([second]);
  });

  test('returns only changed live envelopes after the initial snapshot', () => {
    const user = message('user:1', 'user', 'Hello', 'submission:1');
    const partial = message('assistant:1', 'assistant', 'Hel');
    const initial = changedMessagesForConvexSync([user, partial], new Map());
    const known = new Map(
      initial.map((entry) => [entry.id, entry.contentJson]),
    );
    const next = message('assistant:1', 'assistant', 'Hello');

    expect(changedMessagesForConvexSync([user, partial], known)).toEqual([]);
    expect(changedMessagesForConvexSync([user, next], known)).toEqual([
      expect.objectContaining({
        id: next.id,
        contentJson: JSON.stringify(next),
      }),
    ]);
  });
});
