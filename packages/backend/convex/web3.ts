'use node'

import { CrossmintWallets, EVMWallet, createCrossmint } from '@crossmint/wallets-sdk'
import { executeSugarAction, executeSugarActionJson } from '@beegreat/sugar'
import {
  SUGAR_ACTIONS,
  SUGAR_TX_ACTIONS,
  type SugarAction,
} from '@beegreat/sugar/contracts'
import { v } from 'convex/values'
import { internal } from './_generated/api'
import { internalAction } from './_generated/server'
import type { ActionCtx } from './_generated/server'
import type { Doc } from './_generated/dataModel'

// Web3 power-up: per-user wallets via Crossmint plus Velodrome/Aerodrome DeFi
// through the native TypeScript Sugar SDK (packages/sugar).
//
// Every user gets one Crossmint smart wallet, owned by their Clerk id
// (`userId:<clerk id>`) with a server admin signer: the SDK derives the
// signing key from CROSSMINT_SIGNER_SECRET locally, so the secret never
// leaves our backend and users hold no keys. Creation is idempotent — the
// same owner + secret always resolves to the same wallet. The wallet chain
// follows the API key environment: production keys → Base mainnet, staging
// keys → Base Sepolia. Users can additionally link their own EOA (wallets.ts);
// Sugar plans built for the EOA are returned unsigned for external signing.
//
// Anything that MOVES funds goes through the two-phase confirmation gate in
// web3Actions.ts: the agent prepares a pending action, the signed-in app
// confirms it, and only then does `executeConfirmedAction` sign with the
// server signer. Every entry point is also gated on the `web3` power-up
// server-side, and all agent-facing functions are internal — they are only
// reachable through the authenticated HTTP bridge in http.ts.
//
// Required env (bunx convex env set ...):
//   CROSSMINT_API_KEY       server key with wallets scopes; sk_production_*
//                           selects Base mainnet, sk_staging_* Base Sepolia
//   CROSSMINT_SIGNER_SECRET long random string; DO NOT rotate — it derives
//                           every wallet's admin signing key

const BASE_MAINNET_CHAIN_ID = 8453

function requireEnv(name: 'CROSSMINT_API_KEY' | 'CROSSMINT_SIGNER_SECRET') {
  const value = process.env[name]
  if (!value) {
    throw new Error(
      `${name} is not configured. Set it with \`bunx convex env set ${name} ...\`.`,
    )
  }
  return value
}

/** Production Crossmint keys run mainnet; everything else stays on staging. */
function isProduction() {
  return requireEnv('CROSSMINT_API_KEY').startsWith('sk_production')
}

/** The smart-wallet chain, derived from the API key environment. */
function walletChain() {
  return isProduction() ? ('base' as const) : ('base-sepolia' as const)
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
    chain: walletChain(),
    owner: `userId:${userId}`,
    recovery: { type: 'server', secret },
  })
  await wallet.useSigner({ type: 'server', secret })
  return wallet
}

/** Resolve the smart wallet and refresh the DB cache in one step. */
async function cachedWalletForUser(ctx: ActionCtx, userId: string) {
  const wallet = await walletForUser(userId)
  await ctx.runMutation(internal.wallets.cacheWallet, {
    userId,
    chain: walletChain(),
    address: wallet.address,
  })
  return wallet
}

/** Get the user's smart wallet, creating it on first call. */
export const getOrCreateWallet = internalAction({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    await requireWeb3(ctx, userId)
    const wallet = await cachedWalletForUser(ctx, userId)
    return {
      address: wallet.address,
      chain: walletChain(),
      owner: `userId:${userId}`,
    }
  },
})

/**
 * Balances for the smart wallet: ETH and USDC always, plus USDXM (Crossmint's
 * staging test stablecoin) when running against staging. Resolves the wallet
 * idempotently, so it works even before an explicit create call.
 */
export const getBalances = internalAction({
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
    const wallet = await cachedWalletForUser(ctx, userId)
    const balances = await wallet.balances(isProduction() ? [] : ['usdxm'])
    return {
      address: wallet.address,
      chain: walletChain(),
      eth: balances.nativeToken.amount,
      usdc: balances.usdc.amount,
      otherTokens: balances.tokens.map((token) => ({
        symbol: token.symbol,
        amount: token.amount,
      })),
    }
  },
})

/** Recent smart-wallet transaction history from Crossmint. */
export const getActivity = internalAction({
  args: { userId: v.string() },
  returns: v.string(),
  handler: async (ctx, { userId }) => {
    await requireWeb3(ctx, userId)
    const wallet = await cachedWalletForUser(ctx, userId)
    const activity = await wallet.transactions()
    return JSON.stringify(activity)
  },
})

/** Staging-only faucet: mint USDXM into the smart wallet for testing. */
export const fundWallet = internalAction({
  args: { userId: v.string(), amount: v.number() },
  handler: async (ctx, { userId, amount }) => {
    await requireWeb3(ctx, userId)
    if (isProduction()) {
      throw new Error('The test faucet is only available on staging.')
    }
    if (!Number.isFinite(amount) || amount <= 0 || amount > 100) {
      throw new Error('Faucet amount must be between 0 and 100 USDXM.')
    }
    const wallet = await cachedWalletForUser(ctx, userId)
    await wallet.stagingFund(amount)
    return { address: wallet.address, funded: `${amount} USDXM` }
  },
})

const EVM_ADDRESS = /^0x[0-9a-fA-F]{40}$/
const DECIMAL_AMOUNT = /^(?:\d+\.?\d*|\.\d+)$/

/**
 * Phase one of sending tokens: validate and store a pending action. Nothing
 * moves until the signed-in app confirms it (web3Actions.confirm).
 */
export const prepareSendTokens = internalAction({
  args: {
    userId: v.string(),
    recipient: v.string(),
    token: v.string(),
    amount: v.string(),
  },
  handler: async (ctx, { userId, recipient, token, amount }) => {
    await requireWeb3(ctx, userId)
    if (!EVM_ADDRESS.test(recipient.trim())) {
      throw new Error('Recipient must be a 0x wallet address.')
    }
    const normalizedToken = token.trim().toLowerCase()
    const allowedTokens = isProduction()
      ? ['eth', 'usdc']
      : ['eth', 'usdc', 'usdxm']
    if (!allowedTokens.includes(normalizedToken)) {
      throw new Error(`Token must be one of: ${allowedTokens.join(', ')}.`)
    }
    if (!DECIMAL_AMOUNT.test(amount.trim()) || Number(amount) <= 0) {
      throw new Error('Amount must be a positive decimal string.')
    }
    const wallet = await cachedWalletForUser(ctx, userId)
    const cleanRecipient = recipient.trim()
    const cleanAmount = amount.trim()
    const summary = `Send ${cleanAmount} ${normalizedToken.toUpperCase()} on ${walletChain()} to ${cleanRecipient}`
    const created: { id: string; expiresAt: number } = await ctx.runMutation(
      internal.web3Actions.create,
      {
        userId,
        summary,
        payload: {
          kind: 'send_tokens',
          recipient: cleanRecipient,
          token: normalizedToken,
          amount: cleanAmount,
        },
      },
    )
    return {
      actionId: created.id,
      expiresAt: created.expiresAt,
      summary,
      from: wallet.address,
      status: 'pending' as const,
      note: 'Nothing has moved. The user must confirm this action in the app before it executes.',
    }
  },
})

/** Compact human summary of the user-relevant Sugar parameters. */
function describeSugarExecution(
  sugarAction: string,
  parameters: Record<string, string | number | boolean>,
) {
  const interesting = [
    'from_token',
    'to_token',
    'amount',
    'amount0',
    'amount1',
    'pool',
    'position',
    'token0',
    'token1',
    'fraction',
  ]
  const details = interesting
    .filter((name) => parameters[name] !== undefined)
    .map((name) => `${name.replace(/_/g, ' ')} ${String(parameters[name])}`)
    .join(', ')
  const verb = sugarAction.replace(/_/g, ' ')
  return `Aerodrome ${verb} on Base from your Bee wallet${details ? `: ${details}` : ''}`
}

/**
 * Phase one of executing a Sugar plan with the smart wallet: build the plan
 * server-side from an allowlisted action (the agent never supplies raw
 * calldata), then store it as a pending action awaiting in-app confirmation.
 * Mainnet only — Aerodrome has no public testnet deployment.
 */
export const prepareSugarExecution = internalAction({
  args: {
    userId: v.string(),
    sugarAction: v.union(...SUGAR_TX_ACTIONS.map((name) => v.literal(name))),
    parameters: v.record(
      v.string(),
      v.union(v.string(), v.number(), v.boolean()),
    ),
  },
  handler: async (ctx, { userId, sugarAction, parameters }) => {
    await requireWeb3(ctx, userId)
    if (!isProduction()) {
      throw new Error(
        'Executing DeFi plans requires the mainnet wallet (production Crossmint key). On staging, build unsigned plans for the linked EOA instead.',
      )
    }
    const wallet = await cachedWalletForUser(ctx, userId)
    // Force the plan onto Base and the smart wallet regardless of what the
    // agent passed: the smart wallet only exists on Base, and pinning the
    // wallet here means the confirmed plan always spends the user's own funds.
    const planParameters = {
      ...parameters,
      chain: BASE_MAINNET_CHAIN_ID,
      wallet: wallet.address,
    }
    const plan = await executeSugarAction(sugarAction, planParameters, {
      env: {},
    })
    const steps = (Array.isArray(plan) ? plan : [plan]).filter(
      (step): step is { to: string; data: string; value?: string } =>
        typeof step === 'object' &&
        step !== null &&
        typeof (step as { to?: unknown }).to === 'string' &&
        typeof (step as { data?: unknown }).data === 'string',
    )
    if (steps.length === 0) {
      throw new Error('Sugar returned no executable transactions for this request.')
    }
    const transactions = steps.map((step) => ({
      to: step.to,
      data: step.data,
      value: typeof step.value === 'string' ? step.value : '0',
    }))
    const summary = describeSugarExecution(sugarAction, parameters)
    const created: { id: string; expiresAt: number } = await ctx.runMutation(
      internal.web3Actions.create,
      {
        userId,
        summary,
        payload: {
          kind: 'execute_plan',
          chainId: BASE_MAINNET_CHAIN_ID,
          transactions,
        },
      },
    )
    return {
      actionId: created.id,
      expiresAt: created.expiresAt,
      summary,
      wallet: wallet.address,
      stepCount: transactions.length,
      status: 'pending' as const,
      note: 'Nothing has moved. The user must confirm this action in the app before it executes.',
    }
  },
})

/**
 * Phase two: runs only via web3Actions.confirm (signed-in app), never from
 * the agent. Signs with the Crossmint server signer and records the outcome.
 */
export const executeConfirmedAction = internalAction({
  args: { actionId: v.id('web3Actions') },
  handler: async (ctx, { actionId }) => {
    const action: Doc<'web3Actions'> | null = await ctx.runQuery(
      internal.web3Actions.get,
      { actionId },
    )
    if (!action || action.status !== 'confirmed') return null

    const results: Array<{ hash: string | null; explorerLink: string | null }> =
      []
    try {
      await requireWeb3(ctx, action.userId)
      const wallet = await walletForUser(action.userId)
      if (action.payload.kind === 'send_tokens') {
        const transaction = await wallet.send(
          action.payload.recipient,
          action.payload.token,
          action.payload.amount,
        )
        results.push({
          hash: transaction.hash ?? null,
          explorerLink: transaction.explorerLink ?? null,
        })
      } else {
        const evmWallet = EVMWallet.from(wallet)
        for (const step of action.payload.transactions) {
          const transaction = await evmWallet.sendTransaction({
            to: step.to,
            data: step.data as `0x${string}`,
            value: BigInt(step.value),
          })
          results.push({
            hash: transaction.hash ?? null,
            explorerLink: transaction.explorerLink ?? null,
          })
        }
      }
      await ctx.runMutation(internal.web3Actions.recordResult, {
        actionId,
        result: results,
      })
    } catch (error) {
      await ctx.runMutation(internal.web3Actions.recordResult, {
        actionId,
        result: results.length > 0 ? results : undefined,
        error: error instanceof Error ? error.message : 'Execution failed',
      })
    }
    return null
  },
})

/**
 * Run one allowlisted read-or-plan Sugar action using the native TypeScript
 * SDK. Transaction actions only build unsigned JSON; this never signs or
 * broadcasts. Execution goes through prepareSugarExecution + confirmation.
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
