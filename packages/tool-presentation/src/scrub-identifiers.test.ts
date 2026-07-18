import { describe, expect, test } from 'bun:test';

import { scrubIdentifiers } from './scrub-identifiers';

describe('scrubIdentifiers', () => {
  test('removes a labelled record id and its separator', () => {
    expect(
      scrubIdentifiers('Become wealthy · Active · ID: j970mfwm36h24y655hz3pcke3s8apxap'),
    ).toBe('Become wealthy · Active');
  });

  test('removes parenthesised ids', () => {
    expect(scrubIdentifiers('Created "Run a 10k" (id: k57d2apxm36h24y655hz3pcke3s8w9qb).')).toBe(
      'Created "Run a 10k".',
    );
  });

  test('removes bare Convex-style ids', () => {
    expect(scrubIdentifiers('Task j970mfwm36h24y655hz3pcke3s8apxap is done')).toBe(
      'Task is done',
    );
  });

  test('removes bare Devin session ids but keeps URLs intact', () => {
    expect(scrubIdentifiers('Session devin-abc123xyz is running')).toBe('Session is running');
    expect(
      scrubIdentifiers('Open https://app.devin.ai/sessions/devin-abc123xyz to follow along'),
    ).toBe('Open https://app.devin.ai/sessions/devin-abc123xyz to follow along');
  });

  test('leaves ordinary copy untouched', () => {
    expect(scrubIdentifiers('Become wealthy is now your third active goal.')).toBe(
      'Become wealthy is now your third active goal.',
    );
  });
});
