'use node'

import {
  CrossmintWallets,
  EVMWallet,
  WalletNotAvailableError,
  createCrossmint,
} from '@crossmint/wallets-sdk'
import { executeSugarAction, executeSugarActionJson } from '@beegreat/sugar'
import {
  SUGAR_ACTIONS,
  SUGAR_TX_ACTIONS,
  type SugarAction,
} from '@beegreat/sugar/contracts'
import { v } from 'convex/values'
import { internal } from './_generated/api'
import { env, internalAction } from './_generated/server'
import type { ActionCtx } from './_generated/server'
import type { Doc, Id } from './_generated/dataModel'
import {
  SOCKET_CHAINS,
  createSocketApiConfig,
  explorerTransactionUrl,
  getSocketQuote,
  getSocketStatus,
  type SocketApiConfig,
  type SocketChain,
  type SocketRouteStatus,
  type SocketToken,
} from './socketSwap'
import {
  normalizeSugarAgentParameters,
  sugarRuntimeEnvironment,
} from './sugarRuntime'

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

const BASE_MAINNET_CHAIN_ID = 8453

const SUGAR_CHAIN_NAMES: Record<number, string> = {
  10: 'Optimism',
  130: 'Unichain',
  252: 'Fraxtal',
  1135: 'Lisk',
  1868: 'Soneium',
  5330: 'Superseed',
  8453: 'Base',
  34443: 'Mode',
  42220: 'Celo',
  57073: 'Ink',
}

/** Re-quote a confirmed Socket route unless it will outlive execution. */
const SOCKET_QUOTE_REFRESH_BUFFER_MS = 15_000

function sugarEnvironment() {
  return sugarRuntimeEnvironment(env)
}

type RequiredWeb3Env =
  'CROSSMINT_API_KEY' | 'CROSSMINT_SIGNER_SECRET' | 'SOCKET_API_KEY'

function requireEnv(name: RequiredWeb3Env) {
  const value = env[name]?.trim()
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

type CrossmintWalletChain = 'base' | 'arbitrum' | 'base-sepolia'

function requestedWalletChain(chain?: SocketChain): CrossmintWalletChain {
  if (!chain) return walletChain()
  if (!isProduction()) {
    throw new Error(
      'Base and Arbitrum transfers require a production Crossmint key.',
    )
  }
  return SOCKET_CHAINS[chain].crossmintChain
}

function socketApiConfig(): SocketApiConfig {
  return createSocketApiConfig(env.SOCKET_API_KEY)
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
async function walletForUser(
  userId: string,
  chain: CrossmintWalletChain = walletChain(),
) {
  const crossmint = createCrossmint({
    apiKey: requireEnv('CROSSMINT_API_KEY'),
  })
  const wallets = CrossmintWallets.from(crossmint)
  const secret = requireEnv('CROSSMINT_SIGNER_SECRET')
  const owner = `userId:${userId}`
  const wallet = await wallets.getWallet(owner, { chain }).catch((error) => {
    if (!(error instanceof WalletNotAvailableError)) throw error
    return wallets.createWallet({
      chain,
      owner,
      recovery: { type: 'server', secret },
    })
  })
  await wallet.useSigner({ type: 'server', secret })
  return wallet
}

/** Resolve the smart wallet and refresh the DB cache in one step. */
async function cachedWalletForUser(
  ctx: ActionCtx,
  userId: string,
  chain: CrossmintWalletChain = walletChain(),
) {
  const wallet = await walletForUser(userId, chain)
  await ctx.runMutation(internal.wallets.cacheWallet, {
    userId,
    chain,
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
  args: {
    userId: v.string(),
    chain: v.optional(v.union(v.literal('base'), v.literal('arbitrum'))),
  },
  handler: async (
    ctx,
    { userId, chain },
  ): Promise<{
    address: string
    chain: string
    eth: string
    usdc: string
    otherTokens: Array<{ symbol: string; amount: string }>
  }> => {
    await requireWeb3(ctx, userId)
    const selectedChain = requestedWalletChain(chain)
    const wallet = await cachedWalletForUser(ctx, userId, selectedChain)
    const balances = await wallet.balances(isProduction() ? [] : ['usdxm'])
    return {
      address: wallet.address,
      chain: selectedChain,
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

const socketChainValidator = v.union(v.literal('base'), v.literal('arbitrum'))
const socketTokenValidator = v.union(v.literal('eth'), v.literal('usdc'))

async function socketWalletsForUser(
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

async function quoteSocketSwapForUser(
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

/** Agent-facing note matching whether YOLO auto-approved the action. */
function preparedNote(autoConfirmed: boolean) {
  return autoConfirmed
    ? 'YOLO mode auto-approved this action and execution has started. Do not ask the user to confirm; you will receive a web3.action_settled event when it finishes.'
    : 'Nothing has moved. The user must confirm this action in the app before it executes.'
}

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
  handler: async (ctx, args) => {
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
  },
})

/** Create a fresh Socket route and place it behind the client confirmation gate. */
export const prepareSocketSwap = internalAction({
  args: {
    userId: v.string(),
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
  handler: async (ctx, args) => {
    const { quote, walletAddress } = await quoteSocketSwapForUser(ctx, args)
    const originName = SOCKET_CHAINS[quote.originChain].displayName
    const destinationName = SOCKET_CHAINS[quote.destinationChain].displayName
    const summary = `Swap ${quote.inputAmount} ${quote.inputToken.toUpperCase()} on ${originName} for at least ${quote.minimumOutputAmount} ${quote.outputToken.toUpperCase()} on ${destinationName} via ${quote.provider}`
    // The confirmation window is the full action TTL, not the ~60s quote
    // lifetime: if the quote goes stale before execution, the executor
    // re-fetches a fresh route and refreshSocketRoute enforces the
    // confirmed minimum output.
    const created: {
      id: Id<'web3Actions'>
      expiresAt: number
      autoConfirmed: boolean
    } = await ctx.runMutation(internal.web3Actions.create, {
      userId: args.userId,
      summary,
      payload: {
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
        ...(quote.approval ? { approval: quote.approval } : {}),
        transaction: quote.transaction,
      },
    })
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
  },
})

const EVM_ADDRESS = /^0x[0-9a-fA-F]{40}$/
const DECIMAL_AMOUNT = /^(?:\d+\.?\d*|\.\d+)$/

/**
 * Phase one of sending tokens: validate and store a pending action. Nothing
 * moves until an authenticated client confirms it.
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
    const created: { id: string; expiresAt: number; autoConfirmed: boolean } =
      await ctx.runMutation(internal.web3Actions.create, {
        userId,
        summary,
        payload: {
          kind: 'send_tokens',
          recipient: cleanRecipient,
          token: normalizedToken,
          amount: cleanAmount,
        },
      })
    return {
      actionId: created.id,
      expiresAt: created.expiresAt,
      summary,
      from: wallet.address,
      status: created.autoConfirmed
        ? ('confirmed' as const)
        : ('pending' as const),
      autoConfirmed: created.autoConfirmed,
      note: preparedNote(created.autoConfirmed),
    }
  },
})

/** Compact human summary of the user-relevant Sugar parameters. */
function describeSugarExecution(
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

function executableSugarTransactions(plan: unknown) {
  const steps = (Array.isArray(plan) ? plan : [plan]).filter(
    (step): step is { to: string; data: string; value?: string } =>
      typeof step === 'object' &&
      step !== null &&
      typeof (step as { to?: unknown }).to === 'string' &&
      typeof (step as { data?: unknown }).data === 'string',
  )
  if (steps.length === 0) {
    throw new Error(
      'Sugar returned no executable transactions for this request.',
    )
  }
  return steps.map((step) => ({
    to: step.to,
    data: step.data,
    value: typeof step.value === 'string' ? step.value : '0',
  }))
}

/**
 * Phase one of executing a Sugar plan with the smart wallet: build the plan
 * server-side from an allowlisted action (the agent never supplies raw
 * calldata), then store it as a pending action awaiting client confirmation.
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
    const plan = await executeSugarAction(sugarAction, planParameters, {
      env: sugarEnvironment(),
    })
    const transactions = executableSugarTransactions(plan)
    const summary = describeSugarExecution(sugarAction, parameters)
    const created: { id: string; expiresAt: number; autoConfirmed: boolean } =
      await ctx.runMutation(internal.web3Actions.create, {
        userId,
        summary,
        payload: {
          kind: 'execute_plan',
          chainId: BASE_MAINNET_CHAIN_ID,
          transactions,
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
  },
})

/**
 * Build an allowlisted Sugar transaction plan for the verified linked EOA.
 * The client-side WalletConnect provider is the only signer and broadcaster.
 */
export const prepareEoaSugarExecution = internalAction({
  args: {
    userId: v.string(),
    chainId: v.number(),
    sugarAction: v.union(...SUGAR_TX_ACTIONS.map((name) => v.literal(name))),
    parameters: v.record(
      v.string(),
      v.union(v.string(), v.number(), v.boolean()),
    ),
  },
  handler: async (ctx, { userId, chainId, sugarAction, parameters }) => {
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
      { env: sugarEnvironment() },
    )
    const transactions = executableSugarTransactions(plan)
    const summary = describeSugarExecution(sugarAction, parameters, {
      chainName,
      walletLabel: 'your linked wallet',
    })
    const created: { id: string; expiresAt: number; autoConfirmed: boolean } =
      await ctx.runMutation(internal.web3Actions.create, {
        userId,
        summary,
        payload: {
          kind: 'execute_eoa_plan',
          chainId,
          walletAddress: wallets.eoa.address,
          transactions,
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
  },
})

/**
 * Smart-wallet phase two: runs only after user authorization — a signed-in app
 * tap, an exact action-bound iMessage decision, or the user's standing YOLO
 * opt-in applied at creation — never from the agent. EOA actions are rejected
 * here because only the connected client wallet may sign them.
 */
export const executeConfirmedAction = internalAction({
  args: { actionId: v.id('web3Actions') },
  handler: async (ctx, { actionId }) => {
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
        const chain =
          action.payload.chainId === SOCKET_CHAINS.arbitrum.chainId
            ? ('arbitrum' as const)
            : action.payload.chainId === BASE_MAINNET_CHAIN_ID
              ? ('base' as const)
              : null
        if (!chain)
          throw new Error('The confirmed plan targets an unsupported chain.')
        const wallet = await walletForUser(action.userId, chain)
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
        if (payload.approval) {
          const approval = await evmWallet.sendTransaction({
            to: payload.approval.tokenAddress,
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
          })
          results.push({
            hash: approval.hash ?? null,
            explorerLink: approval.explorerLink ?? null,
          })
        }
        const transaction = await evmWallet.sendTransaction({
          to: payload.transaction.to,
          data: payload.transaction.data as `0x${string}`,
          value: BigInt(payload.transaction.value),
        })
        results.push({
          hash: transaction.hash ?? null,
          explorerLink: transaction.explorerLink ?? null,
        })
        await ctx.runMutation(internal.web3Actions.recordSocketSubmitted, {
          actionId,
          result: results,
          ...(transaction.hash ? { originTxHash: transaction.hash } : {}),
        })
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
  },
})

function socketStatusDetail(
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

/** Poll Socket until destination settlement reaches a terminal state. */
export const pollSocketSwapStatus = internalAction({
  args: { actionId: v.id('web3Actions') },
  returns: v.null(),
  handler: async (ctx, { actionId }) => {
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
      await ctx.runMutation(internal.web3Actions.recordSocketProgress, {
        actionId,
        progress: {
          status: 'EXPIRED',
          detail:
            'Destination settlement could not be confirmed before the monitoring window closed.',
          ...(action.socketProgress?.originTxHash
            ? { originTxHash: action.socketProgress.originTxHash }
            : {}),
          updatedAt: Date.now(),
        },
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
      await ctx.runMutation(internal.web3Actions.recordSocketProgress, {
        actionId,
        progress: {
          status: status.status,
          detail: socketStatusDetail(
            status.status,
            action.payload.destinationChain,
          ),
          ...(status.originTxHash
            ? { originTxHash: status.originTxHash }
            : action.socketProgress?.originTxHash
              ? { originTxHash: action.socketProgress.originTxHash }
              : {}),
          ...(status.destinationTxHash
            ? { destinationTxHash: status.destinationTxHash }
            : {}),
          ...(destinationExplorerLink ? { destinationExplorerLink } : {}),
          updatedAt: Date.now(),
        },
        ...(result.length > 0 ? { result } : {}),
      })
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

    // Convex app configuration is typed explicitly. Forward only allowlisted
    // Sugar settings instead of exposing Node's ambient process.env.
    return executeSugarActionJson(
      sugarAction as SugarAction,
      normalizeSugarAgentParameters(parameters),
      { env: sugarEnvironment() },
    )
  },
})
