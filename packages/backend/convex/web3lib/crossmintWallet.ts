'use node'

// Crossmint smart-wallet lifecycle: idempotent wallet resolution, balance and
// activity reads, the staging faucet, and phase one of sending tokens. Plain
// TypeScript helpers only — the Convex function definitions live in web3.ts.

import {
  CrossmintWallets,
  WalletNotAvailableError,
  createCrossmint,
} from '@crossmint/wallets-sdk'
import type { FunctionArgs } from 'convex/server'
import { internal } from '../_generated/api'
import type { ActionCtx } from '../_generated/server'
import {
  DECIMAL_AMOUNT,
  EVM_ADDRESS,
  isProduction,
  preparedNote,
  requestedWalletChain,
  requireEnv,
  requireWeb3,
  walletChain,
  type CrossmintWalletChain,
} from './shared'
import type { SocketChain } from '../socketSwap'

/**
 * Idempotent get-or-create: Crossmint returns the existing wallet when one
 * already exists for this owner, and the server signer re-derives to the
 * same address every time.
 */
export async function walletForUser(
  userId: string,
  chain: CrossmintWalletChain = walletChain(),
) {
  const crossmint = createCrossmint({
    apiKey: requireEnv('CROSSMINT_API_KEY'),
  })
  const wallets = CrossmintWallets.from(crossmint)
  const secret = requireEnv('CROSSMINT_SIGNER_SECRET')
  const owner = `userId:${userId}`
  // Wallet locators require the chain type and wallet type suffix; the owner
  // string passed to createWallet must stay bare (`userId:<id>`).
  const locator = `${owner}:evm:smart`
  const wallet = await wallets.getWallet(locator, { chain }).catch((error) => {
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
export async function cachedWalletForUser(
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

export async function getOrCreateWalletForUser(ctx: ActionCtx, userId: string) {
  await requireWeb3(ctx, userId)
  const wallet = await cachedWalletForUser(ctx, userId)
  return {
    address: wallet.address,
    chain: walletChain(),
    owner: `userId:${userId}`,
  }
}

export async function getBalancesForUser(
  ctx: ActionCtx,
  { userId, chain }: { userId: string; chain?: SocketChain },
): Promise<{
  address: string
  chain: string
  eth: string
  usdc: string
  otherTokens: Array<{ symbol: string; amount: string }>
}> {
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
}

export async function getActivityForUser(ctx: ActionCtx, userId: string) {
  await requireWeb3(ctx, userId)
  const wallet = await cachedWalletForUser(ctx, userId)
  const activity = await wallet.transactions()
  return JSON.stringify(activity)
}

export async function fundWalletForUser(
  ctx: ActionCtx,
  { userId, amount }: { userId: string; amount: number },
) {
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
}

export async function prepareSendTokensForUser(
  ctx: ActionCtx,
  {
    userId,
    conversationId,
    continuation,
    recipient,
    token,
    amount,
  }: {
    userId: string
    conversationId?: string
    continuation?: string
    recipient: string
    token: string
    amount: string
  },
) {
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
  const createArgs: FunctionArgs<typeof internal.web3Actions.create> = {
    userId,
    summary,
    payload: {
      kind: 'send_tokens',
      recipient: cleanRecipient,
      token: normalizedToken,
      amount: cleanAmount,
    },
  }
  if (conversationId) createArgs.conversationId = conversationId
  if (continuation) createArgs.continuation = continuation
  const created: { id: string; expiresAt: number; autoConfirmed: boolean } =
    await ctx.runMutation(internal.web3Actions.create, createArgs)
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
}
