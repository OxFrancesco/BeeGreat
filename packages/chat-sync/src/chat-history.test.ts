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
): FlueConversationMessage & { role: 'user' | 'assistant' } {
  const built: FlueConversationMessage & { role: 'user' | 'assistant' } = {
    id,
    role,
    purpose: role,
    display: 'visible',
    parts: [{ type: 'text', text, state: 'done' }],
  };
  if (submissionId) built.submissionId = submissionId;
  return built;
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

  test('drops tombstoned rows and their live Flue twins after a retry', () => {
    const oldUser = message('user:1', 'user', 'What is my wallet?', 'sub-1');
    const oldAssistant = message('assistant:1', 'assistant', 'It failed.');
    const newUser = message('user:2', 'user', 'What is my wallet?', 'sub-2');
    const newAssistant = message('assistant:2', 'assistant', 'Here it is.');
    const rows = [
      {
        id: 'submission:sub-1',
        contentJson: JSON.stringify({ ...oldUser, id: 'submission:sub-1' }),
        createdAt: 1,
        hidden: true,
      },
      {
        id: oldAssistant.id,
        contentJson: JSON.stringify(oldAssistant),
        createdAt: 2,
        hidden: true,
      },
      {
        id: 'submission:sub-2',
        contentJson: JSON.stringify({ ...newUser, id: 'submission:sub-2' }),
        createdAt: 3,
      },
    ];

    // The live Flue transcript still contains the retried turn; hidden rows
    // must suppress both the durable copy and the local echo.
    expect(
      mergeConvexMessages(rows, [
        oldUser,
        oldAssistant,
        newUser,
        newAssistant,
      ]),
    ).toEqual([newUser, newAssistant]);
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
