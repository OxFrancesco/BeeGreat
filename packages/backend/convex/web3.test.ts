import { convexTest } from 'convex-test'
import { makeFunctionReference } from 'convex/server'
import { expect, test } from 'vitest'
import schema from './schema'
import { modules } from './test.setup'

const runSugar = makeFunctionReference<
  'action',
  {
    userId: string
    sugarAction: 'pools'
    parameters: Record<string, string | number | boolean>
  },
  string
>('web3:runSugar')

test('Sugar action loads in Convex and reaches the native TypeScript seam', async () => {
  const t = convexTest(schema, modules)
  await t.run(async (ctx) => {
    await ctx.db.insert('powerups', {
      userId: 'user_sugar_test',
      powerupId: 'web3',
      enabled: true,
    })
  })
  await expect(t.action(runSugar, {
    userId: 'user_sugar_test',
    sugarAction: 'pools',
    parameters: { chain: 999, limit: 1 },
  })).rejects.toThrow('chain must be one of')
})

test('Sugar action validators reject unknown action names', async () => {
  const t = convexTest(schema, modules)
  await expect(t.action(runSugar, {
    userId: 'user_sugar_test',
    sugarAction: 'not-an-action' as 'pools',
    parameters: { chain: 8453 },
  })).rejects.toThrow()
})
