'use node'

// Socket cross-chain swap orchestration: quoting against the user's smart
// wallets, preparing confirm-gated swap actions, reconciling origin-chain
// Crossmint batches, and polling destination settlement. Plain TypeScript
// helpers only — the Convex function definitions live in web3.ts.

import { EVMWallet } from '@crossmint/wallets-sdk'
import type { FunctionArgs } from 'convex/server'
import { internal } from '../_generated/api'
import type { ActionCtx } from '../_generated/server'
import type { Doc, Id } from '../_generated/dataModel'
import {
  SOCKET_CHAINS,
  explorerTransactionUrl,
  getSocketQuote,
  getSocketStatus,
  type SocketChain,
  type SocketRouteStatus,
  type SocketToken,
} from '../socketSwap'
import { reconcileCrossmintTransaction } from '../web3Execution'
import {
  isProduction,
  preparedNote,
  requireWeb3,
  socketApiConfig,
} from './shared'
import { cachedWalletForUser, walletForUser } from './crossmintWallet'

export async function socketWalletsForUser(
  ctx: ActionCtx,
  userId: string,
  originChain: SocketChain,
  destinationChain: SocketChain,
) {
  if (!isProduction()) {
    throw new Error('Cross-chain swaps require a production Crossmint key.')
  }
  const originWallet = await cachedWalletForUser(
    ctx,
    userId,
    SOCKET_CHAINS[originChain].crossmintChain,
  )
  const destinationWallet = await cachedWalletForUser(
    ctx,
    userId,
    SOCKET_CHAINS[destinationChain].crossmintChain,
  )
  if (
    originWallet.address.toLowerCase() !==
    destinationWallet.address.toLowerCase()
  ) {
    throw new Error(
      'The Base and Arbitrum smart-wallet addresses do not match. Cross-chain execution was stopped safely.',
    )
  }
  return { originWallet, destinationWallet }
}

export async function quoteSocketSwapForUser(
  ctx: ActionCtx,
  input: {
    userId: string
    originChain: SocketChain
    destinationChain: SocketChain
    inputToken: SocketToken
    outputToken: SocketToken
    amount: string
  },
) {
  await requireWeb3(ctx, input.userId)
  const { originWallet, destinationWallet } = await socketWalletsForUser(
    ctx,
    input.userId,
    input.originChain,
    input.destinationChain,
  )
  const quote = await getSocketQuote(
    {
      originChain: input.originChain,
      destinationChain: input.destinationChain,
      inputToken: input.inputToken,
      outputToken: input.outputToken,
      inputAmount: input.amount,
      userAddress: originWallet.address,
      receiverAddress: destinationWallet.address,
    },
    socketApiConfig(),
  )
  return { quote, walletAddress: originWallet.address }
}

export async function quoteSocketSwapPreview(
  ctx: ActionCtx,
  args: {
    userId: string
    originChain: SocketChain
    destinationChain: SocketChain
    inputToken: SocketToken
    outputToken: SocketToken
    amount: string
  },
) {
  const { quote, walletAddress } = await quoteSocketSwapForUser(ctx, args)
  return {
    walletAddress,
    originChain: quote.originChain,
    destinationChain: quote.destinationChain,
    inputToken: quote.inputToken,
    outputToken: quote.outputToken,
    inputAmount: quote.inputAmount,
    outputAmount: quote.outputAmount,
    minimumOutputAmount: quote.minimumOutputAmount,
    provider: quote.provider,
    estimatedTimeSeconds: quote.estimatedTimeSeconds,
    expiresAt: quote.expiresAt,
    sourceGasSponsored: true,
    destinationGas:
      quote.outputToken === 'eth'
        ? 'The destination receives native ETH, which can pay gas.'
        : 'Socket refuel is requested so the destination also receives native gas.',
  }
}

export async function prepareSocketSwapForUser(
  ctx: ActionCtx,
  args: {
    userId: string
    conversationId?: string
    continuation?: string
    originChain: SocketChain
    destinationChain: SocketChain
    inputToken: SocketToken
    outputToken: SocketToken
    amount: string
  },
) {
  const { quote, walletAddress } = await quoteSocketSwapForUser(ctx, args)
  const originName = SOCKET_CHAINS[quote.originChain].displayName
  const destinationName = SOCKET_CHAINS[quote.destinationChain].displayName
  const summary = `Swap ${quote.inputAmount} ${quote.inputToken.toUpperCase()} on ${originName} for at least ${quote.minimumOutputAmount} ${quote.outputToken.toUpperCase()} on ${destinationName} via ${quote.provider}`
  // The confirmation window is the full action TTL, not the ~60s quote
  // lifetime: if the quote goes stale before execution, the executor
  // re-fetches a fresh route and refreshSocketRoute enforces the
  // confirmed minimum output.
  const payload: Extract<
    FunctionArgs<typeof internal.web3Actions.create>['payload'],
    { kind: 'socket_swap' }
  > = {
    kind: 'socket_swap',
    quoteId: quote.quoteId,
    originChainId: quote.originChainId,
    destinationChainId: quote.destinationChainId,
    originChain: quote.originChain,
    destinationChain: quote.destinationChain,
    inputToken: quote.inputToken,
    outputToken: quote.outputToken,
    inputAmount: quote.inputAmount,
    outputAmount: quote.outputAmount,
    minimumOutputAmount: quote.minimumOutputAmount,
    provider: quote.provider,
    estimatedTimeSeconds: quote.estimatedTimeSeconds,
    quoteExpiresAt: quote.expiresAt,
    monitoringDeadlineAt:
      quote.expiresAt + quote.statusMaxDurationSeconds * 1_000,
    statusIntervalSeconds: quote.statusIntervalSeconds,
    transaction: quote.transaction,
  }
  if (quote.approval) payload.approval = quote.approval
  const createArgs: FunctionArgs<typeof internal.web3Actions.create> = {
    userId: args.userId,
    summary,
    payload,
  }
  if (args.conversationId) createArgs.conversationId = args.conversationId
  if (args.continuation) createArgs.continuation = args.continuation
  const created: {
    id: Id<'web3Actions'>
    expiresAt: number
    autoConfirmed: boolean
  } = await ctx.runMutation(internal.web3Actions.create, createArgs)
  return {
    actionId: created.id,
    expiresAt: created.expiresAt,
    summary,
    walletAddress,
    estimatedOutput: `${quote.outputAmount} ${quote.outputToken.toUpperCase()}`,
    minimumOutput: `${quote.minimumOutputAmount} ${quote.outputToken.toUpperCase()}`,
    estimatedTimeSeconds: quote.estimatedTimeSeconds,
    sourceGasSponsored: true,
    status: created.autoConfirmed
      ? ('confirmed' as const)
      : ('pending' as const),
    autoConfirmed: created.autoConfirmed,
    note: preparedNote(created.autoConfirmed),
  }
}

export async function reconcileSocketCrossmintActionForId(
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
    action.payload.kind !== 'socket_swap'
  )
    return null
  const pending = action.crossmintExecution?.findLast(
    (step) => step.status === 'prepared',
  )
  if (!pending) return null
  if (
    Date.now() >
    (action.executionStartedAt ?? action.createdAt) + 15 * 60_000
  ) {
    await ctx.runMutation(internal.web3Actions.recordSocketOriginFailure, {
      actionId,
      transactionId: pending.transactionId,
      error:
        'Crossmint did not settle the origin transaction within 15 minutes.',
    })
    return null
  }
  try {
    const wallet = EVMWallet.from(
      await walletForUser(action.userId, action.payload.originChain),
    )
    const status = reconcileCrossmintTransaction(
      await wallet.transaction(pending.transactionId),
    )
    if (status.status === 'success') {
      await ctx.runMutation(internal.web3Actions.recordSocketOriginSuccess, {
        actionId,
        transactionId: pending.transactionId,
        hash: status.result.hash,
        explorerLink: status.result.explorerLink,
      })
    } else if (status.status === 'failed') {
      await ctx.runMutation(internal.web3Actions.recordSocketOriginFailure, {
        actionId,
        transactionId: pending.transactionId,
        error: 'Crossmint reported that the origin transaction failed.',
      })
    } else {
      await ctx.scheduler.runAfter(
        15_000,
        internal.web3.reconcileSocketCrossmintAction,
        { actionId },
      )
    }
  } catch {
    await ctx.scheduler.runAfter(
      15_000,
      internal.web3.reconcileSocketCrossmintAction,
      { actionId },
    )
  }
  return null
}

export function socketStatusDetail(
  status: SocketRouteStatus,
  destinationChain: SocketChain,
) {
  const destination = SOCKET_CHAINS[destinationChain].displayName
  switch (status) {
    case 'PENDING':
      return `Transfer submitted. Waiting for the route to start toward ${destination}…`
    case 'IN_PROGRESS':
      return `Funds are moving to ${destination}…`
    case 'COMPLETED':
      return `Funds arrived on ${destination}.`
    case 'REFUNDED':
      return 'The route was refunded.'
    case 'FAILED':
      return 'The cross-chain route failed.'
    case 'EXPIRED':
      return 'The cross-chain route expired.'
  }
}

export async function pollSocketSwapStatusForId(
  ctx: ActionCtx,
  actionId: Id<'web3Actions'>,
) {
  const action: Doc<'web3Actions'> | null = await ctx.runQuery(
    internal.web3Actions.get,
    {
      actionId,
    },
  )
  if (
    !action ||
    action.status !== 'in_progress' ||
    action.payload.kind !== 'socket_swap'
  ) {
    return null
  }
  if (Date.now() >= action.payload.monitoringDeadlineAt) {
    const progress: FunctionArgs<
      typeof internal.web3Actions.recordSocketProgress
    >['progress'] = {
      status: 'EXPIRED',
      detail:
        'Destination settlement could not be confirmed before the monitoring window closed.',
      updatedAt: Date.now(),
    }
    const knownOriginTxHash = action.socketProgress?.originTxHash
    if (knownOriginTxHash) progress.originTxHash = knownOriginTxHash
    await ctx.runMutation(internal.web3Actions.recordSocketProgress, {
      actionId,
      progress,
    })
    return null
  }

  try {
    const status = await getSocketStatus(
      action.payload.quoteId,
      socketApiConfig(),
    )
    const destinationExplorerLink = status.destinationTxHash
      ? explorerTransactionUrl(
          action.payload.destinationChain,
          status.destinationTxHash,
        )
      : undefined
    const result = [...(action.result ?? [])]
    if (
      status.destinationTxHash &&
      !result.some((item) => item.hash === status.destinationTxHash)
    ) {
      result.push({
        hash: status.destinationTxHash,
        explorerLink: destinationExplorerLink ?? null,
      })
    }
    const progress: FunctionArgs<
      typeof internal.web3Actions.recordSocketProgress
    >['progress'] = {
      status: status.status,
      detail: socketStatusDetail(
        status.status,
        action.payload.destinationChain,
      ),
      updatedAt: Date.now(),
    }
    const originTxHash =
      status.originTxHash || action.socketProgress?.originTxHash
    if (originTxHash) progress.originTxHash = originTxHash
    if (status.destinationTxHash) {
      progress.destinationTxHash = status.destinationTxHash
    }
    if (destinationExplorerLink) {
      progress.destinationExplorerLink = destinationExplorerLink
    }
    const progressArgs: FunctionArgs<
      typeof internal.web3Actions.recordSocketProgress
    > = { actionId, progress }
    if (result.length > 0) progressArgs.result = result
    await ctx.runMutation(
      internal.web3Actions.recordSocketProgress,
      progressArgs,
    )
  } catch (error) {
    console.warn('Socket status poll failed; retrying.', {
      actionId,
      error: error instanceof Error ? error.message : 'Unknown Socket error',
    })
    await ctx.runMutation(internal.web3Actions.recordSocketPollingDelay, {
      actionId,
    })
  }
  return null
}
