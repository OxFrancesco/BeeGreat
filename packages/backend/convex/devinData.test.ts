import { convexTest } from 'convex-test'
import { makeFunctionReference } from 'convex/server'
import { expect, test } from 'vitest'
import schema from './schema'
import { modules } from './test.setup'

const upsert = makeFunctionReference<
  'mutation',
  {
    userId: string
    session: {
      sessionId: string
      url: string
      title?: string
      status: 'running'
      statusDetail?: string
      pullRequests: Array<{ url: string; state?: string }>
      createdAt: number
      updatedAt: number
    }
  }
>('devinData:upsert')

const getOwned = makeFunctionReference<
  'query',
  { userId: string; sessionId: string }
>('devinData:getOwned')

const get = makeFunctionReference<
  'query',
  { sessionId: string }
>('devinData:get')

test('Devin cache enforces BeeGreat session ownership', async () => {
  const t = convexTest(schema, modules)
  await t.mutation(upsert, {
    userId: 'user_owner',
    session: {
      sessionId: 'devin-owned',
      url: 'https://app.devin.ai/sessions/devin-owned',
      title: 'Owned session',
      status: 'running',
      statusDetail: 'working',
      pullRequests: [],
      createdAt: 1,
      updatedAt: 2,
    },
  })

  expect(
    await t.query(getOwned, {
      userId: 'user_owner',
      sessionId: 'devin-owned',
    }),
  ).toMatchObject({ userId: 'user_owner', sessionId: 'devin-owned' })
  expect(
    await t.query(getOwned, {
      userId: 'user_other',
      sessionId: 'devin-owned',
    }),
  ).toBeNull()
  expect(
    await t
      .withIdentity({
        subject: 'user_owner',
        tokenIdentifier: 'https://issuer.test|user_owner',
      })
      .query(get, { sessionId: 'devin-owned' }),
  ).toMatchObject({ userId: 'user_owner', sessionId: 'devin-owned' })
  expect(
    await t
      .withIdentity({
        subject: 'user_other',
        tokenIdentifier: 'https://issuer.test|user_other',
      })
      .query(get, { sessionId: 'devin-owned' }),
  ).toBeNull()
  await expect(
    t.mutation(upsert, {
      userId: 'user_other',
      session: {
        sessionId: 'devin-owned',
        url: 'https://app.devin.ai/sessions/devin-owned',
        status: 'running',
        pullRequests: [],
        createdAt: 1,
        updatedAt: 3,
      },
    }),
  ).rejects.toThrow('belongs to another BeeGreat user')
})
