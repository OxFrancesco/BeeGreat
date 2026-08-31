// @vitest-environment node

import * as Effect from 'effect/Effect'
import * as Result from 'effect/Result'
import { describe, expect, test, vi } from 'vitest'
import {
  ProviderChainFailure,
  ProviderFailure,
  providerAttempt,
  runScraperEffect,
  withProviderFallback,
} from './scraperEffect'

const NO_RETRY = {
  attemptTimeoutMs: 1_000,
  baseDelayMs: 0,
  maxRetries: 0,
} as const

describe('Effect scraper orchestration', () => {
  test('retains both provider failures when fallback is exhausted', async () => {
    const primary = providerAttempt({
      code: 'scrape-failed',
      policy: NO_RETRY,
      provider: 'twitter',
      stage: 'scrape',
      task: async () => {
        throw Object.assign(new Error('Twitter denied the request'), { status: 401 })
      },
    })
    const fallback = vi.fn(() =>
      providerAttempt({
        code: 'scrape-failed',
        policy: NO_RETRY,
        provider: 'firecrawl',
        stage: 'scrape',
        task: async () => {
          throw Object.assign(new Error('Firecrawl denied the request'), {
            status: 403,
          })
        },
      }),
    )

    const result = await Effect.runPromise(
      Effect.result(
        withProviderFallback({
          code: 'scrape-failed',
          primary,
          fallback,
        }),
      ),
    )

    expect(result._tag).toBe('Failure')
    if (Result.isSuccess(result)) throw new Error('Expected provider exhaustion')
    expect(result.failure).toBeInstanceOf(ProviderChainFailure)
    expect(result.failure).toMatchObject({
      primary: { provider: 'twitter', retryable: false },
      fallback: { provider: 'firecrawl', retryable: false },
    })
    expect(fallback).toHaveBeenCalledOnce()
  })

  test('skips fallback when the domain error is definitive', async () => {
    const fallback = vi.fn(() =>
      providerAttempt({
        code: 'scrape-failed',
        policy: NO_RETRY,
        provider: 'firecrawl',
        stage: 'scrape',
        task: async () => 'fallback',
      }),
    )
    const program = withProviderFallback({
      code: 'tweet-not-found',
      primary: Effect.fail(
        new ProviderFailure({
          cause: new Error('Tweet not found'),
          code: 'tweet-not-found',
          message: 'Tweet not found',
          provider: 'twitter',
          retryAfterMs: 0,
          retryable: false,
          stage: 'scrape',
        }),
      ),
      fallback,
      shouldFallback: (failure) => failure.code !== 'tweet-not-found',
    })

    await expect(runScraperEffect(program)).rejects.toMatchObject({
      _tag: 'ProviderFailure',
      code: 'tweet-not-found',
    })
    expect(fallback).not.toHaveBeenCalled()
  })
})
