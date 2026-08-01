import { v } from 'convex/values'
import { internalMutation, internalQuery, mutation, query } from './_generated/server'
import { requireUserId } from './helpers'
import { requirePowerup } from './powerups'

// DB surface for Web3 wallets. Two kinds live in the `wallets` table:
//   - 'crossmint': cache of the Crossmint smart wallet (source of truth is
//     Crossmint; the Node actions in web3.ts create and use it). One per chain.
//   - 'eoa': the user's own externally-owned account, linked from the profile
//     screen. Stored under chain 'evm' (EOA addresses are chain-agnostic across
//     EVM networks). Sugar builds unsigned plans against this address; BeeGreat
//     never holds its keys and cannot spend from it.
// Rows written before EOA support have no `kind`: treat missing as 'crossmint'.

/** Chain key for the linked EOA row (valid on every EVM network). */
export const EOA_CHAIN = 'evm'

/** Mainnet chains where BeeGreat can use the Crossmint smart wallet. */
const CROSSMINT_MAINNET_CHAINS = ['base', 'arbitrum'] as const

const EVM_ADDRESS = /^0x[0-9a-fA-F]{40}$/

/** App-facing: the signed-in user's wallets — smart wallet cache plus linked EOA. */
export const myWallets = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx)
    const rows = await ctx.db
      .query('wallets')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .collect()
    const eoa = rows.find((row) => row.kind === 'eoa')
    const smartWallets = rows
      .filter((row) => (row.kind ?? 'crossmint') === 'crossmint')
      .map((row) => ({ address: row.address, chain: row.chain }))
    const smart = smartWallets[0]
    const cachedChains = smartWallets.map((wallet) => wallet.chain)
    const supportedChains = cachedChains.some((chain) =>
      chain.includes('sepolia'),
    )
      ? [...new Set(cachedChains)]
      : [...new Set([...CROSSMINT_MAINNET_CHAINS, ...cachedChains])]
    return {
      smartWallet: smart ? { ...smart, supportedChains } : null,
      eoa: eoa ? { address: eoa.address } : null,
    }
  },
})

/** App-facing: link (or replace) the user's own EOA address. */
export const linkEoa = mutation({
  args: { address: v.string() },
  handler: async (ctx, { address }) => {
    const userId = await requireUserId(ctx)
    await requirePowerup(ctx, userId, 'web3')
    const trimmed = address.trim()
    if (!EVM_ADDRESS.test(trimmed)) {
      throw new Error('Enter a valid 0x wallet address (40 hex characters).')
    }
    const existing = await ctx.db
      .query('wallets')
      .withIndex('by_user', (q) => q.eq('userId', userId).eq('chain', EOA_CHAIN))
      .unique()
    if (existing) {
      await ctx.db.patch(existing._id, { address: trimmed, kind: 'eoa' })
    } else {
      await ctx.db.insert('wallets', {
        userId,
        chain: EOA_CHAIN,
        address: trimmed,
        kind: 'eoa',
      })
    }
    return null
  },
})

/** App-facing: remove the linked EOA. */
export const unlinkEoa = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx)
    const existing = await ctx.db
      .query('wallets')
      .withIndex('by_user', (q) => q.eq('userId', userId).eq('chain', EOA_CHAIN))
      .unique()
    if (existing) await ctx.db.delete(existing._id)
    return null
  },
})

export const getCachedWallet = internalQuery({
  args: { userId: v.string(), chain: v.string() },
  handler: async (ctx, { userId, chain }) => {
    return await ctx.db
      .query('wallets')
      .withIndex('by_user', (q) => q.eq('userId', userId).eq('chain', chain))
      .unique()
  },
})

/** Both wallets for the agent bridge: smart wallet cache plus linked EOA. */
export const getWalletsForAgent = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    const rows = await ctx.db
      .query('wallets')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .collect()
    const eoa = rows.find((row) => row.kind === 'eoa')
    const smart = rows.find((row) => (row.kind ?? 'crossmint') === 'crossmint')
    return {
      smartWallet: smart ? { address: smart.address, chain: smart.chain } : null,
      eoa: eoa ? { address: eoa.address } : null,
    }
  },
})

export const cacheWallet = internalMutation({
  args: { userId: v.string(), chain: v.string(), address: v.string() },
  handler: async (ctx, { userId, chain, address }) => {
    const existing = await ctx.db
      .query('wallets')
      .withIndex('by_user', (q) => q.eq('userId', userId).eq('chain', chain))
      .unique()
    if (existing) {
      if (existing.address !== address || existing.kind !== 'crossmint') {
        await ctx.db.patch(existing._id, { address, kind: 'crossmint' })
      }
    } else {
      await ctx.db.insert('wallets', { userId, chain, address, kind: 'crossmint' })
    }
    return null
  },
})
