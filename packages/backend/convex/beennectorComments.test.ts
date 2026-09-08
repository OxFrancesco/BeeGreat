import { convexTest } from 'convex-test'
import { afterEach, expect, test, vi } from 'vitest'
import { api, internal } from './_generated/api'
import type { ActionCtx } from './_generated/server'
import type { Id } from './_generated/dataModel'
import schema from './schema'
import { modules } from './test.setup'

const encrypted = { version: 1 as const, iv: 'iv', ciphertext: 'encrypted', tag: 'tag' }
vi.mock('./beennectorAuthActions', () => ({ resolveBeennectorCredential: async () => ({ accessToken: 'provider-test-token', encryptedAccess: encrypted }) }))
import { executeApprovedCommentForId, prepareCommentForAgent } from './beennectorOperations'
function context(t: ReturnType<typeof convexTest>) { return { runMutation: t.mutation } as unknown as ActionCtx }
async function seed(t: ReturnType<typeof convexTest>, provider: 'github' | 'linear' = 'github') {
  const connectionId = await t.run(ctx => ctx.db.insert('beennectorCredentials', { userId: 'user_comment', provider, status: 'connected', scopes: [], externalAccountId: 'account-original', externalAccountName: 'Francesco', encryptedAccess: encrypted, updatedAt: Date.now() }))
  const proposal = await t.mutation(internal.beennectorComments.createPending, { userId: 'user_comment', provider, targetId: 'immutable-issue-id', targetLabel: 'Issue title', targetUrl: provider === 'github' ? 'https://github.com/example/repo/issues/1' : 'https://linear.app/team/issue/TEAM-1', body: '  Exact comment\nSecond line  ', expectedEncryptedAccess: encrypted })
  const actionId = new URL(proposal.reviewUrl).searchParams.get('comment') as Id<'beennectorCommentActions'>
  const owner = t.withIdentity({ subject: 'user_comment' })
  const review = (await owner.query(api.beennectorComments.status, { actionId }))!
  const approval = { actionId, expectedProvider: review.provider, expectedTargetId: review.targetId, expectedBody: review.body, expectedAccountId: review.externalAccountId, expectedTargetUrl: review.targetUrl }
  return { actionId, connectionId, owner, review, approval }
}
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers() })

test('a broker comment request only prepares a canonical proposal and ordinary reads remain available', async () => {
  const t = convexTest(schema, modules)
  await seed(t)
  const fetcher = vi.fn(async (url: string, _init?: RequestInit) => Response.json(url.includes('/comments') ? [] : { node_id: 'github-node', title: 'Target issue', html_url: 'https://github.com/example/repo/issues/2' }))
  vi.stubGlobal('fetch', fetcher)
  const proposal = await t.action(internal.beennectorOperations.execute, { userId: 'user_comment', provider: 'github', operation: 'comment', ref: 'example/repo#2', body: '  User message  ' })
  expect(proposal).toMatchObject({ state: 'pending' }); expect(fetcher.mock.calls.every(call => !call[1] || call[1].method !== 'POST')).toBe(true)
  const row = await t.run(ctx => ctx.db.query('beennectorCommentActions').order('desc').first())
  expect(row).toMatchObject({ targetId: 'github-node', body: 'User message', state: 'pending' })
  expect(await t.action(internal.beennectorOperations.execute, { userId: 'user_comment', provider: 'github', operation: 'get', ref: 'example/repo#2' })).toHaveProperty('issue')
  await expect(prepareCommentForAgent(context(t), { userId: 'user_comment', provider: 'notion', ref: 'page', body: 'x' })).rejects.toThrow('read-only')
})

test('only the signed-in owner can approve the exact stored body, destination and account', async () => {
  const t = convexTest(schema, modules); const { owner, approval, actionId } = await seed(t)
  await expect(t.mutation(api.beennectorComments.confirm, approval)).rejects.toThrow()
  await expect(t.withIdentity({ subject: 'user_stranger' }).mutation(api.beennectorComments.confirm, approval)).rejects.toThrow('unavailable')
  for (const changed of [{ expectedBody: 'Different' }, { expectedTargetId: 'other-id' }, { expectedAccountId: 'other-account' }, { expectedProvider: 'linear' as const }, { expectedTargetUrl: 'https://github.com/other/repo/issues/1' }]) await expect(owner.mutation(api.beennectorComments.confirm, { ...approval, ...changed })).rejects.toThrow('changed')
  await owner.mutation(api.beennectorComments.cancel, { actionId })
  await owner.mutation(api.beennectorComments.confirm, approval)
  expect(await t.mutation(internal.beennectorComments.claim, { actionId })).toBeNull()
})

for (const provider of ['github', 'linear'] as const) test(`${provider} posts the approved immutable destination once under duplicate confirmation/execution`, async () => {
  const t = convexTest(schema, modules); const { owner, approval, actionId } = await seed(t, provider)
  const fetcher = vi.fn(async (_url: string, init?: RequestInit) => {
    const request = JSON.parse(String(init?.body)); expect(request.variables.body).toBe('Exact comment\nSecond line')
    expect(request.variables[provider === 'github' ? 'subjectId' : 'issueId']).toBe('immutable-issue-id')
    return Response.json(provider === 'github' ? { data: { addComment: { commentEdge: { node: { url: 'https://github.com/example/repo/issues/1#issuecomment-7' } } } } } : { data: { commentCreate: { success: true, comment: { id: 'comment-id', url: 'https://linear.app/team/issue/TEAM-1#comment-7' } } } })
  }); vi.stubGlobal('fetch', fetcher)
  await Promise.all([owner.mutation(api.beennectorComments.confirm, approval), owner.mutation(api.beennectorComments.confirm, approval)])
  await Promise.all([executeApprovedCommentForId(context(t), actionId), executeApprovedCommentForId(context(t), actionId)])
  expect(fetcher).toHaveBeenCalledOnce(); expect(await owner.query(api.beennectorComments.status, { actionId })).toMatchObject({ state: 'posted' })
})

test('reconnecting to another account after review or after confirmation cannot post', async () => {
  const t = convexTest(schema, modules); const { owner, approval, actionId, connectionId } = await seed(t)
  const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher)
  await t.run(ctx => ctx.db.patch(connectionId, { externalAccountId: 'other-account' }))
  await expect(owner.mutation(api.beennectorComments.confirm, approval)).rejects.toThrow('account changed')
  await t.run(ctx => ctx.db.patch(connectionId, { externalAccountId: 'account-original' }))
  await owner.mutation(api.beennectorComments.confirm, approval)
  await t.run(ctx => ctx.db.delete(connectionId))
  await executeApprovedCommentForId(context(t), actionId)
  expect(fetcher).not.toHaveBeenCalled(); expect(await owner.query(api.beennectorComments.status, { actionId })).toMatchObject({ state: 'failed' })
})

test('lost provider response is unknown and never retried as another comment', async () => {
  const t = convexTest(schema, modules); const { owner, approval, actionId } = await seed(t)
  const fetcher = vi.fn(async () => { throw new Error('response lost after posting') }); vi.stubGlobal('fetch', fetcher)
  await owner.mutation(api.beennectorComments.confirm, approval)
  await executeApprovedCommentForId(context(t), actionId)
  await executeApprovedCommentForId(context(t), actionId)
  await owner.mutation(api.beennectorComments.confirm, approval)
  expect(fetcher).toHaveBeenCalledOnce(); expect(await owner.query(api.beennectorComments.status, { actionId })).toMatchObject({ state: 'unknown' })
})
