import { describe, expect, test } from 'bun:test'

import { promptFailureReply } from './agent-error'

test('a subscription 402 tells the sender where to recover', () => {
  const error = Object.assign(new Error('Flue API error 402: request failed'), {
    status: 402,
    body: { code: 'SUBSCRIPTION_REQUIRED' },
  })
  expect(promptFailureReply(error)).toBe(
    'BeeGreat Pro is required. Subscribe or restore in the signed-in BeeGreat iOS app, then try again.',
  )
})

test('ordinary failures keep the retry guidance', () => {
  expect(
    promptFailureReply(
      Object.assign(new Error('Flue API error 503: request failed'), {
        status: 503,
      }),
    ),
  ).toBe('Something went wrong reaching Bee. Try again in a moment.')
})
