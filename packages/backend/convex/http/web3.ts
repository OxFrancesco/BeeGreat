import {
  isSugarAction,
  isSugarTxAction,
  type SugarAction,
} from '@beegreat/sugar/contracts'
import { internal } from '../_generated/api'
import type { Id } from '../_generated/dataModel'
import { httpAction } from '../_generated/server'
import { web3ActionContext } from '../web3Actions'
import { jsonResponse, readJsonBody, requireBrokerSecret } from './middleware'

export const web3Sugar = httpAction(async (ctx, request) => {
  const authError = requireBrokerSecret(request)
  if (authError) return authError

  const body = await readJsonBody<Record<string, unknown>>(request)
  const parameters = body?.parameters
  if (
    typeof body?.userId !== 'string' ||
    !/^user_[A-Za-z0-9]+$/.test(body.userId) ||
    !isSugarAction(body.sugarAction) ||
    !parameters ||
    typeof parameters !== 'object' ||
    Array.isArray(parameters) ||
    Object.values(parameters).some(
      (value) =>
        typeof value !== 'string' &&
        typeof value !== 'number' &&
        typeof value !== 'boolean',
    )
  ) {
    return jsonResponse({ error: 'Invalid Sugar request' }, 400)
  }

  try {
    // The Node action runs the native TypeScript Sugar SDK directly. This
    // HTTP route remains the authenticated boundary used by the agent.
    const result: string = await ctx.runAction(internal.web3.runSugar, {
      userId: body.userId,
      sugarAction: body.sugarAction as SugarAction,
      parameters: parameters as Record<string, string | number | boolean>,
    })
    return new Response(result, {
      status: 200,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store',
      },
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Sugar request failed'
    return jsonResponse({ error: message }, 400)
  }
})

const WEB3_WALLET_OPS = [
  'create_wallet',
  'balances',
  'activity',
  'fund',
  'wallets',
  'prepare_send',
  'quote_socket_swap',
  'prepare_socket_swap',
  'prepare_execution',
  'prepare_eoa_execution',
  'action_status',
] as const
type Web3WalletOp = (typeof WEB3_WALLET_OPS)[number]
const WEB3_PREPARE_OPS = new Set<Web3WalletOp>([
  'prepare_send',
  'prepare_socket_swap',
  'prepare_execution',
  'prepare_eoa_execution',
])

// Authenticated bridge for every wallet-side Web3 tool. The Convex functions
// behind it are internal on purpose: agent identity is the broker secret, and
// nothing here can move funds — fund movement requires either the signed-in
// app confirmation gate for the Bee wallet or the matching WalletConnect EOA
// to sign the exact pending plan.
export const web3Wallet = httpAction(async (ctx, request) => {
  const authError = requireBrokerSecret(request)
  if (authError) return authError

  const body = await readJsonBody<Record<string, unknown>>(request)
  const params = (body?.params ?? {}) as Record<string, unknown>
  if (
    typeof body?.userId !== 'string' ||
    !/^user_[A-Za-z0-9]+$/.test(body.userId) ||
    typeof body.op !== 'string' ||
    !(WEB3_WALLET_OPS as readonly string[]).includes(body.op) ||
    typeof params !== 'object' ||
    params === null ||
    Array.isArray(params)
  ) {
    return jsonResponse({ error: 'Invalid Web3 request' }, 400)
  }

  const userId = body.userId
  const op = body.op as Web3WalletOp
  const str = (name: string) =>
    typeof params[name] === 'string' ? (params[name] as string) : ''
  let actionContext: ReturnType<typeof web3ActionContext> = {}
  if (WEB3_PREPARE_OPS.has(op)) {
    if (
      (body.conversationId !== undefined &&
        typeof body.conversationId !== 'string') ||
      (params.continuation !== undefined &&
        typeof params.continuation !== 'string') ||
      (body.jobRunId !== undefined && typeof body.jobRunId !== 'string')
    ) {
      return jsonResponse({ error: 'Invalid Web3 action origin' }, 400)
    }
    if (body.jobRunId !== undefined && op !== 'prepare_execution') {
      return jsonResponse(
        {
          error:
            'Scheduled wallet grants support only scoped Aerodrome smart-wallet actions',
        },
        409,
      )
    }
    try {
      actionContext = web3ActionContext(
        userId,
        body.conversationId as string | undefined,
        params.continuation as string | undefined,
      )
    } catch {
      return jsonResponse({ error: 'Invalid Web3 action origin' }, 400)
    }
  }
  try {
    switch (op) {
      case 'create_wallet':
        return jsonResponse(
          await ctx.runAction(internal.web3.getOrCreateWallet, { userId }),
          200,
        )
      case 'balances': {
        const chain = str('chain')
        if (chain && chain !== 'base' && chain !== 'arbitrum') {
          return jsonResponse({ error: 'Invalid balance chain' }, 400)
        }
        return jsonResponse(
          await ctx.runAction(internal.web3.getBalances, {
            userId,
            ...(chain ? { chain: chain as 'base' | 'arbitrum' } : {}),
          }),
          200,
        )
      }
      case 'activity': {
        const activity: string = await ctx.runAction(
          internal.web3.getActivity,
          { userId },
        )
        return new Response(activity, {
          status: 200,
          headers: {
            'content-type': 'application/json; charset=utf-8',
            'cache-control': 'no-store',
          },
        })
      }
      case 'fund':
        return jsonResponse(
          await ctx.runAction(internal.web3.fundWallet, {
            userId,
            amount: typeof params.amount === 'number' ? params.amount : 0,
          }),
          200,
        )
      case 'wallets':
        return jsonResponse(
          await ctx.runQuery(internal.wallets.getWalletsForAgent, { userId }),
          200,
        )
      case 'prepare_send':
        return jsonResponse(
          await ctx.runAction(internal.web3.prepareSendTokens, {
            userId,
            ...actionContext,
            recipient: str('recipient'),
            token: str('token'),
            amount: str('amount'),
          }),
          200,
        )
      case 'quote_socket_swap':
      case 'prepare_socket_swap': {
        const originChain = str('originChain')
        const destinationChain = str('destinationChain')
        const inputToken = str('inputToken')
        const outputToken = str('outputToken')
        if (
          (originChain !== 'base' && originChain !== 'arbitrum') ||
          (destinationChain !== 'base' && destinationChain !== 'arbitrum') ||
          (inputToken !== 'eth' && inputToken !== 'usdc') ||
          (outputToken !== 'eth' && outputToken !== 'usdc')
        ) {
          return jsonResponse({ error: 'Invalid Socket swap request' }, 400)
        }
        const request = {
          userId,
          ...(op === 'prepare_socket_swap' ? actionContext : {}),
          originChain: originChain as 'base' | 'arbitrum',
          destinationChain: destinationChain as 'base' | 'arbitrum',
          inputToken: inputToken as 'eth' | 'usdc',
          outputToken: outputToken as 'eth' | 'usdc',
          amount: str('amount'),
        }
        return jsonResponse(
          op === 'quote_socket_swap'
            ? await ctx.runAction(internal.web3.quoteSocketSwap, request)
            : await ctx.runAction(internal.web3.prepareSocketSwap, request),
          200,
        )
      }
      case 'prepare_execution':
      case 'prepare_eoa_execution': {
        const sugarAction = str('sugarAction')
        const sugarParameters = params.parameters
        if (
          !isSugarTxAction(sugarAction) ||
          !sugarParameters ||
          typeof sugarParameters !== 'object' ||
          Array.isArray(sugarParameters) ||
          Object.values(sugarParameters).some(
            (value) =>
              typeof value !== 'string' &&
              typeof value !== 'number' &&
              typeof value !== 'boolean',
          )
        ) {
          return jsonResponse(
            { error: 'Invalid Sugar execution request' },
            400,
          )
        }
        return jsonResponse(
          op === 'prepare_execution'
            ? await ctx.runAction(internal.web3.prepareSugarExecution, {
                userId,
                ...(typeof body.jobRunId === 'string'
                  ? {
                      jobRunId: body.jobRunId as Id<'agentJobRuns'>,
                    }
                  : {}),
                ...actionContext,
                sugarAction,
                parameters: sugarParameters as Record<
                  string,
                  string | number | boolean
                >,
              })
            : await ctx.runAction(internal.web3.prepareEoaSugarExecution, {
                userId,
                ...actionContext,
                chainId:
                  typeof params.chainId === 'number' ? params.chainId : 0,
                sugarAction,
                parameters: sugarParameters as Record<
                  string,
                  string | number | boolean
                >,
              }),
          200,
        )
      }
      case 'action_status': {
        const status = await ctx.runQuery(internal.web3Actions.getForUser, {
          userId,
          actionId: str('actionId') as Id<'web3Actions'>,
        })
        return jsonResponse(
          status ?? { error: 'Unknown action for this user' },
          status ? 200 : 404,
        )
      }
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Web3 request failed'
    return jsonResponse({ error: message }, 400)
  }
})
