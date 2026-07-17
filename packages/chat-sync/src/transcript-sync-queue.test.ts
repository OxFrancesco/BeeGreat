import { describe, expect, test } from 'bun:test';
import type { FlueConversationMessage } from '@flue/sdk';

import { TranscriptSyncQueue } from './index';

function assistantMessage(id: string, text: string): FlueConversationMessage {
  return {
    id,
    role: 'assistant',
    parts: [{ type: 'text', text, state: 'streaming' }],
  };
}

describe('TranscriptSyncQueue', () => {
  test('survives a Strict Mode effect replay', async () => {
    const batches: string[][] = [];
    const queue = new TranscriptSyncQueue(
      (messages) => {
        batches.push(messages.map((message) => message.contentJson));
        return Promise.resolve();
      },
      () => undefined,
    );
    const partial = assistantMessage('assistant:strict-mode', 'Stream');

    queue.activate();
    queue.enqueue([partial]);
    queue.dispose();
    queue.activate();
    queue.enqueue([partial]);
    await new Promise((resolve) => setTimeout(resolve, 180));
    queue.dispose();

    expect(batches).toEqual([[JSON.stringify(partial)]]);
  });

  test('isolates a permanently rejected envelope from valid deltas', async () => {
    const persisted: string[] = [];
    const attempts: string[][] = [];
    const errors: unknown[] = [];
    const queue = new TranscriptSyncQueue(
      (messages) => {
        attempts.push(messages.map((message) => message.id));
        if (messages.some((message) => message.id === 'assistant:too-large')) {
          return Promise.reject({ data: { code: 'TOO_LARGE' } });
        }
        persisted.push(...messages.map((message) => message.id));
        return Promise.resolve();
      },
      (error) => errors.push(error),
    );
    const valid = assistantMessage('assistant:valid', 'Saved');
    const rejected = assistantMessage('assistant:too-large', 'Oversized');

    queue.activate();
    queue.enqueue([valid, rejected]);
    await new Promise((resolve) => setTimeout(resolve, 180));
    queue.enqueue([valid, rejected]);
    await new Promise((resolve) => setTimeout(resolve, 180));
    queue.dispose();

    expect(persisted).toEqual(['assistant:valid']);
    expect(attempts).toEqual([
      ['assistant:valid', 'assistant:too-large'],
      ['assistant:valid'],
      ['assistant:too-large'],
    ]);
    expect(errors).toHaveLength(1);
  });
});
