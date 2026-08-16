'use node'

// Smart-wallet execution of confirmed web3 actions. This is the single place
// where a confirmed action's payload is turned into signed transactions, so it
// spans the Crossmint, Sugar, and Socket subsystems. Plain TypeScript helpers
// only — the Convex function definition lives in web3.ts.

import { EVMWallet } from '@crossmint/wallets-sdk'
import { executeSugarAction } from '@beegreat/sugar'
import { encodeFunctionData } from 'viem'
import { internal } from '../_generated/api'
import type { ActionCtx } from '../_generated/server'
import type { Doc, Id } from '../_generated/dataModel'
import { SOCKET_CHAINS } from '../socketSwap'
import {
  CrossmintTransactionPendingError,
  executeSmartWalletIntent,
  prepareAndApproveCrossmintBatch,
  type SugarTransactionStep,
} from '../web3Execution'
import {
  BASE_MAINNET_CHAIN_ID,
  SOCKET_QUOTE_REFRESH_BUFFER_MS,
  requireWeb3,
} from './shared'
import { walletForUser } from './crossmintWallet'
import { sugarOptions } from './sugarExecution'
import { quoteSocketSwapForUser } from './socketOrchestration'

export async function executeConfirmedActionForId(
  ctx: ActionCtx,
  actionId: Id<'web3Actions'>,
) {
  const action: Doc<'web3Actions'> | null = await ctx.runQuery(
    internal.web3Actions.get,
    {
      actionId,
    },
  )
  if (!action || action.status !== 'confirmed') return null

  const results: Array<{ hash: string | null; explorerLink: string | null }> =
    []
  try {
    await requireWeb3(ctx, action.userId)
    if (action.payload.kind === 'send_tokens') {
      const wallet = await walletForUser(action.userId)
      const transaction = await wallet.send(
        action.payload.recipient,
        action.payload.token,
        action.payload.amount,
      )
      results.push({
        hash: transaction.hash ?? null,
        explorerLink: transaction.explorerLink ?? null,
      })
    } else if (action.payload.kind === 'execute_plan') {
      const chainId = action.payload.chainId
      const chain =
        chainId === SOCKET_CHAINS.arbitrum.chainId
          ? ('arbitrum' as const)
          : chainId === BASE_MAINNET_CHAIN_ID
            ? ('base' as const)
            : null
      if (!chain)
        throw new Error('The confirmed plan targets an unsupported chain.')
      const wallet = await walletForUser(action.userId, chain)
      const evmWallet = EVMWallet.from(wallet)
      if (action.payload.intent) {
        const intent = action.payload.intent
        try {
          const settled = await executeSmartWalletIntent({
            buildPlan: () =>
              executeSugarAction(
                intent.sugarAction,
                {
                  ...intent.parameters,
                  chain: chainId,
                  wallet: wallet.address,
                },
                sugarOptions(ctx),
              ),
            bounds: intent.bounds,
            executeBatch: (steps) =>
              prepareAndApproveCrossmintBatch({
                wallet: evmWallet,
                steps,
                onPrepared: async (transactionId) => {
                  await ctx.runMutation(
                    internal.web3Actions.recordCrossmintPrepared,
                    {
                      actionId,
                      // The approvals and final action now settle atomically.
                      role: 'action',
                      transactionId,
                    },
                  )
                },
              }),
          })
          await ctx.runMutation(internal.web3Actions.recordCrossmintSuccess, {
            actionId,
            transactionId: settled.transactionId,
            hash: settled.hash,
            explorerLink: settled.explorerLink,
          })
        } catch (error) {
          if (error instanceof CrossmintTransactionPendingError) return null
          await ctx.runMutation(internal.web3Actions.recordCrossmintFailure, {
            actionId,
            error:
              error instanceof Error ? error.message : 'Execution failed',
          })
        }
        return null
      }
      // Compatibility for confirmations prepared before semantic intents
      // were deployed. New actions always use the durable path above.
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
    } else if (action.payload.kind === 'execute_eoa_plan') {
      throw new Error(
        'Linked-wallet actions must be signed by the connected wallet.',
      )
    } else {
      let payload = action.payload
      if (
        payload.quoteExpiresAt <=
        Date.now() + SOCKET_QUOTE_REFRESH_BUFFER_MS
      ) {
        // Socket quotes only live ~60s, so the confirmed route is often
        // stale by the time the user taps confirm. Re-quote with the exact
        // terms the user confirmed; refreshSocketRoute rejects any route
        // that guarantees less than the confirmed minimum output.
        const { quote } = await quoteSocketSwapForUser(ctx, {
          userId: action.userId,
          originChain: payload.originChain,
          destinationChain: payload.destinationChain,
          inputToken: payload.inputToken,
          outputToken: payload.outputToken,
          amount: payload.inputAmount,
        })
        const route = {
          quoteId: quote.quoteId,
          outputAmount: quote.outputAmount,
          minimumOutputAmount: quote.minimumOutputAmount,
          provider: quote.provider,
          estimatedTimeSeconds: quote.estimatedTimeSeconds,
          quoteExpiresAt: quote.expiresAt,
          monitoringDeadlineAt:
            quote.expiresAt + quote.statusMaxDurationSeconds * 1_000,
          statusIntervalSeconds: quote.statusIntervalSeconds,
          ...(quote.approval ? { approval: quote.approval } : {}),
          transaction: quote.transaction,
        }
        await ctx.runMutation(internal.web3Actions.refreshSocketRoute, {
          actionId,
          route,
        })
        payload = { ...payload, approval: undefined, ...route }
      }
      const wallet = await walletForUser(
        action.userId,
        SOCKET_CHAINS[payload.originChain].crossmintChain,
      )
      const evmWallet = EVMWallet.from(wallet)
      const steps: SugarTransactionStep[] = []
      if (payload.approval) {
        steps.push({
          role: 'approval',
          transaction: {
            to: payload.approval.tokenAddress,
            value: '0',
            data: encodeFunctionData({
              abi: [
                {
                  type: 'function',
                  name: 'approve',
                  stateMutability: 'nonpayable',
                  inputs: [
                    { name: 'spender', type: 'address' },
                    { name: 'amount', type: 'uint256' },
                  ],
                  outputs: [{ name: '', type: 'bool' }],
                },
              ] as const,
              functionName: 'approve',
              args: [
                payload.approval.spenderAddress as `0x${string}`,
                BigInt(payload.approval.amount),
              ],
            }),
          },
        })
      }
      steps.push({ role: 'action', transaction: payload.transaction })
      try {
        const settled = await prepareAndApproveCrossmintBatch({
          wallet: evmWallet,
          steps,
          onPrepared: async (transactionId) => {
            await ctx.runMutation(internal.web3Actions.recordSocketPrepared, {
              actionId,
              transactionId,
            })
          },
        })
        await ctx.runMutation(
          internal.web3Actions.recordSocketOriginSuccess,
          {
            actionId,
            transactionId: settled.transactionId,
            hash: settled.hash,
            explorerLink: settled.explorerLink,
          },
        )
      } catch (error) {
        if (error instanceof CrossmintTransactionPendingError) return null
        await ctx.runMutation(
          internal.web3Actions.recordSocketOriginFailure,
          {
            actionId,
            error:
              error instanceof Error ? error.message : 'Execution failed',
          },
        )
      }
      return null
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
}
