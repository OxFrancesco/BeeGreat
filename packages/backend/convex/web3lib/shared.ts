// Internal helpers shared by the web3 power-up subsystems (Crossmint wallet
// lifecycle, Sugar SDK execution, Socket cross-chain orchestration). This
// module exports plain TypeScript only — no Convex functions — so it never
// appears as an api path.

import { internal } from '../_generated/api'
import { env } from '../_generated/server'
import type { ActionCtx } from '../_generated/server'
import {
  SOCKET_CHAINS,
  createSocketApiConfig,
  type SocketApiConfig,
  type SocketChain,
} from '../socketSwap'

export const BASE_MAINNET_CHAIN_ID = 8453

export const SUGAR_CHAIN_NAMES: Record<number, string> = {
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
export const SOCKET_QUOTE_REFRESH_BUFFER_MS = 15_000

type RequiredWeb3Env =
  'CROSSMINT_API_KEY' | 'CROSSMINT_SIGNER_SECRET' | 'SOCKET_API_KEY'

export function requireEnv(name: RequiredWeb3Env) {
  const value = env[name]?.trim()
  if (!value) {
    throw new Error(
      `${name} is not configured. Set it with \`bunx convex env set ${name} ...\`.`,
    )
  }
  return value
}

/** Production Crossmint keys run mainnet; everything else stays on staging. */
export function isProduction() {
  return requireEnv('CROSSMINT_API_KEY').startsWith('sk_production')
}

/** The smart-wallet chain, derived from the API key environment. */
export function walletChain() {
  return isProduction() ? ('base' as const) : ('base-sepolia' as const)
}

export type CrossmintWalletChain = 'base' | 'arbitrum' | 'base-sepolia'

export function requestedWalletChain(chain?: SocketChain): CrossmintWalletChain {
  if (!chain) return walletChain()
  if (!isProduction()) {
    throw new Error(
      'Base and Arbitrum transfers require a production Crossmint key.',
    )
  }
  return SOCKET_CHAINS[chain].crossmintChain
}

export function socketApiConfig(): SocketApiConfig {
  return createSocketApiConfig(env.SOCKET_API_KEY)
}

export async function requireWeb3(ctx: ActionCtx, userId: string) {
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

/** Agent-facing note matching whether YOLO auto-approved the action. */
export function preparedNote(autoConfirmed: boolean) {
  return autoConfirmed
    ? 'YOLO mode auto-approved this action and execution has started. Do not ask the user to confirm; you will receive a web3.action_settled event when it finishes.'
    : 'Nothing has moved. The user must confirm this action in the app before it executes.'
}

export const EVM_ADDRESS = /^0x[0-9a-fA-F]{40}$/
export const DECIMAL_AMOUNT = /^(?:\d+\.?\d*|\.\d+)$/
