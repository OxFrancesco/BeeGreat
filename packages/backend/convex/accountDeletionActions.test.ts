// @vitest-environment node

import { describe, expect, test } from 'vitest'
import { deleteFlueConversations } from './accountDeletionActions'

describe('deleteFlueConversations', () => {
  test('does not make an unauthenticated request when configuration is missing', async () => {
    let called = false
    const result = await deleteFlueConversations(
      undefined,
      undefined,
      'user_owner',
      ['user_owner'],
      async () => {
        called = true
        return Response.json({ deleted: 1 })
      },
    )

    expect(result).toEqual({
      status: 'unavailable',
      reason: 'configuration',
      retryable: false,
    })
    expect(called).toBe(false)
  })

  test('authenticates the private route with the exact conversation set', async () => {
    const result = await deleteFlueConversations(
      'https://agent.example.test/base',
      'broker-secret',
      'user_owner',
      ['user_owner', 'user_owner~7'],
      async (input, init) => {
        expect(String(input)).toBe(
          'https://agent.example.test/internal/account-deletion',
        )
        expect(init?.method).toBe('POST')
        expect(init?.headers).toEqual({
          authorization: 'Bearer broker-secret',
          'content-type': 'application/json',
        })
        expect(JSON.parse(String(init?.body))).toEqual({
          userId: 'user_owner',
          conversationIds: ['user_owner', 'user_owner~7'],
        })
        return Response.json({ deleted: 2 })
      },
    )

    expect(result).toEqual({ status: 'deleted' })
  })

  test('batches large conversation sets into idempotent Worker requests', async () => {
    const conversationIds = [
      'user_owner',
      ...Array.from({ length: 250 }, (_, index) => `user_owner~${index + 1}`),
    ]
    const batches: string[][] = []
    const result = await deleteFlueConversations(
      'https://agent.example.test',
      'broker-secret',
      'user_owner',
      conversationIds,
      async (_input, init) => {
        const body = JSON.parse(String(init?.body)) as {
          conversationIds: string[]
        }
        batches.push(body.conversationIds)
        return Response.json({ deleted: body.conversationIds.length })
      },
    )

    expect(result).toEqual({ status: 'deleted' })
    expect(batches.map((batch) => batch.length)).toEqual([200, 51])
    expect(batches.flat()).toEqual(conversationIds)
  })

  test('retries network and 5xx failures, but not permanent rejection', async () => {
    await expect(
      deleteFlueConversations(
        'https://agent.example.test',
        'broker-secret',
        'user_owner',
        ['user_owner'],
        async () => new Response(null, { status: 503 }),
      ),
    ).resolves.toEqual({
      status: 'unavailable',
      reason: 'upstream',
      retryable: true,
    })
    await expect(
      deleteFlueConversations(
        'https://agent.example.test',
        'broker-secret',
        'user_owner',
        ['user_owner'],
        async () => new Response(null, { status: 401 }),
      ),
    ).resolves.toEqual({
      status: 'unavailable',
      reason: 'upstream',
      retryable: false,
    })
    await expect(
      deleteFlueConversations(
        'https://agent.example.test',
        'broker-secret',
        'user_owner',
        ['user_owner'],
        async () => {
          throw new Error('offline')
        },
      ),
    ).resolves.toEqual({
      status: 'unavailable',
      reason: 'network',
      retryable: true,
    })
  })
})
