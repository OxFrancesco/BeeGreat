'use node'

import { CrossmintWallets, createCrossmint } from '@crossmint/wallets-sdk'
import {
  executeSugarActionJson,
  SUGAR_ACTIONS,
  type SugarAction,
} from '@beegreat/sugar'
import { v } from 'convex/values'
import { internal } from './_generated/api'
import { action, internalAction } from './_generated/server'
import type { ActionCtx } from './_generated/server'
import type { Doc } from './_generated/dataModel'

// Web3 power-up: per-user Web3 wallets via Crossmint.
//
// Every user gets one Crossmint smart wallet per chain, owned by their Clerk
// id (`userId:<clerk id>`) with a server admin signer: the SDK derives the
// signing key from CROSSMINT_SIGNER_SECRET locally, so the secret never
// leaves our backend and users hold no keys. Creation is idempotent — the
// same owner + secret always resolves to the same wallet. (Crossmint's
// api-key and MPC wallet flavors both need per-project support enablement,
// so the server signer is the one that works out of the box.)
//
// All entry points are gated on the `web3` power-up server-side, so a
// stale agent session that still has the tools loaded cannot act after the
// user switches the power-up off. DB cache lives in wallets.ts.
//
// Required env (bunx convex env set ...):
//   CROSSMINT_API_KEY       server key with wallets scopes
//   CROSSMINT_SIGNER_SECRET long random string; DO NOT rotate — it derives
//                           every wallet's admin signing key

// Keep in sync with DEFAULT_CHAIN in wallets.ts.
const WEB3_CHAIN = 'base-sepolia' as const

function requireEnv(name: 'CROSSMINT_API_KEY' | 'CROSSMINT_SIGNER_SECRET') {
  const value = process.env[name]
  if (!value) {
    throw new Error(
      `${name} is not configured. Set it with \`bunx convex env set ${name} ...\`.`,
    )
  }
  return value
}

async function requireWeb3(ctx: ActionCtx, userId: string) {
  const enabled = await ctx.runQuery(internal.powerups.checkEnabled, {
    userId,
    powerupId: 'web3',
  })
  if (!enabled) {
    throw new Error(
      'The Web3 power-up is not enabled. Turn it on from the profile screen first.',
    )
  }
}

/**
 * Idempotent get-or-create: Crossmint returns the existing wallet when one
 * already exists for this owner, and the server signer re-derives to the
 * same address every time.
 */
async function walletForUser(userId: string) {
  const crossmint = createCrossmint({
    apiKey: requireEnv('CROSSMINT_API_KEY'),
  })
  const wallets = CrossmintWallets.from(crossmint)
  const secret = requireEnv('CROSSMINT_SIGNER_SECRET')
  const wallet = await wallets.createWallet({
    chain: WEB3_CHAIN,
    owner: `userId:${userId}`,
    recovery: { type: 'server', secret },
  })
  await wallet.useSigner({ type: 'server', secret })
  return wallet
}

/** Get the user's wallet, creating it on first call. */
export const getOrCreateWallet = action({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    await requireWeb3(ctx, userId)

    const wallet = await walletForUser(userId)
    await ctx.runMutation(internal.wallets.cacheWallet, {
      userId,
      chain: WEB3_CHAIN,
      address: wallet.address,
    })
    return {
      address: wallet.address,
      chain: WEB3_CHAIN,
      owner: `userId:${userId}`,
    }
  },
})

/**
 * Balances for the user's wallet on the default chain: ETH, USDC, plus USDXM
 * (Crossmint's staging test stablecoin, minted by their faucet).
 */
export const getBalances = action({
  args: { userId: v.string() },
  handler: async (
    ctx,
    { userId },
  ): Promise<{
    address: string
    chain: string
    eth: string
    usdc: string
    otherTokens: Array<{ symbol: string; amount: string }>
  }> => {
    await requireWeb3(ctx, userId)

    const cached: Doc<'wallets'> | null = await ctx.runQuery(
      internal.wallets.getCachedWallet,
      {
        userId,
        chain: WEB3_CHAIN,
      },
    )
    if (!cached) {
      throw new Error(
        'No wallet yet — create one first with the create wallet tool.',
      )
    }

    const wallet = await walletForUser(userId)
    const balances = await wallet.balances(['usdxm'])
    return {
      address: wallet.address,
      chain: WEB3_CHAIN,
      eth: balances.nativeToken.amount,
      usdc: balances.usdc.amount,
      otherTokens: balances.tokens.map((token) => ({
        symbol: token.symbol,
        amount: token.amount,
      })),
    }
  },
})

/**
 * Send tokens from the user's wallet. The server admin signer approves the
 * transaction, so no client round-trip is needed.
 */
export const sendTokens = action({
  args: {
    userId: v.string(),
    recipient: v.string(),
    token: v.string(),
    amount: v.string(),
  },
  handler: async (ctx, { userId, recipient, token, amount }) => {
    await requireWeb3(ctx, userId)

    const cached: Doc<'wallets'> | null = await ctx.runQuery(
      internal.wallets.getCachedWallet,
      {
        userId,
        chain: WEB3_CHAIN,
      },
    )
    if (!cached) {
      throw new Error(
        'No wallet yet — create one first with the create wallet tool.',
      )
    }

    const wallet = await walletForUser(userId)
    const transaction = await wallet.send(
      recipient,
      token.toLowerCase(),
      amount,
    )
    return {
      hash: transaction.hash ?? null,
      explorerLink: transaction.explorerLink ?? null,
    }
  },
})

/**
 * Run one allowlisted Sugar action using the native TypeScript SDK. Transaction
 * actions only build unsigned JSON; this action never signs or broadcasts.
 */
export const runSugar = internalAction({
  args: {
    userId: v.string(),
    sugarAction: v.union(...SUGAR_ACTIONS.map((name) => v.literal(name))),
    parameters: v.record(
      v.string(),
      v.union(v.string(), v.number(), v.boolean()),
    ),
  },
  returns: v.string(),
  handler: async (ctx, { userId, sugarAction, parameters }) => {
    await requireWeb3(ctx, userId)

    // Convex app configuration is typed explicitly. Keep the portable SDK
    // from inspecting Node's ambient process.env inside this action.
    return executeSugarActionJson(sugarAction as SugarAction, parameters, {
      env: {},
    })
  },
})
