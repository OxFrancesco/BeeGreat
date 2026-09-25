import { afterEach, beforeEach, expect, spyOn, test } from 'bun:test'
import { createAgentTransport } from './agent-transport'
import { startTerminalDeliveryPolling } from './outbox'

let fetchSpy = spyOn(globalThis, 'fetch')
beforeEach(() => { fetchSpy = spyOn(globalThis, 'fetch') })
afterEach(() => fetchSpy.mockRestore())

test('non-financial fixture passes claim, rendering, send and acknowledgement without a real recipient', async () => {
  const actions: string[] = []
  const sent: unknown[] = []
  let claimed = false
  fetchSpy.mockImplementation(Object.assign(async (_url: Parameters<typeof fetch>[0], init?: RequestInit) => {
    const body = JSON.parse(String(init?.body))
    actions.push(body.action)
    expect(new Headers(init?.headers).get('x-bridge-secret')).toBe('test-only')
    if (body.action !== 'claim_delivery' || claimed) return Response.json(null)
    claimed = true
    return Response.json({
      deliveryId: 'fixture', leaseId: body.leaseId, address: 'outbox-fixture@example.test',
      action: { summary: 'Non-financial delivery fixture', kind: 'execute_plan', status: 'expired' },
    })
  }, { preconnect: fetch.preconnect }))
  const poller = startTerminalDeliveryPolling(
    createAgentTransport({ agentUrl: 'https://fixture.example.test', bridgeSecret: 'test-only' }),
    async address => {
      expect(address).toBe('outbox-fixture@example.test')
      return { send: async content => { sent.push(content) } }
    },
  )
  await poller.stop()
  expect(actions).toEqual(['claim_delivery', 'complete_delivery'])
  expect(sent).toHaveLength(1)
})

test('send failure releases the same lease through retry and never acknowledges completion', async () => {
  const actions: string[] = []
  let leaseId: string | undefined
  fetchSpy.mockImplementation(Object.assign(async (_url: Parameters<typeof fetch>[0], init?: RequestInit) => {
    const body = JSON.parse(String(init?.body))
    actions.push(body.action)
    if (body.action === 'claim_delivery') {
      leaseId = body.leaseId
      return Response.json({ deliveryId: 'fixture', leaseId, address: 'outbox-fixture@example.test',
        action: { summary: 'Non-financial fixture', kind: 'execute_plan', status: 'expired' } })
    }
    expect(body.leaseId).toBe(leaseId)
    expect(body.deliveryId).toBe('fixture')
    return Response.json({ ok: true })
  }, { preconnect: fetch.preconnect }))
  const poller = startTerminalDeliveryPolling(
    createAgentTransport({ agentUrl: 'https://fixture.example.test', bridgeSecret: 'test-only' }),
    async () => ({ send: async () => { throw new Error('fixture send failure') } }),
  )
  await poller.stop()
  expect(actions).toEqual(['claim_delivery', 'retry_delivery'])
})
