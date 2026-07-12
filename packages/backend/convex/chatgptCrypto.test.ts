// @vitest-environment node

import { afterEach, beforeEach, expect, test } from 'vitest'
import { decryptSecret, encryptSecret, hashAccountId } from './chatgptCrypto'

const originalEncryptionKey = process.env.CHATGPT_CREDENTIALS_KEY

beforeEach(() => {
  process.env.CHATGPT_CREDENTIALS_KEY = Buffer.alloc(32, 7).toString('base64')
})

afterEach(() => {
  if (originalEncryptionKey === undefined) {
    delete process.env.CHATGPT_CREDENTIALS_KEY
  } else {
    process.env.CHATGPT_CREDENTIALS_KEY = originalEncryptionKey
  }
})

test('credentials round-trip through AES-GCM without storing plaintext', () => {
  const encrypted = encryptSecret('access-token-fixture', 'user:user_fixture:access')

  expect(encrypted.ciphertext).not.toContain('access-token-fixture')
  expect(decryptSecret(encrypted, 'user:user_fixture:access')).toBe(
    'access-token-fixture',
  )
})

test('associated data binds ciphertext to its user and purpose', () => {
  const encrypted = encryptSecret('refresh-token-fixture', 'user:user_a:refresh')

  expect(() => decryptSecret(encrypted, 'user:user_b:refresh')).toThrow()
  expect(() => decryptSecret(encrypted, 'user:user_a:access')).toThrow()
})

test('account identifiers are stored only as stable hashes', () => {
  const hash = hashAccountId('account-fixture')

  expect(hash).toHaveLength(64)
  expect(hash).not.toContain('account-fixture')
})
