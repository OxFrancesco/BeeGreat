import { v } from 'convex/values'
import { internalMutation, internalQuery } from './_generated/server'

const addressPattern = /^0x[0-9a-fA-F]{40}$/

function normalizedKey(input: {
  chainId: number
  sugarContractAddress: string
  poolAddress: string
}) {
  if (!Number.isSafeInteger(input.chainId) || input.chainId <= 0) {
    throw new Error('chainId must be a positive safe integer')
  }
  if (!addressPattern.test(input.sugarContractAddress)) {
    throw new Error('sugarContractAddress must be an EVM address')
  }
  if (!addressPattern.test(input.poolAddress)) {
    throw new Error('poolAddress must be an EVM address')
  }
  return {
    chainId: input.chainId,
    sugarContractAddress: input.sugarContractAddress.toLowerCase(),
    poolAddress: input.poolAddress.toLowerCase(),
  }
}

const keyArgs = {
  chainId: v.number(),
  sugarContractAddress: v.string(),
  poolAddress: v.string(),
}

export const get = internalQuery({
  args: keyArgs,
  returns: v.union(v.null(), v.object({ offset: v.number() })),
  handler: async (ctx, input) => {
    const key = normalizedKey(input)
    const row = await ctx.db
      .query('sugarPoolLocators')
      .withIndex('by_chain_contract_pool', (query) =>
        query
          .eq('chainId', key.chainId)
          .eq('sugarContractAddress', key.sugarContractAddress)
          .eq('poolAddress', key.poolAddress),
      )
      .unique()
    return row ? { offset: row.offset } : null
  },
})

export const put = internalMutation({
  args: { ...keyArgs, offset: v.number() },
  returns: v.null(),
  handler: async (ctx, input) => {
    const key = normalizedKey(input)
    if (!Number.isSafeInteger(input.offset) || input.offset < 0) {
      throw new Error('offset must be a non-negative safe integer')
    }
    const existing = await ctx.db
      .query('sugarPoolLocators')
      .withIndex('by_chain_contract_pool', (query) =>
        query
          .eq('chainId', key.chainId)
          .eq('sugarContractAddress', key.sugarContractAddress)
          .eq('poolAddress', key.poolAddress),
      )
      .unique()
    const value = { ...key, offset: input.offset, updatedAt: Date.now() }
    if (existing) await ctx.db.patch(existing._id, value)
    else await ctx.db.insert('sugarPoolLocators', value)
    return null
  },
})

export const remove = internalMutation({
  args: keyArgs,
  returns: v.null(),
  handler: async (ctx, input) => {
    const key = normalizedKey(input)
    const existing = await ctx.db
      .query('sugarPoolLocators')
      .withIndex('by_chain_contract_pool', (query) =>
        query
          .eq('chainId', key.chainId)
          .eq('sugarContractAddress', key.sugarContractAddress)
          .eq('poolAddress', key.poolAddress),
      )
      .unique()
    if (existing) await ctx.db.delete(existing._id)
    return null
  },
})
