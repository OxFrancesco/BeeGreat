import { expect, test } from 'bun:test';
import { TaskUpdates } from './task-updates';

test('locks a pending task synchronously while allowing other tasks', async () => {
  const updates = new TaskUpdates();
  let release!: () => void;
  let calls = 0;
  const first = updates.run('a', () => {
    calls++;
    return new Promise<void>((resolve) => {
      release = resolve;
    });
  });
  await updates.run('a', () => {
    calls++;
  });
  await updates.run('b', () => {
    calls++;
  });
  expect(calls).toBe(2);
  expect(updates.getSnapshot()).toEqual({ a: 'pending' });
  release();
  await first;
  expect(updates.getSnapshot()).toEqual({});
});

test('keeps failure visible and clears it only on a successful retry', async () => {
  const updates = new TaskUpdates();
  const observed: string[] = [];
  const unsubscribe = updates.subscribe(() =>
    observed.push(updates.getSnapshot().a ?? 'idle'),
  );
  await updates.run('a', () => {
    throw new Error('offline');
  });
  expect(updates.getSnapshot().a).toBe('failed');
  await updates.run('a', async () => {
    throw new Error('offline');
  });
  await updates.run('a', async () => {});
  expect(observed).toEqual([
    'pending',
    'failed',
    'pending',
    'failed',
    'pending',
    'idle',
  ]);
  unsubscribe();
});
