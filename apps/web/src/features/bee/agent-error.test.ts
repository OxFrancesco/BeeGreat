import { describe, expect, it } from 'vitest'

import {
  beeSendFailureMessage,
  friendlyBeeErrorMessage,
} from './agent-error'

const RECOVERY =
  'BeeGreat Pro is required. Subscribe or restore in the signed-in BeeGreat iOS app, then try again.'

describe('Bee agent subscription recovery', () => {
  it('turns a Flue 402 into the truthful iOS recovery path', () => {
    const error = Object.assign(new Error('Flue API error 402: request failed'), {
      status: 402,
      body: { code: 'SUBSCRIPTION_REQUIRED' },
    })

    expect(friendlyBeeErrorMessage(error)).toBe(RECOVERY)
    expect(beeSendFailureMessage(error)).toBe(RECOVERY)
  })

  it('keeps ordinary upstream failures as connection recovery', () => {
    const error = Object.assign(new Error('Flue API error 503: request failed'), {
      status: 503,
    })
    expect(friendlyBeeErrorMessage(error)).toBe(
      'Bee couldn’t reach the hive. Check your connection and try again.',
    )
    expect(beeSendFailureMessage(error)).toBe(
      'Your message wasn’t sent. Check your connection and try again.',
    )
  })
})
