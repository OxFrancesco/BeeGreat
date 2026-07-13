import { describe, expect, test } from 'bun:test'
import {
  type SentryLikeBreadcrumb,
  type SentryLikeEvent,
  sanitizeSentryBreadcrumb,
  sanitizeDiagnosticText,
  sanitizeSentryEvent,
  sanitizeUrl,
  toError,
} from './sentry'

describe('Sentry privacy policy', () => {
  test('removes query strings and user identifiers from URLs', () => {
    expect(
      sanitizeUrl(
        'https://agent.example/agents/bee/user_3G4vf0sa5otJLbj0IXLY9nJBgvD~mobile?token=secret',
      ),
    ).toBe('https://agent.example/agents/bee/[user]')
  })

  test('keeps only diagnostic request metadata and a pseudonymous user id', () => {
    const event = sanitizeSentryEvent<SentryLikeEvent>({
      request: {
        url: 'https://example.test/failure?code=secret',
        headers: {
          authorization: 'Bearer secret',
          'content-type': 'application/json',
          cookie: 'session=secret',
          'x-request-id': 'req-1',
        },
        data: { prompt: 'private goal' },
        query_string: 'code=secret',
      },
      user: {
        id: 'user_123',
        email: 'person@example.com',
        ip_address: '127.0.0.1',
      },
    })

    expect(event.request).toEqual({
      url: 'https://example.test/failure',
      headers: {
        'content-type': 'application/json',
        'x-request-id': 'req-1',
      },
      cookies: undefined,
      data: undefined,
      env: undefined,
      query_string: undefined,
    })
    expect(event.user).toEqual({ id: 'user_123' })
  })

  test('redacts sensitive extras and console breadcrumbs', () => {
    expect(
      sanitizeSentryEvent<SentryLikeEvent>({
        extra: {
          operation: 'voice.transcribe',
          accessToken: 'secret',
          nested: { healthData: { steps: 1234 } },
        },
      }).extra,
    ).toEqual({
      operation: 'voice.transcribe',
      accessToken: '[Filtered]',
      nested: { healthData: '[Filtered]' },
    })
    expect(
      sanitizeSentryBreadcrumb<SentryLikeBreadcrumb>({
        category: 'console.error',
        message: 'private prompt',
        data: { arguments: ['private prompt'] },
      }),
    ).toEqual({
      category: 'console.error',
      message: 'Console output redacted',
      data: undefined,
    })
  })

  test('filters secrets and user content embedded in diagnostic messages', () => {
    expect(
      sanitizeDiagnosticText('Request failed at https://example.test/users/user_123?token=secret'),
    ).toBe('Sensitive diagnostic text filtered')
    expect(
      sanitizeSentryEvent<SentryLikeEvent>({
        message: 'Failed prompt: private goal',
        exception: {
          values: [{ type: 'ProviderError', value: 'response message: private goal' }],
        },
        logentry: {
          formatted: 'Authorization: Bearer private',
          params: ['private'],
        },
      }),
    ).toEqual({
      message: 'Sensitive diagnostic text filtered',
      exception: {
        values: [{ type: 'ProviderError', value: 'Sensitive diagnostic text filtered' }],
      },
      logentry: {
        formatted: 'Sensitive diagnostic text filtered',
        message: undefined,
        params: undefined,
      },
    })
  })

  test('normalizes non-Error throws', () => {
    expect(toError('boom').message).toBe('boom')
    expect(toError({ reason: 'boom' }).message).toBe('Unexpected failure')
  })
})
