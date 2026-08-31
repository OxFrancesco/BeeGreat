// @vitest-environment node

import { expect, test } from 'vitest'
import { accountIdFromAccessToken } from './chatgptOpenAi'

function jwt(payload: Record<string, { chatgpt_account_id?: string }>) {
  return [
    Buffer.from('{}').toString('base64url'),
    Buffer.from(JSON.stringify(payload)).toString('base64url'),
    'signature',
  ].join('.')
}

test('extracts the ChatGPT account id from a Codex access token', () => {
  const token = jwt({
    'https://api.openai.com/auth': { chatgpt_account_id: 'account-fixture' },
  })

  expect(accountIdFromAccessToken(token)).toBe('account-fixture')
})

test('rejects malformed access tokens without throwing or exposing their value', () => {
  expect(accountIdFromAccessToken('not-a-jwt')).toBeNull()
  expect(accountIdFromAccessToken('a.invalid-json.c')).toBeNull()
})
