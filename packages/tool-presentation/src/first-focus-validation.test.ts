import { expect, test } from 'bun:test';
import { firstFocusPreviewSchema } from './beeui';

test('first-focus dates must fit JavaScript Date across every client', () => {
  const preview = { type: 'first_focus', requestId: 'preview-1', goalTitle: 'Goal', projectTitle: 'Project', taskTitle: 'Task' };
  for (const highlightExpiresAt of [1e20, -1e20, Infinity, NaN]) {
    expect(firstFocusPreviewSchema.safeParse({ ...preview, highlightExpiresAt }).success).toBe(false);
  }
  expect(firstFocusPreviewSchema.safeParse({ ...preview, highlightExpiresAt: Date.now() }).success).toBe(true);
  expect(firstFocusPreviewSchema.safeParse(preview).success).toBe(true);
});
