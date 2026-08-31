import { describe, expect, test } from 'bun:test'
import app from '../src/app'

function deletionEnv(calls: string[], deletedSiteKeys: string[] = []) {
  let listed = false
  return {
    ELEVENLABS_API_KEY: 'unused',
    CLERK_JWT_ISSUER_DOMAIN: 'https://unused.clerk.accounts.dev',
    AGENT_CREDENTIAL_BROKER_SECRET: 'broker-secret',
    FLUE_BEE_V2_AGENT: {
      getByName(name: string) {
        return {
          async deleteAccountData() {
            calls.push(name)
          },
        }
      },
    },
    BEE_SITES_BUCKET: {
      async list({ prefix }: { prefix: string }) {
        expect(prefix).toBe('users/user_owner/')
        if (listed) return { objects: [] }
        listed = true
        return {
          objects: [
            { key: `${prefix}sites/site_a/deployments/v1/index.html` },
            { key: `${prefix}sites/site_a/deployments/v1/site.css` },
          ],
        }
      },
      async delete(keys: string[]) {
        deletedSiteKeys.push(...keys)
      },
    },
  }
}

function request(
  secret: string,
  body: { userId?: string; conversationIds?: string[] },
) {
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
    const deletedSiteKeys: string[] = []
    const response = await app.request(
      request('broker-secret', {
        userId: 'user_owner',
        conversationIds: ['user_owner', 'user_owner~7', 'user_owner~7'],
      }),
      undefined,
      deletionEnv(calls, deletedSiteKeys),
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      deleted: 2,
      siteObjectsDeleted: 2,
    })
    expect(calls).toEqual(['user_owner', 'user_owner~7'])
    expect(deletedSiteKeys).toEqual([
      'users/user_owner/sites/site_a/deployments/v1/index.html',
      'users/user_owner/sites/site_a/deployments/v1/site.css',
    ])
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
