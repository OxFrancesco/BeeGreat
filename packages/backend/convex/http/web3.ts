import { isSugarAction, isSugarTxAction } from '@beegreat/sugar/contracts'
import type { FunctionArgs } from 'convex/server'
import * as Effect from 'effect/Effect'
import * as Schema from 'effect/Schema'
import * as SchemaGetter from 'effect/SchemaGetter'
import { internal } from '../_generated/api'
import { httpAction } from '../_generated/server'
import { web3ActionContext } from '../web3Actions'
import {
  AgentUserId,
  decodeRequestBody,
  jsonObjectProperty,
  jsonResponse,
  readJsonBody,
  requestDocumentId,
  requireBrokerSecret,
  type JsonValue,
} from './middleware'

const SugarParameters = Schema.Record(
  Schema.String,
  Schema.mutableKey(Schema.Union([Schema.String, Schema.Number, Schema.Boolean])),
)

const SugarRequest = Schema.Struct({
  userId: AgentUserId,
  sugarAction: Schema.String.pipe(Schema.refine(isSugarAction)),
  parameters: SugarParameters,
})

export const web3Sugar = httpAction(async (ctx, request) => {
  const authError = requireBrokerSecret(request)
  if (authError) return authError

  const raw = await readJsonBody<JsonValue>(request)
  const body = decodeRequestBody(SugarRequest, raw)
  if (!body) {
    return jsonResponse({ error: 'Invalid Sugar request' }, 400)
  }

  try {
    // The Node action runs the native TypeScript Sugar SDK directly. This
    // HTTP route remains the authenticated boundary used by the agent.
    const result: string = await ctx.runAction(internal.web3.runSugar, {
      userId: body.userId,
      sugarAction: body.sugarAction,
      parameters: body.parameters,
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

const Web3WalletRequest = Schema.Struct({
  userId: AgentUserId,
  op: Schema.Literals(WEB3_WALLET_OPS),
  params: Schema.optional(
    Schema.NullOr(
      Schema.Record(Schema.String, Schema.Unknown),
    ),
  ),
})

// Lenient reads for individual wallet params: a present value keeps its
// string/number representation and any other JSON value degrades to the
// same fallback the previous per-field reads produced.
const CoercedEmptyString = Schema.Unknown.pipe(
  Schema.decodeTo(Schema.Literal(''), {
    decode: SchemaGetter.transform(() => '' as const),
    encode: SchemaGetter.transform(() => '' as const),
  }),
)
const LenientString = Schema.Union([Schema.String, CoercedEmptyString]).pipe(
  Schema.withDecodingDefaultType(Effect.succeed('')),
)
const CoercedZero = Schema.Unknown.pipe(
  Schema.decodeTo(Schema.Literal(0), {
    decode: SchemaGetter.transform(() => 0 as const),
    encode: SchemaGetter.transform(() => 0 as const),
  }),
)
const LenientNumber = Schema.Union([Schema.Number, CoercedZero]).pipe(
  Schema.withDecodingDefaultType(Effect.succeed(0)),
)

const WalletStringParams = Schema.Struct({
  chain: LenientString,
  recipient: LenientString,
  token: LenientString,
  amount: LenientString,
  originChain: LenientString,
  destinationChain: LenientString,
  inputToken: LenientString,
  outputToken: LenientString,
  sugarAction: LenientString,
  actionId: LenientString,
})

const WalletNumberParams = Schema.Struct({
  amount: LenientNumber,
  chainId: LenientNumber,
})

const Web3ActionOrigin = Schema.Struct({
  conversationId: Schema.optional(Schema.String),
  jobRunId: Schema.optional(Schema.String),
})

const ContinuationField = Schema.Struct({
  continuation: Schema.optional(Schema.String),
})

const SugarExecutionParams = Schema.Struct({ parameters: SugarParameters })

// Authenticated bridge for every wallet-side Web3 tool. The Convex functions
// behind it are internal on purpose: agent identity is the broker secret, and
// nothing here can move funds — fund movement requires either the signed-in
// app confirmation gate for the Bee wallet or the matching WalletConnect EOA
// to sign the exact pending plan.
export const web3Wallet = httpAction(async (ctx, request) => {
  const authError = requireBrokerSecret(request)
  if (authError) return authError

  const raw = await readJsonBody<JsonValue>(request)
  const body = decodeRequestBody(Web3WalletRequest, raw)
  if (!body) {
    return jsonResponse({ error: 'Invalid Web3 request' }, 400)
  }

  const userId = body.userId
  const op = body.op
  const params = jsonObjectProperty(raw, 'params') ?? {}
  const stringParams = decodeRequestBody(WalletStringParams, params)
  const numberParams = decodeRequestBody(WalletNumberParams, params)
  if (!stringParams || !numberParams) {
    return jsonResponse({ error: 'Invalid Web3 request' }, 400)
  }
  let actionContext: ReturnType<typeof web3ActionContext> = {}
  let jobRunId: string | undefined
  if (WEB3_PREPARE_OPS.has(op)) {
    const origin = decodeRequestBody(Web3ActionOrigin, raw)
    const continuationField = decodeRequestBody(ContinuationField, params)
    if (!origin || !continuationField) {
      return jsonResponse({ error: 'Invalid Web3 action origin' }, 400)
    }
    jobRunId = origin.jobRunId
    if (jobRunId !== undefined && op !== 'prepare_execution') {
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
        origin.conversationId,
        continuationField.continuation,
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
        const chain = stringParams.chain
        if (chain && chain !== 'base' && chain !== 'arbitrum') {
          return jsonResponse({ error: 'Invalid balance chain' }, 400)
        }
        const args: FunctionArgs<typeof internal.web3.getBalances> = {
          userId,
        }
        if (chain === 'base' || chain === 'arbitrum') args.chain = chain
        return jsonResponse(
          await ctx.runAction(internal.web3.getBalances, args),
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
            amount: numberParams.amount,
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
            recipient: stringParams.recipient,
            token: stringParams.token,
            amount: stringParams.amount,
          }),
          200,
        )
      case 'quote_socket_swap':
      case 'prepare_socket_swap': {
        const originChain = stringParams.originChain
        const destinationChain = stringParams.destinationChain
        const inputToken = stringParams.inputToken
        const outputToken = stringParams.outputToken
        if (
          (originChain !== 'base' && originChain !== 'arbitrum') ||
          (destinationChain !== 'base' && destinationChain !== 'arbitrum') ||
          (inputToken !== 'eth' && inputToken !== 'usdc') ||
          (outputToken !== 'eth' && outputToken !== 'usdc')
        ) {
          return jsonResponse({ error: 'Invalid Socket swap request' }, 400)
        }
        if (op === 'quote_socket_swap') {
          return jsonResponse(
            await ctx.runAction(internal.web3.quoteSocketSwap, {
              userId,
              originChain,
              destinationChain,
              inputToken,
              outputToken,
              amount: stringParams.amount,
            }),
            200,
          )
        }
        return jsonResponse(
          await ctx.runAction(internal.web3.prepareSocketSwap, {
            userId,
            ...actionContext,
            originChain,
            destinationChain,
            inputToken,
            outputToken,
            amount: stringParams.amount,
          }),
          200,
        )
      }
      case 'prepare_execution':
      case 'prepare_eoa_execution': {
        const sugarAction = stringParams.sugarAction
        const execution = decodeRequestBody(SugarExecutionParams, params)
        if (!isSugarTxAction(sugarAction) || !execution) {
          return jsonResponse(
            { error: 'Invalid Sugar execution request' },
            400,
          )
        }
        if (op === 'prepare_execution') {
          const args: FunctionArgs<
            typeof internal.web3.prepareSugarExecution
          > = {
            userId,
            ...actionContext,
            sugarAction,
            parameters: execution.parameters,
          }
          if (jobRunId !== undefined) {
            args.jobRunId = requestDocumentId<'agentJobRuns'>(jobRunId)
          }
          return jsonResponse(
            await ctx.runAction(internal.web3.prepareSugarExecution, args),
            200,
          )
        }
        return jsonResponse(
          await ctx.runAction(internal.web3.prepareEoaSugarExecution, {
            userId,
            ...actionContext,
            chainId: numberParams.chainId,
            sugarAction,
            parameters: execution.parameters,
          }),
          200,
        )
      }
      case 'action_status': {
        const status = await ctx.runQuery(internal.web3Actions.getForUser, {
          userId,
          actionId: requestDocumentId<'web3Actions'>(stringParams.actionId),
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
