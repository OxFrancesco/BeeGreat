// @ts-nocheck -- Bun test globals are intentionally outside the mobile bundle tsconfig.
import { expect, test } from 'bun:test';

import { journalShareText } from './journal-share';

test('journal sharing includes readable content without machine identifiers', () => {
  const text = journalShareText({
    localDate: '2026-07-19',
    title: 'A slow Sunday',
    body: 'Coffee outside before everyone woke up.',
    tags: ['small joy', 'home'],
  });

  expect(text).toContain('A slow Sunday');
  expect(text).toContain('Coffee outside');
  expect(text).toContain('#smalljoy #home');
  expect(text).not.toContain('entryId');
});
