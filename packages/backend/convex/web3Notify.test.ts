import { convexTest } from 'convex-test'
import { afterEach, describe, expect, test, vi } from 'vitest'

import { internal } from './_generated/api'
import schema from './schema'
import { modules } from './test.setup'

const owner = 'user_web3_notify_owner'

const originalAgentUrl = process.env.AGENT_URL
const originalBrokerSecret = process.env.AGENT_CREDENTIAL_BROKER_SECRET

afterEach(() => {
  vi.unstubAllGlobals()
  if (originalAgentUrl === undefined) delete process.env.AGENT_URL
  else process.env.AGENT_URL = originalAgentUrl
  if (originalBrokerSecret === undefined) {
    delete process.env.AGENT_CREDENTIAL_BROKER_SECRET
  } else {
    process.env.AGENT_CREDENTIAL_BROKER_SECRET = originalBrokerSecret
  }
})

describe('web3Notify.activeConversation', () => {
  test('falls back to the bare userId when no preferences exist', async () => {
    const t = convexTest(schema, modules)
    expect(
      await t.query(internal.web3Notify.activeConversation, {
        userId: owner,
      }),
    ).toBe(owner)
  })

  test('maps thread 0 to the bare userId and later threads to userId~N', async () => {
    const t = convexTest(schema, modules)
    await t.run(async (ctx) => {
      await ctx.db.insert('chatPreferences', {
        ownerKey: `https://issuer.example.test|${owner}`,
        userId: owner,
        activeThreadId: 0,
        updatedAt: 10,
      })
    })
    expect(
      await t.query(internal.web3Notify.activeConversation, {
        userId: owner,
      }),
    ).toBe(owner)

    // The newest preferences row wins when several identities exist.
    await t.run(async (ctx) => {
      await ctx.db.insert('chatPreferences', {
        ownerKey: `https://other-issuer.example.test|${owner}`,
        userId: owner,
        activeThreadId: 3,
        updatedAt: 20,
      })
    })
    expect(
      await t.query(internal.web3Notify.activeConversation, {
        userId: owner,
      }),
    ).toBe(`${owner}~3`)
  })
})

describe('web3Notify.notifyActionSettled', () => {
  test('wakes the stored detached origin instead of the currently active app thread', async () => {
    process.env.AGENT_URL = 'https://agent.example.test'
    process.env.AGENT_CREDENTIAL_BROKER_SECRET = 'test-broker-secret'
    const fetchMock = vi.fn(
      async (_input: string | URL | Request, _init?: RequestInit) =>
        new Response(null, { status: 200 }),
    )
    vi.stubGlobal('fetch', fetchMock)
    const t = convexTest(schema, modules)

    await t.run(async (ctx) => {
      await ctx.db.insert('chatPreferences', {
        ownerKey: `https://issuer.example.test|${owner}`,
        userId: owner,
        activeThreadId: 3,
        updatedAt: 20,
      })
    })
    const created = await t.mutation(internal.web3Actions.create, {
      userId: owner,
      conversationId: `${owner}~42`,
      continuation: 'Swap the withdrawn USDC to ETH.',
      summary: 'Withdraw the full Aerodrome position',
      payload: {
        kind: 'send_tokens',
        recipient: '0x00000000000000000000000000000000000000aa',
        token: 'usdc',
        amount: '1',
      },
    })
    await t.run(async (ctx) => {
      await ctx.db.patch(created.id, { status: 'executed' })
    })

    await t.action(internal.web3Notify.notifyActionSettled, {
      actionId: created.id,
    })

    expect(fetchMock).toHaveBeenCalledOnce()
    const [url, init] = fetchMock.mock.calls[0]!
    expect(String(url)).toBe('https://agent.example.test/internal/web3-settled')
    const body = JSON.parse(String(init?.body)) as Record<string, unknown>
    expect(body).toMatchObject({
      conversationId: `${owner}~42`,
      continuation: 'Swap the withdrawn USDC to ETH.',
    })
    expect(body.conversationId).not.toBe(`${owner}~3`)
  })
})
