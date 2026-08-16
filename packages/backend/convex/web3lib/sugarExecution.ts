'use node'

// Sugar SDK execution for DeFi plans: shared client options and caches,
// human-readable plan summaries, plan preparation for the smart wallet and
// linked EOAs, plan refresh, read-only runs, and Crossmint reconciliation for
// smart-wallet plans. Plain TypeScript helpers only — the Convex function
// definitions live in web3.ts.

import { EVMWallet } from '@crossmint/wallets-sdk'
import {
  SugarClient,
  createSugarCacheStore,
  createSugarFailoverTransport,
  executeSugarAction,
  executeSugarActionJson,
  type SugarClientOptions,
  type SugarExecutionOptions,
  type SugarRpcObserver,
} from '@beegreat/sugar'
import {
  type SUGAR_ACTIONS,
  type SUGAR_TX_ACTIONS,
  type SugarAction,
} from '@beegreat/sugar/contracts'
import { internal } from '../_generated/api'
import { env } from '../_generated/server'
import type { ActionCtx } from '../_generated/server'
import type { Doc, Id } from '../_generated/dataModel'
import { SOCKET_CHAINS } from '../socketSwap'
import {
  normalizeSugarAgentParameters,
  sugarRuntimeEnvironment,
} from '../sugarRuntime'
import {
  assertSugarBounds,
  captureSugarBounds,
  reconcileCrossmintTransaction,
  sugarTransactionSteps,
  type SugarTransactionStep,
} from '../web3Execution'
import {
  BASE_MAINNET_CHAIN_ID,
  SUGAR_CHAIN_NAMES,
  isProduction,
  preparedNote,
  requireWeb3,
} from './shared'
import { cachedWalletForUser, walletForUser } from './crossmintWallet'

export function sugarEnvironment() {
  return sugarRuntimeEnvironment(env)
}

// Module-level so warm Node action invocations reuse the token and pool
// topology scans instead of re-reading every Aerodrome pool per request.
// Swap amounts always come from live quoter calls, so the TTL only delays
// seeing newly created pools or tokens.
const sugarCacheStore = createSugarCacheStore({ ttlMs: 5 * 60_000 })

// Provider throughput caps (Alchemy compute units per second) throttle in
// windows of tens of seconds; the default ~1s of exponential backoff gives
// up before the window resets, so retry longer within the same deadline.
const SUGAR_RPC_POLICY = { baseDelayMs: 500, maxRetries: 5 }

// Deliberately low-cardinality: the SDK never includes RPC URLs, addresses,
// parameters, or calldata in these events, so production logs can expose the
// slow phase without leaking wallet activity.
const reportSugarRpcEvent: SugarRpcObserver = (event) => {
  console.info('Sugar RPC', event)
}

export function sugarOptions(ctx: ActionCtx): SugarExecutionOptions {
  const environment = sugarEnvironment()
  const baseRpcUrl = environment.SUGAR_RPC_URI_8453
  return {
    cacheStore: sugarCacheStore,
    env: environment,
    onRpcEvent: reportSugarRpcEvent,
    poolLocatorStore: {
      get: async (key) => {
        const locator = await ctx.runQuery(internal.sugarPoolLocators.get, key)
        return locator ?? undefined
      },
      set: async (key, locator) => {
        await ctx.runMutation(internal.sugarPoolLocators.put, {
          ...key,
          offset: locator.offset,
        })
      },
      delete: async (key) => {
        await ctx.runMutation(internal.sugarPoolLocators.remove, key)
      },
    },
    rpcPolicy: SUGAR_RPC_POLICY,
    ...(baseRpcUrl
      ? {
          clientFactory: (chainId: number, options: SugarClientOptions) =>
            new SugarClient(
              chainId,
              chainId === BASE_MAINNET_CHAIN_ID
                ? {
                    ...options,
                    // Execution reads stay pinned to the authenticated RPC.
                    // A lagging anonymous fallback can report state older than
                    // a just-confirmed approval and produce false reverts.
                    transport: createSugarFailoverTransport([baseRpcUrl], {
                      minIntervalMs: 250,
                      onRpcEvent: reportSugarRpcEvent,
                    }),
                    settings: {
                      ...options.settings,
                      requestConcurrency: Math.min(
                        options.settings?.requestConcurrency ?? 2,
                        2,
                      ),
                    },
                  }
                : options,
            ),
        }
      : {}),
  }
}

/** Compact human summary of the user-relevant Sugar parameters. */
export function describeSugarExecution(
  sugarAction: string,
  parameters: Record<string, string | number | boolean>,
  options: { chainName?: string; walletLabel?: string } = {},
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
  const chainName = options.chainName ?? 'Base'
  const walletLabel = options.walletLabel ?? 'your Bee wallet'
  return `Aerodrome ${verb} on ${chainName} from ${walletLabel}${details ? `: ${details}` : ''}`
}

export function executableSugarTransactions(plan: unknown) {
  return sugarTransactionSteps(plan).map(({ transaction }) => transaction)
}

/**
 * Human suffix built from the plan's quote context so the confirm card shows
 * the expected outcome (not just the requested inputs) before the user signs.
 */
export function describeSugarPlanOutcome(plan: unknown): string {
  if (typeof plan !== 'object' || plan === null || Array.isArray(plan)) {
    return ''
  }
  const record = plan as Record<string, unknown>
  const decimal = (value: unknown) =>
    typeof value === 'number' && Number.isFinite(value)
      ? value.toLocaleString('en-US', { maximumFractionDigits: 6 })
      : null
  const symbolOf = (value: unknown) => {
    const symbol =
      typeof value === 'object' && value !== null
        ? (value as { symbol?: unknown }).symbol
        : undefined
    return typeof symbol === 'string' ? symbol : null
  }
  const quote = record.quote
  if (typeof quote === 'object' && quote !== null) {
    const q = quote as Record<string, unknown>
    const out = decimal(q.amount_out_decimal)
    const toSymbol = symbolOf(q.to_token)
    if (out && toSymbol) {
      const min = decimal(q.min_amount_out_decimal)
      const impact =
        typeof q.price_impact_pct === 'number' &&
        Number.isFinite(q.price_impact_pct)
          ? `${q.price_impact_pct.toFixed(2)}% impact`
          : null
      const extras = [min ? `min ${min}` : null, impact]
        .filter(Boolean)
        .join(', ')
      return ` → ≈${out} ${toSymbol}${extras ? ` (${extras})` : ''}`
    }
  }
  const movement = record.deposit ?? record.withdrawal
  if (typeof movement === 'object' && movement !== null) {
    const m = movement as Record<string, unknown>
    const pool =
      typeof m.pool === 'object' && m.pool !== null
        ? (m.pool as Record<string, unknown>)
        : {}
    const amount0 = decimal(m.amount0_decimal)
    const amount1 = decimal(m.amount1_decimal)
    const token0 = typeof pool.token0 === 'string' ? pool.token0 : null
    const token1 = typeof pool.token1 === 'string' ? pool.token1 : null
    const poolSymbol = typeof pool.symbol === 'string' ? pool.symbol : null
    const parts = [
      amount0 && token0 ? `${amount0} ${token0}` : null,
      amount1 && token1 ? `${amount1} ${token1}` : null,
    ].filter(Boolean)
    if (parts.length > 0) {
      const direction = record.deposit ? 'into' : 'out of'
      return ` → ≈${parts.join(' + ')}${poolSymbol ? ` ${direction} ${poolSymbol}` : ''}`
    }
  }
  return ''
}

export type SugarTxAction = (typeof SUGAR_TX_ACTIONS)[number]
export type SugarAnyAction = (typeof SUGAR_ACTIONS)[number]

export async function prepareSugarExecutionForUser(
  ctx: ActionCtx,
  {
    userId,
    jobRunId,
    conversationId,
    continuation,
    sugarAction,
    parameters,
  }: {
    userId: string
    jobRunId?: Id<'agentJobRuns'>
    conversationId?: string
    continuation?: string
    sugarAction: SugarTxAction
    parameters: Record<string, string | number | boolean>
  },
) {
  await requireWeb3(ctx, userId)
  if (!isProduction()) {
    throw new Error(
      'Executing smart-wallet DeFi plans requires the mainnet wallet (production Crossmint key). On staging, prepare the plan for a linked EOA instead.',
    )
  }
  const wallet = await cachedWalletForUser(ctx, userId)
  // Force the plan onto Base and the smart wallet regardless of what the
  // agent passed: the smart wallet only exists on Base, and pinning the
  // wallet here means the confirmed plan always spends the user's own funds.
  const planParameters = {
    ...normalizeSugarAgentParameters(parameters),
    chain: BASE_MAINNET_CHAIN_ID,
    wallet: wallet.address,
  }
  const plan = await executeSugarAction(
    sugarAction,
    planParameters,
    sugarOptions(ctx),
  )
  const transactions = executableSugarTransactions(plan)
  const summary =
    describeSugarExecution(sugarAction, parameters) +
    describeSugarPlanOutcome(plan)
  const created: { id: string; expiresAt: number; autoConfirmed: boolean } =
    await ctx.runMutation(internal.web3Actions.create, {
      userId,
      ...(jobRunId
        ? {
            jobRunId,
            jobSugarAction: sugarAction,
            jobPoolAddress:
              typeof parameters.pool === 'string'
                ? parameters.pool
                : undefined,
          }
        : {}),
      ...(conversationId ? { conversationId } : {}),
      ...(continuation ? { continuation } : {}),
      summary,
      payload: {
        kind: 'execute_plan',
        chainId: BASE_MAINNET_CHAIN_ID,
        transactions,
        intent: {
          sugarAction,
          parameters: planParameters,
          bounds: captureSugarBounds(plan),
        },
      },
    })
  return {
    actionId: created.id,
    expiresAt: created.expiresAt,
    summary,
    wallet: wallet.address,
    stepCount: transactions.length,
    status: created.autoConfirmed
      ? ('confirmed' as const)
      : ('pending' as const),
    autoConfirmed: created.autoConfirmed,
    note: preparedNote(created.autoConfirmed),
  }
}

export async function prepareEoaSugarExecutionForUser(
  ctx: ActionCtx,
  {
    userId,
    conversationId,
    continuation,
    chainId,
    sugarAction,
    parameters,
  }: {
    userId: string
    conversationId?: string
    continuation?: string
    chainId: number
    sugarAction: SugarTxAction
    parameters: Record<string, string | number | boolean>
  },
) {
  await requireWeb3(ctx, userId)
  const chainName = SUGAR_CHAIN_NAMES[chainId]
  if (!chainName) throw new Error('That Sugar chain is not supported.')
  const wallets: {
    smartWallet: { address: string; chain: string } | null
    eoa: { address: string } | null
  } = await ctx.runQuery(internal.wallets.getWalletsForAgent, { userId })
  if (!wallets.eoa) {
    throw new Error(
      'Link your wallet in BeeGreat before preparing this action.',
    )
  }
  const plan = await executeSugarAction(
    sugarAction,
    {
      ...normalizeSugarAgentParameters(parameters),
      chain: chainId,
      wallet: wallets.eoa.address,
    },
    sugarOptions(ctx),
  )
  const transactions = executableSugarTransactions(plan)
  const summary =
    describeSugarExecution(sugarAction, parameters, {
      chainName,
      walletLabel: 'your linked wallet',
    }) + describeSugarPlanOutcome(plan)
  const created: { id: string; expiresAt: number; autoConfirmed: boolean } =
    await ctx.runMutation(internal.web3Actions.create, {
      userId,
      ...(conversationId ? { conversationId } : {}),
      ...(continuation ? { continuation } : {}),
      summary,
      payload: {
        kind: 'execute_eoa_plan',
        chainId,
        walletAddress: wallets.eoa.address,
        transactions,
        intent: {
          sugarAction,
          parameters: {
            ...normalizeSugarAgentParameters(parameters),
            chain: chainId,
            wallet: wallets.eoa.address,
          },
          bounds: captureSugarBounds(plan),
        },
      },
    })
  return {
    actionId: created.id,
    expiresAt: created.expiresAt,
    summary,
    wallet: wallets.eoa.address,
    chainId,
    stepCount: transactions.length,
    status: 'pending' as const,
    autoConfirmed: false,
    note: 'Open BeeGreat and confirm this action. Your connected wallet will show every transaction before signing.',
  }
}

export async function refreshEoaSugarExecutionForUser(
  ctx: ActionCtx,
  { actionId }: { actionId: Id<'web3Actions'> },
): Promise<{
  walletAddress: string
  chainId: number
  transactionSteps: SugarTransactionStep[]
}> {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) throw new Error('Not signed in')
  await requireWeb3(ctx, identity.subject)
  const confirmed: Doc<'web3Actions'> | null = await ctx.runQuery(
    internal.web3Actions.get,
    { actionId },
  )
  if (
    !confirmed ||
    confirmed.userId !== identity.subject ||
    confirmed.payload.kind !== 'execute_eoa_plan' ||
    (confirmed.status !== 'confirmed' && confirmed.status !== 'in_progress')
  ) {
    throw new Error('This linked-wallet execution is no longer available.')
  }
  if (!confirmed.payload.intent) {
    throw new Error(
      'This older wallet plan cannot be refreshed. Ask Bee to prepare it again.',
    )
  }
  const plan = await executeSugarAction(
    confirmed.payload.intent.sugarAction,
    {
      ...confirmed.payload.intent.parameters,
      chain: confirmed.payload.chainId,
      wallet: confirmed.payload.walletAddress,
    },
    sugarOptions(ctx),
  )
  assertSugarBounds(plan, confirmed.payload.intent.bounds)
  return {
    walletAddress: confirmed.payload.walletAddress,
    chainId: confirmed.payload.chainId,
    transactionSteps: sugarTransactionSteps(plan),
  }
}

export async function reconcileCrossmintActionForId(
  ctx: ActionCtx,
  actionId: Id<'web3Actions'>,
) {
  const action: Doc<'web3Actions'> | null = await ctx.runQuery(
    internal.web3Actions.get,
    { actionId },
  )
  if (
    !action ||
    action.status !== 'in_progress' ||
    action.payload.kind !== 'execute_plan'
  )
    return null
  const pending = action.crossmintExecution?.findLast(
    (step) => step.status === 'prepared',
  )
  if (!pending) return null
  if (Date.now() > (action.confirmedAt ?? action.createdAt) + 15 * 60_000) {
    await ctx.runMutation(internal.web3Actions.recordCrossmintFailure, {
      actionId,
      transactionId: pending.transactionId,
      error: 'Crossmint did not settle the transaction within 15 minutes.',
    })
    return null
  }
  const chain =
    action.payload.chainId === SOCKET_CHAINS.arbitrum.chainId
      ? ('arbitrum' as const)
      : action.payload.chainId === BASE_MAINNET_CHAIN_ID
        ? ('base' as const)
        : null
  if (!chain) {
    await ctx.runMutation(internal.web3Actions.recordCrossmintFailure, {
      actionId,
      transactionId: pending.transactionId,
      error: 'The confirmed plan targets an unsupported chain.',
    })
    return null
  }
  try {
    const wallet = EVMWallet.from(await walletForUser(action.userId, chain))
    const status = reconcileCrossmintTransaction(
      await wallet.transaction(pending.transactionId),
    )
    if (status.status === 'success') {
      await ctx.runMutation(internal.web3Actions.recordCrossmintSuccess, {
        actionId,
        transactionId: pending.transactionId,
        hash: status.result.hash,
        explorerLink: status.result.explorerLink,
      })
    } else if (status.status === 'failed') {
      await ctx.runMutation(internal.web3Actions.recordCrossmintFailure, {
        actionId,
        transactionId: pending.transactionId,
        error: 'Crossmint reported that the transaction failed.',
      })
    } else {
      await ctx.scheduler.runAfter(
        15_000,
        internal.web3.reconcileCrossmintAction,
        {
          actionId,
        },
      )
    }
  } catch {
    await ctx.scheduler.runAfter(
      15_000,
      internal.web3.reconcileCrossmintAction,
      {
        actionId,
      },
    )
  }
  return null
}

export async function runSugarForUser(
  ctx: ActionCtx,
  {
    userId,
    sugarAction,
    parameters,
  }: {
    userId: string
    sugarAction: SugarAnyAction
    parameters: Record<string, string | number | boolean>
  },
) {
  await requireWeb3(ctx, userId)

  // Convex app configuration is typed explicitly. Forward only allowlisted
  // Sugar settings instead of exposing Node's ambient process.env.
  return executeSugarActionJson(
    sugarAction as SugarAction,
    normalizeSugarAgentParameters(parameters),
    sugarOptions(ctx),
  )
}
