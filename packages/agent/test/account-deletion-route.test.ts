import { describe, expect, test } from 'bun:test'
import app from '../src/app'

function deletionEnv(calls: string[]) {
  return {
    ELEVENLABS_API_KEY: 'unused',
    CLERK_JWT_ISSUER_DOMAIN: 'https://unused.clerk.accounts.dev',
    AGENT_CREDENTIAL_BROKER_SECRET: 'broker-secret',
    FLUE_BEE_AGENT: {
      getByName(name: string) {
        return {
          async deleteAccountData() {
            calls.push(name)
          },
        }
      },
    },
  }
}

function request(secret: string, body: unknown) {
  return new Request('https://agent.test/internal/account-deletion', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${secret}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  })
}

describe('private Flue account-deletion route', () => {
  test('rejects a mismatched broker secret without touching storage', async () => {
    const calls: string[] = []
    const response = await app.request(
      request('wrong-secret', {
        userId: 'user_owner',
        conversationIds: ['user_owner'],
      }),
      undefined,
      deletionEnv(calls),
    )

    expect(response.status).toBe(401)
    expect(calls).toEqual([])
  })

  test('clears each unique conversation Durable Object', async () => {
    const calls: string[] = []
    const response = await app.request(
      request('broker-secret', {
        userId: 'user_owner',
        conversationIds: ['user_owner', 'user_owner~7', 'user_owner~7'],
      }),
      undefined,
      deletionEnv(calls),
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ deleted: 2 })
    expect(calls).toEqual(['user_owner', 'user_owner~7'])
  })

  test('rejects conversation ids outside the deleted Clerk owner', async () => {
    const calls: string[] = []
    const response = await app.request(
      request('broker-secret', {
        userId: 'user_owner',
        conversationIds: ['user_different~7'],
      }),
      undefined,
      deletionEnv(calls),
    )

    expect(response.status).toBe(400)
    expect(calls).toEqual([])
  })
})
