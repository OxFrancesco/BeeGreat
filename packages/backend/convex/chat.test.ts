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
  await expect(
    other.query(api.chat.listMessagesPage, {
      threadId,
      paginationOpts: { cursor: null, numItems: 20 },
    }),
  ).rejects.toThrow('Conversation not found')
})

test('message synchronization is idempotent and updates streaming envelopes', async () => {
  const t = convexTest(schema, modules)
  const owner = authenticated(t, 'user_chat_stream')
  const first = JSON.stringify({
    id: 'assistant-stream',
    role: 'assistant',
    parts: [{ type: 'text', text: 'Do', state: 'streaming' }],
  })
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

  const page = await owner.query(api.chat.listMessagesPage, {
    threadId: 0,
    paginationOpts: { cursor: null, numItems: 20 },
  })
  expect(page.page).toHaveLength(1)
  expect(page.page[0].contentJson).toBe(complete)
})

test('a stale streaming envelope cannot replace a completed assistant message', async () => {
  const t = convexTest(schema, modules)
  const owner = authenticated(t, 'user_chat_complete_monotonic')
  const complete = JSON.stringify({
    id: 'assistant-stream',
    role: 'assistant',
    purpose: 'assistant',
    display: 'visible',
    parts: [{ type: 'text', text: 'Finished answer', state: 'done' }],
    metadata: {
      timestamp: '2026-07-17T10:00:00.000Z',
      usage: { input: 10, output: 2, cacheRead: 0 },
    },
  })
  const stale = JSON.stringify({
    id: 'assistant-stream',
    role: 'assistant',
    purpose: 'assistant',
    display: 'visible',
    parts: [{ type: 'text', text: 'Finished', state: 'streaming' }],
    metadata: { timestamp: '2026-07-17T10:00:00.000Z' },
  })

  await owner.mutation(api.chat.syncMessages, {
    threadId: 0,
    messages: [
      { id: 'assistant-stream', role: 'assistant', contentJson: complete, createdAt: 100 },
    ],
  })
  await owner.mutation(api.chat.syncMessages, {
    threadId: 0,
    messages: [
      { id: 'assistant-stream', role: 'assistant', contentJson: stale, createdAt: 100 },
    ],
  })

  const messages = await owner.query(api.chat.listMessages, { threadId: 0 })
  expect(messages[0].contentJson).toBe(complete)
})

test('a shorter streaming envelope cannot replace newer assistant progress', async () => {
  const t = convexTest(schema, modules)
  const owner = authenticated(t, 'user_chat_partial_monotonic')
  const newer = JSON.stringify({
    id: 'assistant-stream',
    role: 'assistant',
    purpose: 'assistant',
    display: 'visible',
    parts: [{ type: 'text', text: 'Still streaming', state: 'streaming' }],
  })
  const older = JSON.stringify({
    id: 'assistant-stream',
    role: 'assistant',
    purpose: 'assistant',
    display: 'visible',
    parts: [{ type: 'text', text: 'Still', state: 'streaming' }],
  })

  await owner.mutation(api.chat.syncMessages, {
    threadId: 0,
    messages: [
      { id: 'assistant-stream', role: 'assistant', contentJson: newer, createdAt: 100 },
    ],
  })
  await owner.mutation(api.chat.syncMessages, {
    threadId: 0,
    messages: [
      { id: 'assistant-stream', role: 'assistant', contentJson: older, createdAt: 100 },
    ],
  })

  const messages = await owner.query(api.chat.listMessages, { threadId: 0 })
  expect(messages[0].contentJson).toBe(newer)
})

test('message pages traverse a transcript from newest to oldest without overlap', async () => {
  const t = convexTest(schema, modules)
  const owner = authenticated(t, 'user_chat_pages')

  await owner.mutation(api.chat.syncMessages, {
    threadId: 0,
    messages: [100, 200, 300, 400, 500].map((createdAt, index) => ({
      id: `message-${index + 1}`,
      role: index % 2 === 0 ? ('user' as const) : ('assistant' as const),
      contentJson: JSON.stringify({ id: `message-${index + 1}`, parts: [] }),
      createdAt,
    })),
  })

  const first = await owner.query(api.chat.listMessagesPage, {
    threadId: 0,
    paginationOpts: { cursor: null, numItems: 2 },
  })
  expect(first.page.map((message) => message.id)).toEqual(['message-5', 'message-4'])
  expect(first.isDone).toBe(false)

  const second = await owner.query(api.chat.listMessagesPage, {
    threadId: 0,
    paginationOpts: { cursor: first.continueCursor, numItems: 2 },
  })
  expect(second.page.map((message) => message.id)).toEqual(['message-3', 'message-2'])
  expect(second.isDone).toBe(false)

  const third = await owner.query(api.chat.listMessagesPage, {
    threadId: 0,
    paginationOpts: { cursor: second.continueCursor, numItems: 2 },
  })
  expect(third.page.map((message) => message.id)).toEqual(['message-1'])
  expect(third.isDone).toBe(true)
})

test('legacy transcript snapshots stay bounded to the newest 100 messages in chronological order', async () => {
  const t = convexTest(schema, modules)
  const owner = authenticated(t, 'user_chat_legacy_bound')

  await owner.mutation(api.chat.syncMessages, {
    threadId: 0,
    messages: Array.from({ length: 105 }, (_, index) => ({
      id: `message-${index + 1}`,
      role: 'user' as const,
      contentJson: JSON.stringify({ id: `message-${index + 1}`, parts: [] }),
      createdAt: index + 1,
    })),
  })

  const messages = await owner.query(api.chat.listMessages, { threadId: 0 })
  expect(messages).toHaveLength(100)
  expect(messages[0].id).toBe('message-6')
  expect(messages[99].id).toBe('message-105')
})

test('threads can be archived and unarchived per authenticated account', async () => {
  const t = convexTest(schema, modules)
  const owner = authenticated(t, 'user_chat_archive')
  const other = authenticated(t, 'user_chat_archive_other')

  const threadId = await owner.mutation(api.chat.createThread, {})
  await owner.mutation(api.chat.setThreadArchived, { threadId, archived: true })

  expect(await owner.query(api.chat.listThreads, {})).toEqual([
    expect.objectContaining({ id: threadId, archivedAt: expect.any(Number) }),
  ])

  await owner.mutation(api.chat.setThreadArchived, { threadId, archived: false })
  const [thread] = await owner.query(api.chat.listThreads, {})
  expect(thread.archivedAt).toBeUndefined()

  await expect(
    other.mutation(api.chat.setThreadArchived, { threadId, archived: true }),
  ).rejects.toThrow('Conversation not found')
})

test('archiving the implicit thread 0 materializes its row', async () => {
  const t = convexTest(schema, modules)
  const owner = authenticated(t, 'user_chat_archive_zero')

  await owner.mutation(api.chat.setThreadArchived, { threadId: 0, archived: true })
  expect(await owner.query(api.chat.listThreads, {})).toEqual([
    expect.objectContaining({ id: 0, archivedAt: expect.any(Number) }),
  ])
})

test('hidden messages stay tombstoned across later transcript syncs', async () => {
  const t = convexTest(schema, modules)
  const owner = authenticated(t, 'user_chat_hide')
  const other = authenticated(t, 'user_chat_hide_other')
  const assistant = JSON.stringify({
    id: 'assistant-1',
    role: 'assistant',
    parts: [{ type: 'text', text: 'First answer', state: 'done' }],
  })

  await owner.mutation(api.chat.syncMessages, {
    threadId: 0,
    messages: [
      {
        id: 'submission:user-1',
        role: 'user',
        contentJson: JSON.stringify({ id: 'submission:user-1', role: 'user', parts: [] }),
        createdAt: 100,
      },
      { id: 'assistant-1', role: 'assistant', contentJson: assistant, createdAt: 200 },
    ],
  })

  await owner.mutation(api.chat.hideMessages, {
    threadId: 0,
    messageIds: ['submission:user-1', 'assistant-1', 'missing-id'],
  })

  const hiddenView = await owner.query(api.chat.listMessages, { threadId: 0 })
  expect(hiddenView).toEqual([
    expect.objectContaining({ id: 'submission:user-1', hidden: true }),
    expect.objectContaining({ id: 'assistant-1', hidden: true }),
  ])

  // A later live sync of the same envelope must not resurrect the tombstone.
  await owner.mutation(api.chat.syncMessages, {
    threadId: 0,
    messages: [
      { id: 'assistant-1', role: 'assistant', contentJson: assistant, createdAt: 200 },
    ],
  })
  const resynced = await owner.query(api.chat.listMessagesPage, {
    threadId: 0,
    paginationOpts: { cursor: null, numItems: 20 },
  })
  expect(resynced.page).toEqual([
    expect.objectContaining({ id: 'assistant-1', hidden: true }),
    expect.objectContaining({ id: 'submission:user-1', hidden: true }),
  ])

  await expect(
    other.mutation(api.chat.hideMessages, {
      threadId: 0,
      messageIds: ['assistant-1'],
    }),
  ).resolves.toBeNull()
  const ownerView = await owner.query(api.chat.listMessages, { threadId: 0 })
  expect(ownerView).toHaveLength(2)
})

test('message pages cap caller-requested batches at 100 messages', async () => {
  const t = convexTest(schema, modules)
  const owner = authenticated(t, 'user_chat_page_bound')

  await owner.mutation(api.chat.syncMessages, {
    threadId: 0,
    messages: Array.from({ length: 105 }, (_, index) => ({
      id: `message-${index + 1}`,
      role: 'user' as const,
      contentJson: JSON.stringify({ id: `message-${index + 1}`, parts: [] }),
      createdAt: index + 1,
    })),
  })

  const page = await owner.query(api.chat.listMessagesPage, {
    threadId: 0,
    paginationOpts: { cursor: null, numItems: 500 },
  })
  expect(page.page).toHaveLength(100)
  expect(page.page[0].id).toBe('message-105')
  expect(page.page[99].id).toBe('message-6')
  expect(page.isDone).toBe(false)
})
