import { afterEach, expect, spyOn, test } from 'bun:test'
import { resolvePromptReply } from './confirmations'
import { createAgentTransport } from './agent-transport'
import type { Web3ActionProjection } from './bee-response'

afterEach(() => { fetchSpy?.mockRestore() })
let fetchSpy: ReturnType<typeof spyOn<typeof globalThis, 'fetch'>> | undefined
import { extractBeeResponse, projectWeb3Action } from './bee-response'
import { getDisplayedWeb3 } from './displayed-confirmations'
import { sendReply } from './reply'

test('mixed cards require successful display of the exact owned wallet details before yes', async () => {
  const raw = '```beeui\n' + JSON.stringify({ components: [
    { type: 'question', questions: [{ header: 'Continue', question: 'Continue?', options: [{ label: 'Yes' }, { label: 'No' }] }] },
    { type: 'first_focus', requestId: 'hidden', goalTitle: 'Goal', projectTitle: 'Project', taskTitle: 'Task' },
    { type: 'confirm', action: 'web3', summary: 'Model text', payload: { web3ActionId: 'action-1' } },
  ] }) + '\n```'
  const canonical: Web3ActionProjection & { id: string } = { id: 'action-1', summary: 'Send 10 USDC to 0x' + '12'.repeat(20), status: 'pending', autoConfirmed: false, kind: 'send_tokens' as const }
  const actions: string[] = []
  fetchSpy = spyOn(globalThis, 'fetch').mockImplementation(Object.assign(async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
    const url = new URL(String(input))
    if (url.pathname === '/agents/bee/display-fixture~71' && url.searchParams.get('view') === 'history') {
      return Response.json({ messages: [{ role: 'assistant', parts: [{ type: 'text', text: raw }] }] })
    }
    if (url.pathname === '/bridge/channel') {
      const serialized = String(init?.body)
      const body = JSON.parse(serialized)
      if (body.action === 'get_web3_action') return Response.json(canonical)
      actions.push(serialized)
      canonical.status = 'confirmed'
      return Response.json(null)
    }
    throw new Error(`Unexpected request: ${url.pathname}`)
  }, { preconnect: fetch.preconnect }))
  const transport = createAgentTransport({ agentUrl: 'https://bridge.test', bridgeSecret: 'fixture' })
  const userId = 'display-fixture'
  const context = { threadId: 71, activeHighlight: null }
  let failSend = false
  const space = { send: async () => { if (failSend) throw new Error('delivery failed') } }
  const resolve = () => resolvePromptReply({ transport, space, userId, context, prompt: 'yes', images: [] })
  const initial = await resolve()
  expect(actions).toEqual([])
  expect(initial.reply.markdown).toContain(canonical.summary)
  expect(projectWeb3Action(extractBeeResponse(raw), canonical).question).toBeUndefined()
  failSend = true
  await expect(sendReply(transport, space, initial.reply, userId, false, context.threadId)).rejects.toThrow('delivery failed')
  expect(getDisplayedWeb3(userId, context.threadId)).toBeNull()
  failSend = false
  await sendReply(transport, space, initial.reply, userId, false, context.threadId)
  canonical.summary = 'Send 10 USDC to 0x' + '34'.repeat(20)
  const changed = await resolve()
  expect(actions).toEqual([])
  await sendReply(transport, space, changed.reply, userId, false, context.threadId)
  await resolve()
  expect(actions.map(value => JSON.parse(value))).toEqual([{ action: 'confirm_web3', actionId: 'action-1', summary: canonical.summary }])
  expect(getDisplayedWeb3(userId, context.threadId)).toBeNull()
})
