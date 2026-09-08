import { expect, test } from 'bun:test'
import { clearConnectionCallback, readConnectionCallback } from './connection-callback'

function storage() {
  const data = new Map<string, string>()
  return { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value) }, removeItem: (key: string) => { data.delete(key) } } as Storage
}
test('callback survives sign-in navigation and expires or clears after completion', () => {
  const tab = storage()
  const callback = readConnectionCallback('#kind=beennector&state=owner-state&code=provider-code', tab, 100)
  expect(readConnectionCallback('', tab, 200)).toEqual(callback)
  expect(readConnectionCallback('', storage(), 200)).toBeNull()
  expect(readConnectionCallback('', tab, 1_000_000)).toBeNull()
  readConnectionCallback('#kind=telegram&state=next', tab, 1_000_000)
  clearConnectionCallback(tab)
  expect(readConnectionCallback('', tab, 1_000_001)).toBeNull()
})
test('an invalid new callback cannot resume an older handoff', () => {
  const tab = storage()
  readConnectionCallback('#kind=telegram&state=old', tab)
  expect(readConnectionCallback('#kind=wrong&state=next', tab)).toBeNull()
  expect(readConnectionCallback('', tab)).toBeNull()
})
