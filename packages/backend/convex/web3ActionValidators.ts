import { v } from 'convex/values'
import { SUGAR_TX_ACTIONS } from '@beegreat/sugar/contracts'

export const web3TransactionValidator = v.object({
  to: v.string(),
  data: v.string(),
  value: v.string(),
})

export const sugarBoundsValidator = v.object({
  minimumOutput: v.optional(v.string()),
  maximumDeposit0: v.optional(v.string()),
  maximumDeposit1: v.optional(v.string()),
  minimumWithdrawal0: v.optional(v.string()),
  minimumWithdrawal1: v.optional(v.string()),
  veNftAmount: v.optional(v.string()),
  veNftLockDurationSeconds: v.optional(v.number()),
})

export const sugarIntentValidator = v.object({
  sugarAction: v.union(...SUGAR_TX_ACTIONS.map((name) => v.literal(name))),
  parameters: v.record(
    v.string(),
    v.union(v.string(), v.number(), v.boolean()),
  ),
  bounds: sugarBoundsValidator,
})

export const crossmintExecutionStepValidator = v.object({
  role: v.union(v.literal('approval'), v.literal('action')),
  transactionId: v.string(),
  status: v.union(
    v.literal('prepared'),
    v.literal('success'),
    v.literal('failed'),
  ),
  hash: v.optional(v.string()),
  explorerLink: v.optional(v.string()),
})

export const socketApprovalValidator = v.object({
  tokenAddress: v.string(),
  spenderAddress: v.string(),
  amount: v.string(),
})

export const web3ActionPayloadValidator = v.union(
  v.object({
    kind: v.literal('send_tokens'),
    recipient: v.string(),
    token: v.string(),
    amount: v.string(),
  }),
  v.object({
    kind: v.literal('execute_plan'),
    chainId: v.number(),
    transactions: v.array(web3TransactionValidator),
    intent: v.optional(sugarIntentValidator),
  }),
  v.object({
    kind: v.literal('execute_eoa_plan'),
    chainId: v.number(),
    walletAddress: v.string(),
    transactions: v.array(web3TransactionValidator),
    intent: v.optional(sugarIntentValidator),
  }),
  v.object({
    kind: v.literal('socket_swap'),
    quoteId: v.string(),
    originChainId: v.number(),
    destinationChainId: v.number(),
    originChain: v.union(v.literal('base'), v.literal('arbitrum')),
    destinationChain: v.union(v.literal('base'), v.literal('arbitrum')),
    inputToken: v.union(v.literal('eth'), v.literal('usdc')),
    outputToken: v.union(v.literal('eth'), v.literal('usdc')),
    inputAmount: v.string(),
    outputAmount: v.string(),
    minimumOutputAmount: v.string(),
    provider: v.string(),
    estimatedTimeSeconds: v.number(),
    quoteExpiresAt: v.number(),
    monitoringDeadlineAt: v.number(),
    statusIntervalSeconds: v.number(),
    approval: v.optional(socketApprovalValidator),
    transaction: web3TransactionValidator,
  }),
)

export const web3ActionStatusValidator = v.union(
  v.literal('pending'),
  v.literal('confirmed'),
  v.literal('in_progress'),
  v.literal('executed'),
  v.literal('failed'),
  v.literal('refunded'),
  v.literal('cancelled'),
  v.literal('expired'),
)

export const web3ActionResultValidator = v.array(
  v.object({
    hash: v.union(v.string(), v.null()),
    explorerLink: v.union(v.string(), v.null()),
  }),
)

export const socketProgressValidator = v.object({
  status: v.union(
    v.literal('PENDING'),
    v.literal('IN_PROGRESS'),
    v.literal('COMPLETED'),
    v.literal('FAILED'),
    v.literal('EXPIRED'),
    v.literal('REFUNDED'),
  ),
  detail: v.string(),
  originTxHash: v.optional(v.string()),
  destinationTxHash: v.optional(v.string()),
  destinationExplorerLink: v.optional(v.string()),
  updatedAt: v.number(),
})
