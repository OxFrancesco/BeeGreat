import { afterEach, describe, expect, test } from 'bun:test'
import { C as renderAgentFunctionWithStructure } from '../node_modules/@flue/runtime/dist/conversation-stream-store-CXwRWonS.mjs'
import { Bee, prepareBeeForRequest } from '../src/agents/bee.ts'

const originalFetch = globalThis.fetch
const originalEnv = {
  CONVEX_URL: process.env.CONVEX_URL,
  CONVEX_SITE_URL: process.env.CONVEX_SITE_URL,
  AGENT_CREDENTIAL_BROKER_SECRET: process.env.AGENT_CREDENTIAL_BROKER_SECRET,
}

afterEach(() => {
  globalThis.fetch = originalFetch
  for (const [name, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[name]
    else process.env[name] = value
  }
})

describe('Bee cold-start resources', () => {
  test('the first turn exposes an enabled Web3 specialist', async () => {
    globalThis.fetch = async (input, init) => {
      const url = String(input)
      const body = JSON.parse(String(init?.body ?? '{}')) as {
        operation?: string
        path?: string
      }

      if (url.endsWith('/api/query')) {
        expect(body.path).toBe('powerups:getEnabledIds')
        return Response.json({ status: 'success', value: ['web3'] })
      }
      if (url.endsWith('/internal/focus')) {
        expect(body.operation).toBe('get_context')
        return Response.json({
          timeZone: 'Europe/Rome',
          currentTime: Date.now(),
        })
      }
      if (url.endsWith('/internal/beennectors')) {
        expect(body.operation).toBe('list_connections')
        return Response.json([])
      }
      throw new Error(`Unexpected request: ${url}`)
    }

    const userId = 'user_coldWeb3'
    const env = {
      CONVEX_URL: 'https://test.convex.cloud',
      CONVEX_SITE_URL: 'https://test.convex.site',
      AGENT_CREDENTIAL_BROKER_SECRET: 'test-broker-secret',
    }
    Object.assign(process.env, env)
    await prepareBeeForRequest(userId, env)

    const rendered = renderAgentFunctionWithStructure(Bee, {
      snapshot: new Map(),
      store: undefined,
      delivery: { kind: 'user', body: 'Check my Aerodrome rewards' },
      instanceId: userId,
    })
    const agents = (rendered.config.subagents ?? []).map((agent) => agent.name)

    expect(agents).toContain('web3')
  })

  test('a transient entitlement failure preserves the last verified power-ups', async () => {
    let powerupLookupFails = false
    globalThis.fetch = async (input, init) => {
      const url = String(input)
      const body = JSON.parse(String(init?.body ?? '{}')) as {
        operation?: string
      }
      if (url.endsWith('/api/query')) {
        if (powerupLookupFails) throw new Error('Convex is briefly unavailable')
        return Response.json({ status: 'success', value: ['web3'] })
      }
      if (url.endsWith('/internal/focus')) {
        return Response.json({
          timeZone: 'Europe/Rome',
          currentTime: Date.now(),
        })
      }
      if (url.endsWith('/internal/beennectors')) return Response.json([])
      throw new Error(`Unexpected request: ${url}`)
    }

    const userId = 'user_lastKnownGoodPowerups'
    const env = {
      CONVEX_URL: 'https://test.convex.cloud',
      CONVEX_SITE_URL: 'https://test.convex.site',
      AGENT_CREDENTIAL_BROKER_SECRET: 'test-broker-secret',
    }
    Object.assign(process.env, env)
    await prepareBeeForRequest(userId, env)
    powerupLookupFails = true
    await prepareBeeForRequest(userId, env)

    const rendered = renderAgentFunctionWithStructure(Bee, {
      snapshot: new Map(),
      store: undefined,
      delivery: { kind: 'user', body: 'Check my Aerodrome rewards' },
      instanceId: userId,
    })
    expect(
      (rendered.config.subagents ?? []).map((agent) => agent.name),
    ).toContain('web3')
  })
})
