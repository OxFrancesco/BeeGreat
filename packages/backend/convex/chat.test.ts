import { convexTest } from 'convex-test'
import { expect, test } from 'vitest'
import { api } from './_generated/api'
import schema from './schema'
import { modules } from './test.setup'

function authenticated(t: ReturnType<typeof convexTest>, subject: string) {
  return t.withIdentity({
    subject,
    tokenIdentifier: `https://issuer.example.test|${subject}`,
  })
}

test('threads, active selection, and transcripts sync per authenticated account', async () => {
  const t = convexTest(schema, modules)
  const owner = authenticated(t, 'user_chat_owner')
  const other = authenticated(t, 'user_chat_other')

  await expect(t.query(api.chat.listThreads, {})).rejects.toThrow(
    'Authentication required',
  )
  expect(await owner.query(api.chat.listThreads, {})).toEqual([
    { id: 0, createdAt: 0 },
  ])
  expect(await owner.query(api.chat.getActiveThread, {})).toBe(0)

  const threadId = await owner.mutation(api.chat.createThread, {})
  await owner.mutation(api.chat.setThreadTitle, {
    threadId,
    title: '  Shared conversation  ',
  })
  await owner.mutation(api.chat.syncMessages, {
    threadId,
    messages: [
      {
        id: 'message-user-1',
        role: 'user',
        contentJson: JSON.stringify({ id: 'message-user-1', role: 'user', parts: [] }),
        createdAt: 100,
      },
      {
        id: 'message-assistant-1',
        role: 'assistant',
        contentJson: JSON.stringify({ id: 'message-assistant-1', role: 'assistant', parts: [] }),
        createdAt: 200,
      },
    ],
  })

  expect(await owner.query(api.chat.getActiveThread, {})).toBe(threadId)
  expect(await owner.query(api.chat.listThreads, {})).toEqual([
    expect.objectContaining({ id: threadId, title: 'Shared conversation' }),
  ])
  expect(await owner.query(api.chat.listMessages, { threadId })).toEqual([
    expect.objectContaining({ id: 'message-user-1', role: 'user' }),
    expect.objectContaining({ id: 'message-assistant-1', role: 'assistant' }),
  ])

  expect(await other.query(api.chat.listThreads, {})).toEqual([
    { id: 0, createdAt: 0 },
  ])
  await expect(other.query(api.chat.listMessages, { threadId })).rejects.toThrow(
    'Conversation not found',
  )
})

test('message synchronization is idempotent and updates streaming envelopes', async () => {
  const t = convexTest(schema, modules)
  const owner = authenticated(t, 'user_chat_stream')
  const first = JSON.stringify({ id: 'assistant-stream', role: 'assistant', parts: [] })
  const complete = JSON.stringify({
    id: 'assistant-stream',
    role: 'assistant',
    parts: [{ type: 'text', text: 'Done', state: 'done' }],
  })

  await owner.mutation(api.chat.syncMessages, {
    threadId: 0,
    messages: [
      { id: 'assistant-stream', role: 'assistant', contentJson: first, createdAt: 100 },
    ],
  })
  await owner.mutation(api.chat.syncMessages, {
    threadId: 0,
    messages: [
      { id: 'assistant-stream', role: 'assistant', contentJson: complete, createdAt: 100 },
    ],
  })

  const messages = await owner.query(api.chat.listMessages, { threadId: 0 })
  expect(messages).toHaveLength(1)
  expect(messages[0].contentJson).toBe(complete)
})
