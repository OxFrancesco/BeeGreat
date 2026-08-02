import { v } from 'convex/values'
import { getAddress, verifyMessage } from 'viem'
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from './_generated/server'
import type { Id } from './_generated/dataModel'
import { requireUserId } from './helpers'
import { requirePowerup } from './powerups'

// DB surface for Web3 wallets. Two kinds live in the `wallets` table:
//   - 'crossmint': cache of the Crossmint smart wallet (source of truth is
//     Crossmint; the Node actions in web3.ts create and use it). One per chain.
//   - 'eoa': the user's own externally-owned account, linked through
//     WalletConnect after a signed proof-of-control challenge. Stored under
//     chain 'evm' (EOA addresses are chain-agnostic across EVM networks).
//     WalletConnect session material remains on the user's device.
// Rows written before EOA support have no `kind`: treat missing as 'crossmint'.

/** Chain key for the linked EOA row (valid on every EVM network). */
export const EOA_CHAIN = 'evm'

/** Mainnet chains where BeeGreat can use the Crossmint smart wallet. */
const CROSSMINT_MAINNET_CHAINS = ['base', 'arbitrum'] as const

const EVM_ADDRESS = /^0x[0-9a-fA-F]{40}$/
const EVM_SIGNATURE = /^0x[0-9a-fA-F]{130}$/
const LINK_CHALLENGE_TTL_MS = 5 * 60 * 1000

function normalizedAddress(address: string) {
  const trimmed = address.trim()
  if (!EVM_ADDRESS.test(trimmed)) {
    throw new Error('Connect a valid EVM wallet and try again.')
  }
  return getAddress(trimmed.toLowerCase())
}

function walletLinkMessage(
  challengeId: Id<'walletLinkChallenges'>,
  address: string,
  expiresAt: number,
) {
  return [
    'BeeGreat wallet link',
    '',
    'Confirm that you control this wallet:',
    address,
    '',
    `Challenge: ${challengeId}`,
    `Expires: ${new Date(expiresAt).toISOString()}`,
    '',
    'This request does not send a transaction or cost gas.',
  ].join('\n')
}

/** App-facing: the signed-in user's wallets — smart wallet cache plus linked EOA. */
export const myWallets = query({
  args: {},
  returns: v.object({
    smartWallet: v.union(
      v.object({
        address: v.string(),
        chain: v.string(),
        supportedChains: v.array(v.string()),
      }),
      v.null(),
    ),
    eoa: v.union(
      v.object({ address: v.string(), linkedAt: v.number() }),
      v.null(),
    ),
  }),
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
      eoa: eoa
        ? { address: eoa.address, linkedAt: eoa.linkedAt ?? eoa._creationTime }
        : null,
    }
  },
})

/** App-facing: create a short-lived challenge for the connected EOA. */
export const beginEoaLink = mutation({
  args: { address: v.string() },
  returns: v.object({
    challengeId: v.id('walletLinkChallenges'),
    message: v.string(),
    expiresAt: v.number(),
  }),
  handler: async (ctx, { address }) => {
    const userId = await requireUserId(ctx)
    await requirePowerup(ctx, userId, 'web3')
    const normalized = normalizedAddress(address)
    const staleChallenges = await ctx.db
      .query('walletLinkChallenges')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .take(16)
    for (const challenge of staleChallenges) {
      await ctx.db.delete(challenge._id)
    }
    const expiresAt = Date.now() + LINK_CHALLENGE_TTL_MS
    const challengeId = await ctx.db.insert('walletLinkChallenges', {
      userId,
      address: normalized,
      expiresAt,
    })
    return {
      challengeId,
      message: walletLinkMessage(challengeId, normalized, expiresAt),
      expiresAt,
    }
  },
})

/** App-facing: verify the challenge signature, then link or replace the EOA. */
export const linkEoa = mutation({
  args: {
    challengeId: v.id('walletLinkChallenges'),
    signature: v.string(),
  },
  returns: v.object({ address: v.string() }),
  handler: async (ctx, { challengeId, signature }) => {
    const userId = await requireUserId(ctx)
    await requirePowerup(ctx, userId, 'web3')
    const challenge = await ctx.db.get(challengeId)
    if (!challenge || challenge.userId !== userId) {
      throw new Error('This wallet-link request is no longer available.')
    }
    if (challenge.expiresAt <= Date.now()) {
      await ctx.db.delete(challengeId)
      throw new Error('This wallet-link request expired. Try again.')
    }
    if (!EVM_SIGNATURE.test(signature)) {
      throw new Error('The wallet returned an invalid signature.')
    }
    const verified = await verifyMessage({
      address: challenge.address as `0x${string}`,
      message: walletLinkMessage(
        challenge._id,
        challenge.address,
        challenge.expiresAt,
      ),
      signature: signature as `0x${string}`,
    })
    if (!verified) {
      throw new Error('That signature does not match the connected wallet.')
    }
    const existing = await ctx.db
      .query('wallets')
      .withIndex('by_user', (q) =>
        q.eq('userId', userId).eq('chain', EOA_CHAIN),
      )
      .unique()
    const linkedAt = Date.now()
    if (existing) {
      await ctx.db.patch(existing._id, {
        address: challenge.address,
        kind: 'eoa',
        linkedAt,
      })
    } else {
      await ctx.db.insert('wallets', {
        userId,
        chain: EOA_CHAIN,
        address: challenge.address,
        kind: 'eoa',
        linkedAt,
      })
    }
    await ctx.db.delete(challengeId)
    return { address: challenge.address }
  },
})

/** App-facing: remove the linked EOA. */
export const unlinkEoa = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const userId = await requireUserId(ctx)
    const existing = await ctx.db
      .query('wallets')
      .withIndex('by_user', (q) =>
        q.eq('userId', userId).eq('chain', EOA_CHAIN),
      )
      .unique()
    if (existing) await ctx.db.delete(existing._id)
    return null
  },
})

export const getCachedWallet = internalQuery({
  args: { userId: v.string(), chain: v.string() },
  returns: v.union(
    v.object({
      _id: v.id('wallets'),
      _creationTime: v.number(),
      userId: v.string(),
      chain: v.string(),
      address: v.string(),
      kind: v.optional(v.union(v.literal('crossmint'), v.literal('eoa'))),
      linkedAt: v.optional(v.number()),
    }),
    v.null(),
  ),
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
  returns: v.object({
    smartWallet: v.union(
      v.object({ address: v.string(), chain: v.string() }),
      v.null(),
    ),
    eoa: v.union(v.object({ address: v.string() }), v.null()),
  }),
  handler: async (ctx, { userId }) => {
    const rows = await ctx.db
      .query('wallets')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .collect()
    const eoa = rows.find((row) => row.kind === 'eoa')
    const smart = rows.find((row) => (row.kind ?? 'crossmint') === 'crossmint')
    return {
      smartWallet: smart
        ? { address: smart.address, chain: smart.chain }
        : null,
      eoa: eoa ? { address: eoa.address } : null,
    }
  },
})

export const cacheWallet = internalMutation({
  args: { userId: v.string(), chain: v.string(), address: v.string() },
  returns: v.null(),
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
      await ctx.db.insert('wallets', {
        userId,
        chain,
        address,
        kind: 'crossmint',
      })
    }
    return null
  },
})
