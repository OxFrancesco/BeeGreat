// @vitest-environment node

import { generateKeyPairSync, verify as verifyBytes } from 'node:crypto'
import { describe, expect, test } from 'vitest'
import {
  AppleSignInRevocationError,
  createAppleClientSecret,
  fetchClerkAppleAccessTokens,
  revokeAppleAccessTokens,
  revokeClerkAppleTokensBeforeDeletion,
  type AppleSignInRevocationConfig,
} from './appleSignInRevocation'

const NOW = Date.parse('2026-07-17T12:00:00.000Z')
const { privateKey, publicKey } = generateKeyPairSync('ec', {
  namedCurve: 'P-256',
})
const appleConfig: AppleSignInRevocationConfig = {
  clientId: 'com.beegreat.app',
  teamId: 'TEAM123456',
  keyId: 'KEY1234567',
  privateKey: privateKey.export({ format: 'pem', type: 'pkcs8' }).toString(),
}

function decodePart(part: string) {
  return JSON.parse(Buffer.from(part, 'base64url').toString('utf8')) as Record<
    string,
    unknown
  >
}

describe('createAppleClientSecret', () => {
  test('creates a short-lived, verifiable ES256 client secret', () => {
    const { clientId, clientSecret } = createAppleClientSecret(appleConfig, NOW)
    const [headerPart, payloadPart, signaturePart] = clientSecret.split('.')
    expect(clientId).toBe('com.beegreat.app')
    expect(decodePart(headerPart!)).toEqual({
      alg: 'ES256',
      kid: 'KEY1234567',
    })
    expect(decodePart(payloadPart!)).toEqual({
      iss: 'TEAM123456',
      iat: Math.floor(NOW / 1_000),
      exp: Math.floor(NOW / 1_000) + 300,
      aud: 'https://appleid.apple.com',
      sub: 'com.beegreat.app',
    })
    expect(
      verifyBytes(
        'sha256',
        Buffer.from(`${headerPart}.${payloadPart}`),
        { key: publicKey, dsaEncoding: 'ieee-p1363' },
        Buffer.from(signaturePart!, 'base64url'),
      ),
    ).toBe(true)
  })

  test('rejects missing credentials and non-P-256 signing keys', () => {
    expect(() =>
      createAppleClientSecret({ ...appleConfig, keyId: undefined }, NOW),
    ).toThrow('APPLE_SIGN_IN_KEY_ID is not configured')

    const wrongCurve = generateKeyPairSync('ec', { namedCurve: 'secp384r1' })
    expect(() =>
      createAppleClientSecret(
        {
          ...appleConfig,
          privateKey: wrongCurve.privateKey
            .export({ format: 'pem', type: 'pkcs8' })
            .toString(),
        },
        NOW,
      ),
    ).toThrow('must be an Apple P-256 private key')
  })
})

describe('fetchClerkAppleAccessTokens', () => {
  test('uses only the server secret and returns the complete token set', async () => {
    await expect(
      fetchClerkAppleAccessTokens(
        'user/owner',
        'sk_live_fixture',
        async (input, init) => {
          expect(String(input)).toBe(
            'https://api.clerk.com/v1/users/user%2Fowner/oauth_access_tokens/oauth_apple?paginated=true',
          )
          expect(init?.method).toBe('GET')
          expect(init?.headers).toEqual({
            authorization: 'Bearer sk_live_fixture',
            accept: 'application/json',
            'Clerk-API-Version': '2025-11-10',
          })
          expect(init?.cache).toBe('no-store')
          expect(init?.redirect).toBe('error')
          expect(init?.signal).toBeInstanceOf(AbortSignal)
          return Response.json({
            data: [{ token: 'apple-token' }, { token: 'apple-token' }],
            total_count: 2,
          })
        },
      ),
    ).resolves.toEqual(['apple-token'])
  })

  test('accepts only an explicit empty response as no token', async () => {
    let called = false
    await expect(
      fetchClerkAppleAccessTokens('user_owner', undefined, async () => {
        called = true
        return Response.json({ data: [], total_count: 0 })
      }),
    ).rejects.toMatchObject({ reason: 'configuration', retryable: false })
    expect(called).toBe(false)

    await expect(
      fetchClerkAppleAccessTokens('user_owner', 'sk_live_fixture', async () =>
        Response.json({ data: [], total_count: 0 }),
      ),
    ).resolves.toEqual([])
  })

  test('never downgrades Clerk rejection or incomplete data to no token', async () => {
    const unauthorized = await fetchClerkAppleAccessTokens(
      'user_owner',
      'wrong-secret',
      async () => new Response(null, { status: 401 }),
    ).catch((error: unknown) => error)
    expect(unauthorized).toBeInstanceOf(AppleSignInRevocationError)
    expect(unauthorized).toMatchObject({
      reason: 'configuration',
      retryable: false,
    })

    const incomplete = await fetchClerkAppleAccessTokens(
      'user_owner',
      'sk_live_fixture',
      async () => Response.json({ data: [{ token: 'first' }], total_count: 2 }),
    ).catch((error: unknown) => error)
    expect(incomplete).toMatchObject({
      reason: 'invalid_response',
      retryable: false,
    })

    const malformed = await fetchClerkAppleAccessTokens(
      'user_owner',
      'sk_live_fixture',
      async () => new Response('not-json', { status: 200 }),
    ).catch((error: unknown) => error)
    expect(malformed).toMatchObject({
      reason: 'invalid_response',
      retryable: false,
    })
  })
})

describe('Apple deletion preflight', () => {
  test('does not require Apple signing credentials when Clerk has no token', async () => {
    await expect(
      revokeClerkAppleTokensBeforeDeletion(
        'user_owner',
        'sk_live_fixture',
        {
          clientId: undefined,
          teamId: undefined,
          keyId: undefined,
          privateKey: undefined,
        },
        NOW,
        async (input) => {
          expect(String(input)).toContain('api.clerk.com')
          return Response.json({ data: [], total_count: 0 })
        },
      ),
    ).resolves.toBe('no_token')
  })

  test('revokes Clerk tokens at Apple before reporting success', async () => {
    const requests: string[] = []
    await expect(
      revokeClerkAppleTokensBeforeDeletion(
        'user_owner',
        'sk_live_fixture',
        appleConfig,
        NOW,
        async (input, init) => {
          requests.push(String(input))
          if (String(input).includes('api.clerk.com')) {
            return Response.json({
              data: [{ token: 'apple/access token' }],
              total_count: 1,
            })
          }
          expect(String(input)).toBe('https://appleid.apple.com/auth/revoke')
          expect(init?.method).toBe('POST')
          expect(init?.headers).toEqual({
            'content-type': 'application/x-www-form-urlencoded',
            accept: 'application/json',
          })
          expect(init?.cache).toBe('no-store')
          expect(init?.redirect).toBe('error')
          const body = new URLSearchParams(String(init?.body))
          expect(body.get('client_id')).toBe('com.beegreat.app')
          expect(body.get('token')).toBe('apple/access token')
          expect(body.get('token_type_hint')).toBe('access_token')
          expect(body.get('client_secret')?.split('.')).toHaveLength(3)
          return new Response(null, { status: 200 })
        },
      ),
    ).resolves.toBe('revoked')
    expect(requests).toHaveLength(2)
  })

  test('fails closed on Apple configuration, transient, and network errors', async () => {
    const rejected = await revokeAppleAccessTokens(
      ['apple-token'],
      appleConfig,
      NOW,
      async () => new Response(null, { status: 400 }),
    ).catch((error: unknown) => error)
    expect(rejected).toMatchObject({
      reason: 'configuration',
      retryable: false,
    })

    const transient = await revokeAppleAccessTokens(
      ['apple-token'],
      appleConfig,
      NOW,
      async () => new Response(null, { status: 503 }),
    ).catch((error: unknown) => error)
    expect(transient).toMatchObject({ reason: 'upstream', retryable: true })

    const network = await revokeAppleAccessTokens(
      ['apple-token'],
      appleConfig,
      NOW,
      async () => {
        throw new Error('offline')
      },
    ).catch((error: unknown) => error)
    expect(network).toMatchObject({ reason: 'network', retryable: true })
  })
})
