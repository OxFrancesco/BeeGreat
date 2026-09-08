import { describe, expect, test } from 'bun:test'
import { CodeTokenCache, codeTokenKey } from './code-token-cache'

describe('code result cache', () => {
  test('distinguishes equal-sized results with different middle content', () => {
    const prefix = 'a'.repeat(100)
    const suffix = 'z'.repeat(100)
    expect(codeTokenKey(`${prefix}100${suffix}`, 'json')).not.toBe(codeTokenKey(`${prefix}999${suffix}`, 'json'))
  })

  test('evicts least recently used results within a size budget', () => {
    const cache = new CodeTokenCache<string>(10, 2)
    cache.set('a', 'first', 4)
    cache.set('b', 'second', 4)
    expect(cache.get('a')).toBe('first')
    cache.set('c', 'third', 4)
    expect(cache.get('b')).toBeUndefined()
    expect(cache.get('a')).toBe('first')
    cache.set('huge', 'oversized', 11)
    expect(cache.get('huge')).toBeUndefined()
    expect(cache.get('c')).toBe('third')
  })
})
