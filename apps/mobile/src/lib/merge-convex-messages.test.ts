// @ts-expect-error Bun provides this runtime module without a workspace type package.
import { describe, expect, test } from 'bun:test';
import {
  changedMessagesForConvexSync,
  mergeConvexMessages,
  messagesForConvexSync,
} from '@beegreat/chat-sync';
import type { FlueConversationMessage } from '@flue/sdk';

function userMessage(id: string, submissionId: string): FlueConversationMessage {
  return {
    id,
    submissionId,
    role: 'user',
    purpose: 'user',
    display: 'visible',
    metadata: { timestamp: '2026-07-12T10:00:00.000Z' },
    parts: [{ type: 'text', text: 'Create a weekly planning task', state: 'done' }],
  };
}

describe('mergeConvexMessages', () => {
  test('keeps the user and assistant when Flue gives both the same submission id', () => {
    const user = userMessage('message:user-1', 'submission-1');
    const assistant: FlueConversationMessage = {
      id: 'message:assistant-1',
      submissionId: 'submission-1',
      role: 'assistant',
      purpose: 'assistant',
      display: 'visible',
      metadata: { timestamp: '2026-07-12T10:00:01.000Z' },
      parts: [{ type: 'text', text: 'Absolutely.', state: 'done' }],
    };

    expect(mergeConvexMessages([], [user, assistant])).toEqual([user, assistant]);
  });

  test('does not persist a local echo until Flue admits the send', () => {
    const pending = userMessage('local:bee:user_1:1', '');

    expect(messagesForConvexSync([pending])).toEqual([]);

    const admitted = userMessage('local:bee:user_1:1', 'submission-1');
    expect(messagesForConvexSync([admitted])).toEqual([
      { ...admitted, id: 'submission:submission-1' },
    ]);
  });

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

  test('keeps repeated unadmitted text distinct from earlier canonical turns', () => {
    const first = userMessage('message:durable-1', 'submission-1');
    const repeated = userMessage('local:bee:user_1:2', '');

    expect(
      mergeConvexMessages(
        [{ id: first.id, contentJson: JSON.stringify(first), createdAt: 1 }],
        [repeated],
      ),
    ).toEqual([first, repeated]);
  });

  test('persists only a changed streaming tail after the initial snapshot', () => {
    const first = userMessage('message:user-1', 'submission-1');
    const partial: FlueConversationMessage = {
      id: 'message:assistant-1',
      role: 'assistant',
      purpose: 'assistant',
      display: 'visible',
      parts: [{ type: 'text', text: 'Work', state: 'streaming' }],
    };
    const initial = changedMessagesForConvexSync([first, partial], new Map());
    const known = new Map(initial.map((message) => [message.id, message.contentJson]));
    const complete: FlueConversationMessage = {
      ...partial,
      parts: [{ type: 'text', text: 'Working on it.', state: 'done' }],
    };

    expect(changedMessagesForConvexSync([first, partial], known)).toEqual([]);
    expect(changedMessagesForConvexSync([first, complete], known)).toEqual([
      expect.objectContaining({
        id: complete.id,
        contentJson: JSON.stringify(complete),
      }),
    ]);
  });

  test('renders each successive live assistant text snapshot over stale durability', () => {
    const stored: FlueConversationMessage = {
      id: 'message:assistant-stream',
      role: 'assistant',
      purpose: 'assistant',
      display: 'visible',
      parts: [{ type: 'text', text: 'Hel', state: 'streaming' }],
    };
    const row = {
      id: stored.id,
      contentJson: JSON.stringify(stored),
      createdAt: 1,
    };
    const first: FlueConversationMessage = {
      ...stored,
      parts: [{ type: 'text', text: 'Hello', state: 'streaming' }],
    };
    const second: FlueConversationMessage = {
      ...stored,
      parts: [{ type: 'text', text: 'Hello from Bee', state: 'streaming' }],
    };

    expect(mergeConvexMessages([row], [first])).toEqual([first]);
    expect(mergeConvexMessages([row], [second])).toEqual([second]);
  });

});
