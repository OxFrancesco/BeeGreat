// EOA (WalletConnect linked-wallet) execution tracking: claiming a pending
// plan for the connected wallet, recording submissions and receipts, and
// closing a claimed action on wallet failure. Plain TypeScript helpers only —
// the Convex function definitions live in web3Actions.ts.

import { internal } from '../_generated/api'
import type { MutationCtx } from '../_generated/server'
import type { Doc, Id } from '../_generated/dataModel'
import { requirePowerup } from '../powerups'

const EVM_HASH = /^0x[0-9a-fA-F]{64}$/
const EOA_CHAIN_EXPLORERS = new Map<number, string>([
  [10, 'https://optimistic.etherscan.io/tx/'],
  [130, 'https://uniscan.xyz/tx/'],
  [252, 'https://fraxscan.com/tx/'],
  [1135, 'https://blockscout.lisk.com/tx/'],
  [1868, 'https://soneium.blockscout.com/tx/'],
  [5330, 'https://explorer.superseed.xyz/tx/'],
  [8453, 'https://basescan.org/tx/'],
  [34443, 'https://explorer.mode.network/tx/'],
  [42220, 'https://celoscan.io/tx/'],
  [57073, 'https://explorer.inkonchain.com/tx/'],
])

/**
 * App-facing EOA confirmation. Claims the exact pending plan but deliberately
 * does not schedule the server signer; only the connected wallet can submit it.
 */
export async function beginEoaExecutionForUser(
  ctx: MutationCtx,
  userId: string,
  actionId: Id<'web3Actions'>,
) {
  const action = await ctx.db.get(actionId)
  if (!action || action.userId !== userId) {
    throw new Error('This confirmation is no longer available.')
  }
  await requirePowerup(ctx, userId, 'web3')
  if (action.payload.kind !== 'execute_eoa_plan') {
    throw new Error('This action does not use your linked wallet.')
  }
  const now = Date.now()
  if (action.status === 'pending' && action.expiresAt <= now) {
    await ctx.db.patch(actionId, { status: 'expired' })
    throw new Error('This confirmation expired. Ask Bee to prepare it again.')
  }
  if (action.status !== 'pending') {
    throw new Error(`This action was already ${action.status}.`)
  }
  const linkedWallet = await ctx.db
    .query('wallets')
    .withIndex('by_user', (q) => q.eq('userId', userId).eq('chain', 'evm'))
    .unique()
  if (
    !linkedWallet ||
    linkedWallet.kind !== 'eoa' ||
    linkedWallet.address.toLowerCase() !==
      action.payload.walletAddress.toLowerCase()
  ) {
    throw new Error('Reconnect the wallet shown in this confirmation.')
  }
  await ctx.db.patch(actionId, {
    status: 'confirmed',
    confirmedAt: now,
    executionStartedAt: now,
  })
  return {
    walletAddress: action.payload.walletAddress,
    chainId: action.payload.chainId,
    transactions: action.payload.transactions,
  }
}

/** Record each WalletConnect hash as submitted, never as settled. */
export async function recordEoaSubmissionForUser(
  ctx: MutationCtx,
  userId: string,
  {
    actionId,
    index,
    hash,
    role,
  }: {
    actionId: Id<'web3Actions'>
    index: number
    hash: string
    role?: 'approval' | 'action'
  },
) {
  const action = await ctx.db.get(actionId)
  if (
    !action ||
    action.userId !== userId ||
    action.payload.kind !== 'execute_eoa_plan'
  ) {
    throw new Error('This wallet submission is no longer available.')
  }
  if (action.status !== 'confirmed' && action.status !== 'in_progress') {
    throw new Error(`This action was already ${action.status}.`)
  }
  const execution = action.eoaExecution ?? []
  if (!Number.isSafeInteger(index) || index !== execution.length) {
    throw new Error('Wallet transactions must be submitted in plan order.')
  }
  if (!EVM_HASH.test(hash)) {
    throw new Error('The wallet returned an invalid transaction hash.')
  }
  const explorer = EOA_CHAIN_EXPLORERS.get(action.payload.chainId)
  if (!explorer) throw new Error('This EVM chain is not supported.')
  const now = Date.now()
  const result = [
    ...(action.result ?? []),
    { hash, explorerLink: `${explorer}${hash}` },
  ]
  const submittedStep: NonNullable<Doc<'web3Actions'>['eoaExecution']>[number] =
    {
      index,
      hash,
      status: 'submitted',
      submittedAt: now,
    }
  if (role) submittedStep.role = role
  await ctx.db.patch(actionId, {
    result,
    status: 'in_progress',
    submittedAt: action.submittedAt ?? now,
    eoaExecution: [...execution, submittedStep],
  })
  return { done: false }
}

/** Settle a linked-wallet step only after its successful on-chain receipt. */
export async function recordEoaReceiptForUser(
  ctx: MutationCtx,
  userId: string,
  {
    actionId,
    index,
    hash,
  }: {
    actionId: Id<'web3Actions'>
    index: number
    hash: string
  },
) {
  const action = await ctx.db.get(actionId)
  if (
    !action ||
    action.userId !== userId ||
    action.payload.kind !== 'execute_eoa_plan'
  ) {
    throw new Error('This wallet receipt is no longer available.')
  }
  if (action.status !== 'confirmed' && action.status !== 'in_progress') {
    if (action.status === 'executed') return { done: true }
    throw new Error(`This action was already ${action.status}.`)
  }
  if (!Number.isSafeInteger(index) || !EVM_HASH.test(hash)) {
    throw new Error('The wallet returned an invalid receipt.')
  }
  const execution = action.eoaExecution ?? []
  const step = execution[index]
  if (!step || step.hash.toLowerCase() !== hash.toLowerCase()) {
    throw new Error('The wallet receipt does not match the submitted plan.')
  }
  if (step.status === 'success') {
    const alreadyDone =
      step.role === 'action' ||
      (step.role === undefined &&
        execution.filter((item) => item.status === 'success').length ===
          action.payload.transactions.length)
    return { done: alreadyDone }
  }

  const now = Date.now()
  const settled = execution.map((item, stepIndex) =>
    stepIndex === index
      ? { ...item, status: 'success' as const, confirmedAt: now }
      : item,
  )
  const done =
    step.role === 'action' ||
    (step.role === undefined &&
      settled.filter((item) => item.status === 'success').length ===
        action.payload.transactions.length)
  const patch: Partial<Doc<'web3Actions'>> = {
    eoaExecution: settled,
    status: done ? 'executed' : 'in_progress',
  }
  if (done) patch.settledAt = now
  await ctx.db.patch(actionId, patch)
  if (done) {
    await ctx.scheduler.runAfter(0, internal.web3Notify.notifyActionSettled, {
      actionId,
    })
  }
  return { done }
}

/** Close a claimed EOA action with a server-owned, non-sensitive error. */
export async function reportEoaFailureForUser(
  ctx: MutationCtx,
  userId: string,
  {
    actionId,
    reason,
  }: {
    actionId: Id<'web3Actions'>
    reason: 'user_rejected' | 'account_changed' | 'wallet_error'
  },
) {
  const action = await ctx.db.get(actionId)
  if (
    !action ||
    action.userId !== userId ||
    action.payload.kind !== 'execute_eoa_plan' ||
    (action.status !== 'confirmed' && action.status !== 'in_progress')
  ) {
    return null
  }
  const submitted = action.eoaExecution?.length ?? 0
  const cancelled = reason === 'user_rejected' && submitted === 0
  const error =
    reason === 'account_changed'
      ? 'The connected wallet did not match the confirmed action.'
      : reason === 'user_rejected'
        ? submitted > 0
          ? 'The wallet declined a later step after an earlier transaction was submitted.'
          : 'The wallet declined the transaction.'
        : submitted > 0
          ? 'The wallet stopped before every step could be submitted.'
          : 'The wallet could not submit the transaction.'
  const patch: Partial<Doc<'web3Actions'>> = {
    status: cancelled ? 'cancelled' : 'failed',
    error,
  }
  if (!cancelled) patch.settledAt = Date.now()
  await ctx.db.patch(actionId, patch)
  if (!cancelled) {
    await ctx.scheduler.runAfter(0, internal.web3Notify.notifyActionSettled, {
      actionId,
    })
  }
  return null
}
