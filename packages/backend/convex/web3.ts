'use node'

import {
  SUGAR_ACTIONS,
  SUGAR_TX_ACTIONS,
} from '@beegreat/sugar/contracts'
import { v } from 'convex/values'
import { action, internalAction } from './_generated/server'
import {
  fundWalletForUser,
  getActivityForUser,
  getBalancesForUser,
  getOrCreateWalletForUser,
  prepareSendTokensForUser,
} from './web3lib/crossmintWallet'
import { executeConfirmedActionForId } from './web3lib/executeConfirmed'
import {
  pollSocketSwapStatusForId,
  prepareSocketSwapForUser,
  quoteSocketSwapPreview,
  reconcileSocketCrossmintActionForId,
} from './web3lib/socketOrchestration'
import {
  prepareEoaSugarExecutionForUser,
  prepareSugarExecutionForUser,
  reconcileCrossmintActionForId,
  refreshEoaSugarExecutionForUser,
  runSugarForUser,
} from './web3lib/sugarExecution'

// Web3 power-up: per-user wallets via Crossmint plus Velodrome/Aerodrome DeFi
// through the native TypeScript Sugar SDK (packages/sugar).
//
// Every user gets one Crossmint smart wallet, owned by their Clerk id
// (`userId:<clerk id>`) with a server admin signer: the SDK derives the
// signing key from CROSSMINT_SIGNER_SECRET locally, so the secret never
// leaves our backend and users hold no keys. Creation is idempotent — the
// same owner + secret resolves to the same EVM address. Production can resolve
// that wallet on Base and Arbitrum; staging uses Base Sepolia. Users can also
// link their own EOA (wallets.ts); allowlisted Sugar plans built for it are
// authorized in-app and signed by the connected wallet.
//
// Anything that MOVES funds goes through the two-phase confirmation gate in
// web3Actions.ts: the agent prepares a pending action, an authenticated client
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
//   SOCKET_API_KEY          production key for Socket's dedicated V3 API
//   SUGAR_RPC_URI_8453      production Base JSON-RPC URL used for Aerodrome
//                           reads and unsigned transaction preparation
//
// The handler bodies live in web3lib/ (plain TypeScript helpers, no Convex
// functions): crossmintWallet.ts for the smart-wallet lifecycle,
// sugarExecution.ts for Sugar SDK plans, socketOrchestration.ts for
// cross-chain swaps, and executeConfirmed.ts for confirmed-action execution.

/** Get the user's smart wallet, creating it on first call. */
export const getOrCreateWallet = internalAction({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => getOrCreateWalletForUser(ctx, userId),
})

/**
 * Balances for the smart wallet: ETH and USDC always, plus USDXM (Crossmint's
 * staging test stablecoin) when running against staging. Resolves the wallet
 * idempotently, so it works even before an explicit create call.
 */
export const getBalances = internalAction({
  args: {
    userId: v.string(),
    chain: v.optional(v.union(v.literal('base'), v.literal('arbitrum'))),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{
    address: string
    chain: string
    eth: string
    usdc: string
    otherTokens: Array<{ symbol: string; amount: string }>
  }> => getBalancesForUser(ctx, args),
})

/** Recent smart-wallet transaction history from Crossmint. */
export const getActivity = internalAction({
  args: { userId: v.string() },
  returns: v.string(),
  handler: async (ctx, { userId }) => getActivityForUser(ctx, userId),
})

/** Staging-only faucet: mint USDXM into the smart wallet for testing. */
export const fundWallet = internalAction({
  args: { userId: v.string(), amount: v.number() },
  handler: async (ctx, args) => fundWalletForUser(ctx, args),
})

const socketChainValidator = v.union(v.literal('base'), v.literal('arbitrum'))
const socketTokenValidator = v.union(v.literal('eth'), v.literal('usdc'))

/** Read-only preview. Preparing later always fetches a fresh executable quote. */
export const quoteSocketSwap = internalAction({
  args: {
    userId: v.string(),
    originChain: socketChainValidator,
    destinationChain: socketChainValidator,
    inputToken: socketTokenValidator,
    outputToken: socketTokenValidator,
    amount: v.string(),
  },
  returns: v.object({
    walletAddress: v.string(),
    originChain: socketChainValidator,
    destinationChain: socketChainValidator,
    inputToken: socketTokenValidator,
    outputToken: socketTokenValidator,
    inputAmount: v.string(),
    outputAmount: v.string(),
    minimumOutputAmount: v.string(),
    provider: v.string(),
    estimatedTimeSeconds: v.number(),
    expiresAt: v.number(),
    sourceGasSponsored: v.boolean(),
    destinationGas: v.string(),
  }),
  handler: async (ctx, args) => quoteSocketSwapPreview(ctx, args),
})

/** Create a fresh Socket route and place it behind the client confirmation gate. */
export const prepareSocketSwap = internalAction({
  args: {
    userId: v.string(),
    conversationId: v.optional(v.string()),
    continuation: v.optional(v.string()),
    originChain: socketChainValidator,
    destinationChain: socketChainValidator,
    inputToken: socketTokenValidator,
    outputToken: socketTokenValidator,
    amount: v.string(),
  },
  returns: v.object({
    actionId: v.id('web3Actions'),
    expiresAt: v.number(),
    summary: v.string(),
    walletAddress: v.string(),
    estimatedOutput: v.string(),
    minimumOutput: v.string(),
    estimatedTimeSeconds: v.number(),
    sourceGasSponsored: v.boolean(),
    status: v.union(v.literal('pending'), v.literal('confirmed')),
    autoConfirmed: v.boolean(),
    note: v.string(),
  }),
  handler: async (ctx, args) => prepareSocketSwapForUser(ctx, args),
})

/**
 * Phase one of sending tokens: validate and store a pending action. Nothing
 * moves until an authenticated client confirms it.
 */
export const prepareSendTokens = internalAction({
  args: {
    userId: v.string(),
    conversationId: v.optional(v.string()),
    continuation: v.optional(v.string()),
    recipient: v.string(),
    token: v.string(),
    amount: v.string(),
  },
  handler: async (ctx, args) => prepareSendTokensForUser(ctx, args),
})

/**
 * Phase one of executing a Sugar plan with the smart wallet: build the plan
 * server-side from an allowlisted action (the agent never supplies raw
 * calldata), then store it as a pending action awaiting client confirmation.
 * Mainnet only — Aerodrome has no public testnet deployment.
 */
export const prepareSugarExecution = internalAction({
  args: {
    userId: v.string(),
    jobRunId: v.optional(v.id('agentJobRuns')),
    conversationId: v.optional(v.string()),
    continuation: v.optional(v.string()),
    sugarAction: v.union(...SUGAR_TX_ACTIONS.map((name) => v.literal(name))),
    parameters: v.record(
      v.string(),
      v.union(v.string(), v.number(), v.boolean()),
    ),
  },
  handler: async (ctx, args) => prepareSugarExecutionForUser(ctx, args),
})

/**
 * Build an allowlisted Sugar transaction plan for the verified linked EOA.
 * The client-side WalletConnect provider is the only signer and broadcaster.
 */
export const prepareEoaSugarExecution = internalAction({
  args: {
    userId: v.string(),
    conversationId: v.optional(v.string()),
    continuation: v.optional(v.string()),
    chainId: v.number(),
    sugarAction: v.union(...SUGAR_TX_ACTIONS.map((name) => v.literal(name))),
    parameters: v.record(
      v.string(),
      v.union(v.string(), v.number(), v.boolean()),
    ),
  },
  handler: async (ctx, args) => prepareEoaSugarExecutionForUser(ctx, args),
})

/**
 * Authenticated EOA plan refresh. The app calls this after claiming the
 * confirmation and again after each mined approval, so it never signs stale
 * quote/deadline calldata.
 */
export const refreshEoaSugarExecution = action({
  args: { actionId: v.id('web3Actions') },
  returns: v.object({
    walletAddress: v.string(),
    chainId: v.number(),
    transactionSteps: v.array(
      v.object({
        role: v.union(v.literal('approval'), v.literal('action')),
        transaction: v.object({
          to: v.string(),
          data: v.string(),
          value: v.string(),
        }),
      }),
    ),
  }),
  handler: async (ctx, args) => refreshEoaSugarExecutionForUser(ctx, args),
})

/**
 * Smart-wallet phase two: runs only after user authorization — a signed-in app
 * tap, an exact action-bound iMessage decision, or the user's standing YOLO
 * opt-in applied at creation — never from the agent. EOA actions are rejected
 * here because only the connected client wallet may sign them.
 */
export const executeConfirmedAction = internalAction({
  args: { actionId: v.id('web3Actions') },
  handler: async (ctx, { actionId }) =>
    executeConfirmedActionForId(ctx, actionId),
})

/** Reconcile a prepared Crossmint operation after a timeout or worker restart. */
export const reconcileCrossmintAction = internalAction({
  args: { actionId: v.id('web3Actions') },
  returns: v.null(),
  handler: async (ctx, { actionId }) =>
    reconcileCrossmintActionForId(ctx, actionId),
})

/** Recover an origin-chain Socket batch after a worker timeout or restart. */
export const reconcileSocketCrossmintAction = internalAction({
  args: { actionId: v.id('web3Actions') },
  returns: v.null(),
  handler: async (ctx, { actionId }) =>
    reconcileSocketCrossmintActionForId(ctx, actionId),
})

/** Poll Socket until destination settlement reaches a terminal state. */
export const pollSocketSwapStatus = internalAction({
  args: { actionId: v.id('web3Actions') },
  returns: v.null(),
  handler: async (ctx, { actionId }) =>
    pollSocketSwapStatusForId(ctx, actionId),
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
  handler: async (ctx, args) => runSugarForUser(ctx, args),
})
