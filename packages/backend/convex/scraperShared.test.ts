import { describe, expect, test } from 'vitest'
import {
  BookmarkUrlError,
  buildSearchText,
  completeBookmarkUrl,
  detectBookmarkKind,
  normalizeBookmarkUrl,
  truncateContent,
} from './scraperShared'

describe('bookmark URL detection', () => {
  test.each([
    ['https://x.com/beegreat/status/12345?s=20', { kind: 'tweet', tweetId: '12345' }],
    ['https://twitter.com/bee/status/99', { kind: 'tweet', tweetId: '99' }],
    ['https://youtu.be/abc_123?si=tracking', { kind: 'youtube', videoId: 'abc_123' }],
    ['https://www.youtube.com/watch?v=watch-me', { kind: 'youtube', videoId: 'watch-me' }],
    ['https://youtube.com/shorts/short-one', { kind: 'youtube', videoId: 'short-one' }],
    ['https://youtube.com/live/live-one', { kind: 'youtube', videoId: 'live-one' }],
    ['youtu.be/bare-video', { kind: 'youtube', videoId: 'bare-video' }],
    ['instagram.com', { kind: 'website' }],
    ['https://example.com/article', { kind: 'website' }],
  ] as const)('detects %s', (url, expected) => {
    expect(detectBookmarkKind(url)).toEqual(expected)
  })

  test('rejects invalid and unsafe URLs', () => {
    expect(() => detectBookmarkKind('not a url')).toThrow(BookmarkUrlError)
    expect(() => detectBookmarkKind('javascript:alert(1)')).toThrow(
      'http or https',
    )
  })
})

test('normalizes canonical media URLs and removes tracking', () => {
  expect(completeBookmarkUrl('instagram.com')).toBe('https://instagram.com/')
  expect(completeBookmarkUrl('example.com/articles/bee')).toBe(
    'https://example.com/articles/bee',
  )
  expect(normalizeBookmarkUrl('instagram.com')).toBe('https://instagram.com/')
  expect(normalizeBookmarkUrl('https://twitter.com/bee/status/42?utm_source=x')).toBe(
    'https://x.com/i/status/42',
  )
  expect(normalizeBookmarkUrl('https://youtu.be/video42?si=secret')).toBe(
    'https://www.youtube.com/watch?v=video42',
  )
  expect(
    normalizeBookmarkUrl(
      'https://EXAMPLE.com:443/article?z=2&utm_source=hive&fbclid=nope&a=1#section',
    ),
  ).toBe('https://example.com/article?a=1&z=2')
})

test('truncates on UTF-8 character boundaries', () => {
  expect(truncateContent('a🐝b', 5)).toBe('a🐝')
  expect(truncateContent('🐝', 3)).toBe('')
  expect(buildSearchText({ title: 'Hive', labels: ['convex'], content: 'notes' })).toBe(
    'Hive\nconvex\nnotes',
  )
})
