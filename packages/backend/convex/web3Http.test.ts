import { convexTest } from 'convex-test'
import { afterEach, describe, expect, test } from 'vitest'

import schema from './schema'
import { modules } from './test.setup'

const originalBrokerSecret = process.env.AGENT_CREDENTIAL_BROKER_SECRET

afterEach(() => {
  if (originalBrokerSecret === undefined) {
    delete process.env.AGENT_CREDENTIAL_BROKER_SECRET
  } else {
    process.env.AGENT_CREDENTIAL_BROKER_SECRET = originalBrokerSecret
  }
})

describe('/internal/web3/wallet action origin', () => {
  test.each([
    'prepare_send',
    'prepare_socket_swap',
    'prepare_execution',
    'prepare_eoa_execution',
  ])('rejects %s when routed from another user conversation', async (op) => {
    process.env.AGENT_CREDENTIAL_BROKER_SECRET = 'test-broker-secret'
    const t = convexTest(schema, modules)

    const response = await t.fetch('/internal/web3/wallet', {
      method: 'POST',
      headers: {
        authorization: 'Bearer test-broker-secret',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        userId: 'user_Web3HttpOwner',
        conversationId: 'user_SomeoneElse~7',
        op,
        params: {
          recipient: '0x00000000000000000000000000000000000000aa',
          token: 'usdc',
          amount: '1',
          continuation: 'Continue with the remaining plan.',
        },
      }),
    })

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'Invalid Web3 action origin',
    })
  })
})
