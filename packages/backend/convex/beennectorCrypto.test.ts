// @vitest-environment node

import { afterEach, beforeEach, expect, test } from 'vitest'
import {
  decryptBeennectorSecret,
  encryptBeennectorSecret,
  hashBeennectorValue,
} from './beennectorCrypto'

const originalKey = process.env.BEENNECTOR_CREDENTIALS_KEY

beforeEach(() => {
  process.env.BEENNECTOR_CREDENTIALS_KEY = Buffer.alloc(32, 17).toString(
    'base64',
  )
})

afterEach(() => {
  if (originalKey === undefined) delete process.env.BEENNECTOR_CREDENTIALS_KEY
  else process.env.BEENNECTOR_CREDENTIALS_KEY = originalKey
})

test('Beennector credentials are encrypted and bound to user, provider, and purpose', () => {
  const aad = 'beennector-credential:user_a:linear:refresh'
  const encrypted = encryptBeennectorSecret('linear-refresh-fixture', aad)

  expect(encrypted.ciphertext).not.toContain('linear-refresh-fixture')
  expect(decryptBeennectorSecret(encrypted, aad)).toBe(
    'linear-refresh-fixture',
  )
  expect(() =>
    decryptBeennectorSecret(
      encrypted,
      'beennector-credential:user_a:notion:refresh',
    ),
  ).toThrow()
})

test('Beennector OAuth state is represented by a stable one-way hash', () => {
  const state = 'private-beennector-state'
  const hash = hashBeennectorValue(state)
  expect(hash).toHaveLength(64)
  expect(hash).not.toContain(state)
  expect(hashBeennectorValue(state)).toBe(hash)
})

