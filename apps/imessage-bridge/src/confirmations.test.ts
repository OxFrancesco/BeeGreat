import { expect, test } from 'bun:test'
import type { Space } from 'spectrum-ts'
import { resolvePromptReply } from './confirmations'
import type { AgentTransport } from './agent-transport'
import { extractBeeResponse, projectWeb3Action } from './bee-response'
import { getDisplayedWeb3 } from './displayed-confirmations'
import { sendReply } from './reply'

test('mixed cards require successful display of the exact owned wallet details before yes', async () => {
  const raw = '```beeui\n' + JSON.stringify({ components: [
    { type: 'question', questions: [{ header: 'Continue', question: 'Continue?', options: [{ label: 'Yes' }, { label: 'No' }] }] },
    { type: 'first_focus', requestId: 'hidden', goalTitle: 'Goal', projectTitle: 'Project', taskTitle: 'Task' },
    { type: 'confirm', action: 'web3', summary: 'Model text', payload: { web3ActionId: 'action-1' } },
  ] }) + '\n```'
  const canonical = { id: 'action-1', summary: 'Send 10 USDC to 0x' + '12'.repeat(20), status: 'pending' as 'pending' | 'confirmed', autoConfirmed: false, kind: 'send_tokens' as const }
  const actions: unknown[] = []
  const transport = {
    clientFor: () => ({ history: async () => ({ messages: [{ role: 'assistant', parts: [{ type: 'text', text: raw }] }] }) }),
    web3ActionFor: async () => ({ ...canonical }),
    channelAction: async (_user: string, body: { action: string }) => { actions.push(body); canonical.status = 'confirmed'; return null },
  } as unknown as AgentTransport
  const userId = 'display-fixture'
  const context = { threadId: 71, activeHighlight: null }
  let failSend = false
  const space = { send: async () => { if (failSend) throw new Error('delivery failed') } } as unknown as Space
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
  expect(actions).toEqual([{ action: 'confirm_web3', actionId: 'action-1', summary: canonical.summary }])
  expect(getDisplayedWeb3(userId, context.threadId)).toBeNull()
})
