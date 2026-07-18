// @ts-expect-error Bun provides this runtime module without a workspace type package.
import { describe, expect, test } from 'bun:test';

import { normalizeBookmarkInputUrl } from './bookmark-url';

describe('bookmark URL input', () => {
  test('defaults bare domains and paths to HTTPS', () => {
    expect(normalizeBookmarkInputUrl('instagram.com')).toBe('https://instagram.com/');
    expect(normalizeBookmarkInputUrl('example.com/guides/bee')).toBe(
      'https://example.com/guides/bee',
    );
  });

  test('preserves web schemes and rejects unsafe or malformed input', () => {
    expect(normalizeBookmarkInputUrl('http://example.com')).toBe('http://example.com/');
    expect(normalizeBookmarkInputUrl('javascript:alert(1)')).toBeNull();
    expect(normalizeBookmarkInputUrl('not a domain')).toBeNull();
  });
});
