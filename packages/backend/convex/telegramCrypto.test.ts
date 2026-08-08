// @vitest-environment node

import { afterEach, beforeEach, expect, test } from 'vitest'
import {
  decryptTelegramSecret,
  encryptTelegramSecret,
  hashTelegramValue,
} from './telegramCrypto'

const originalKey = process.env.TELEGRAM_CONNECTION_KEY

beforeEach(() => {
  process.env.TELEGRAM_CONNECTION_KEY = Buffer.alloc(32, 7).toString('base64')
})

afterEach(() => {
  if (originalKey === undefined) delete process.env.TELEGRAM_CONNECTION_KEY
  else process.env.TELEGRAM_CONNECTION_KEY = originalKey
})

test('encrypts pending OIDC secrets with authenticated context', () => {
  const secret = encryptTelegramSecret('pkce-verifier', 'user:state:verifier')

  expect(secret.ciphertext).not.toContain('pkce-verifier')
  expect(
    decryptTelegramSecret(secret, 'user:state:verifier'),
  ).toBe('pkce-verifier')
  expect(() => decryptTelegramSecret(secret, 'other-user:state:verifier')).toThrow()
})

test('hashes OAuth state deterministically without storing it raw', () => {
  const hash = hashTelegramValue('raw-oauth-state')

  expect(hash).toHaveLength(64)
  expect(hash).toBe(hashTelegramValue('raw-oauth-state'))
  expect(hash).not.toContain('raw-oauth-state')
})
