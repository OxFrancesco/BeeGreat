// @vitest-environment node

import { afterEach, beforeEach, expect, test } from 'vitest'
import {
  decryptHealthSecret,
  encryptHealthSecret,
  hashHealthValue,
} from './googleHealthCrypto'

const originalKey = process.env.GOOGLE_HEALTH_CREDENTIALS_KEY

beforeEach(() => {
  process.env.GOOGLE_HEALTH_CREDENTIALS_KEY = Buffer.alloc(32, 11).toString(
    'base64',
  )
})

afterEach(() => {
  if (originalKey === undefined)
    delete process.env.GOOGLE_HEALTH_CREDENTIALS_KEY
  else process.env.GOOGLE_HEALTH_CREDENTIALS_KEY = originalKey
})

test('Google Health credentials are encrypted and bound to their user and purpose', () => {
  const encrypted = encryptHealthSecret(
    'refresh-token-fixture',
    'google-health:user_a:refresh',
  )

  expect(encrypted.ciphertext).not.toContain('refresh-token-fixture')
  expect(decryptHealthSecret(encrypted, 'google-health:user_a:refresh')).toBe(
    'refresh-token-fixture',
  )
  expect(() =>
    decryptHealthSecret(encrypted, 'google-health:user_b:refresh'),
  ).toThrow()
})

test('OAuth state is stored as a stable hash rather than plaintext', () => {
  const state = 'private-state-fixture'
  const hash = hashHealthValue(state)

  expect(hash).toHaveLength(64)
  expect(hash).not.toContain(state)
  expect(hashHealthValue(state)).toBe(hash)
})
