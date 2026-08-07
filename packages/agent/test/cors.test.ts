import { describe, expect, test } from 'bun:test'
import app from '../src/app'

const allowedOrigin = 'https://app.beegreat.test'

function env() {
  return {
    ELEVENLABS_API_KEY: 'unused',
    CLERK_JWT_ISSUER_DOMAIN: 'https://unused.clerk.accounts.dev',
    WEB_ALLOWED_ORIGINS: allowedOrigin,
    FLUE_BEE_V2_AGENT: {
      getByName() {
        return { async deleteAccountData() {} }
      },
    },
  }
}

describe('browser Flue CORS', () => {
  test('answers authenticated-stream preflight before Clerk auth', async () => {
    const response = await app.request(
      new Request('https://agent.beegreat.test/agents/bee/user_owner', {
        method: 'OPTIONS',
        headers: {
          origin: allowedOrigin,
          'access-control-request-method': 'POST',
          'access-control-request-headers': 'authorization,content-type',
        },
      }),
      undefined,
      env(),
    )

    expect(response.status).toBe(204)
    expect(response.headers.get('access-control-allow-origin')).toBe(allowedOrigin)
    expect(response.headers.get('access-control-allow-headers')).toBe(
      'authorization,content-type',
    )
    expect(response.headers.get('access-control-allow-methods')).toContain('POST')
    expect(response.headers.get('access-control-expose-headers')).toBe(
      'Stream-Next-Offset,Stream-Up-To-Date,Location',
    )
  })

  test('rejects browser origins outside the deployment allowlist', async () => {
    const response = await app.request(
      new Request('https://agent.beegreat.test/health', {
        headers: { origin: 'https://attacker.example' },
      }),
      undefined,
      env(),
    )

    expect(response.status).toBe(403)
    expect(response.headers.has('access-control-allow-origin')).toBe(false)
    expect(response.headers.get('vary')).toBe('Origin')
  })

  test('adds stream headers to allowed non-preflight responses', async () => {
    const response = await app.request(
      new Request('https://agent.beegreat.test/health', {
        headers: { origin: allowedOrigin },
      }),
      undefined,
      env(),
    )

    expect(response.status).toBe(200)
    expect(response.headers.get('access-control-allow-origin')).toBe(allowedOrigin)
    expect(response.headers.get('access-control-expose-headers')).toContain(
      'Stream-Next-Offset',
    )
  })
})
