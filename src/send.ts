import type { Address, Hex, PublicClient } from 'viem'
import { createPublicClient, createWalletClient, defineChain, http } from 'viem'
import { mnemonicToAccount } from 'viem/accounts'
import { getChainSettings } from './config'
import type { SugarTxAction } from './contracts'
import type { SugarJson, UnsignedTransaction } from './types'

/**
 * Signing and broadcasting for the CLI's wallet-connected flow. Plans still
 * come from the non-signing Sugar action layer; this module only turns an
 * already-printed plan into sequential on-chain transactions.
 */

export type PlanStep = { role: 'approval' | 'action'; transaction: UnsignedTransaction }

export type PlanSigner = {
  address: Address
  describe: string
  send: (transaction: UnsignedTransaction, chainId: number) => Promise<Hex>
}

function asRecord(value: SugarJson): Record<string, SugarJson> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('unexpected Sugar plan shape')
  }
  return value
}

/** Rehydrate the JSON plan (bigints were stringified by toSugarJson). */
export function extractPlanSteps(result: SugarJson): PlanStep[] {
  const record = asRecord(result)
  const steps = record.transaction_steps
  if (!Array.isArray(steps)) throw new Error('this action did not produce a transaction plan')
  return steps.map((step) => {
    const item = asRecord(step)
    const transaction = asRecord(item.transaction)
    const role = item.role === 'approval' ? 'approval' as const : 'action' as const
    return {
      role,
      transaction: {
        from: String(transaction.from) as Address,
        to: String(transaction.to) as Address,
        data: String(transaction.data) as Hex,
        value: BigInt(String(transaction.value ?? '0')),
      },
    }
  })
}

const summaryLine = (label: string, value: SugarJson | undefined): string[] =>
  value === undefined || value === null ? [] : [`  ${label}: ${typeof value === 'object' ? JSON.stringify(value) : String(value)}`]

/** Human summary shown before the confirm prompt. */
export function renderPlanSummary(action: SugarTxAction, result: SugarJson, steps: PlanStep[]): string {
  const record = asRecord(result)
  const lines: string[] = [`Plan: ${action.replaceAll('_', '-')} (${steps.length} transaction${steps.length === 1 ? '' : 's'}${steps.length > 1 ? ', approvals first' : ''})`]
  if (action === 'swap' && record.quote) {
    const quote = asRecord(record.quote)
    const from = asRecord(quote.from_token)
    const to = asRecord(quote.to_token)
    lines.push(
      ...summaryLine('swap', `${quote.amount_in_decimal} ${from.symbol} -> ${quote.amount_out_decimal} ${to.symbol}`),
      ...summaryLine('min out', `${quote.min_amount_out_decimal} ${to.symbol} (slippage ${quote.slippage})`),
      ...summaryLine('price impact', quote.price_impact_pct === null ? undefined : `${Number(quote.price_impact_pct).toFixed(3)}%`),
    )
  }
  if (action === 'deposit' && record.deposit) {
    const deposit = asRecord(record.deposit)
    const pool = asRecord(deposit.pool)
    lines.push(
      ...summaryLine('pool', pool.symbol),
      ...summaryLine('amount0', `${deposit.amount0_decimal} ${pool.token0}`),
      ...summaryLine('amount1', `${deposit.amount1_decimal} ${pool.token1}`),
      ...summaryLine('creates pool', deposit.creates_pool === true ? 'yes' : undefined),
    )
  }
  if (action === 'withdraw' && record.withdrawal) {
    const withdrawal = asRecord(record.withdrawal)
    const pool = asRecord(withdrawal.pool)
    lines.push(
      ...summaryLine('pool', pool.symbol),
      ...summaryLine('amount0', `${withdrawal.amount0_decimal} ${pool.token0}`),
      ...summaryLine('amount1', `${withdrawal.amount1_decimal} ${pool.token1}`),
      ...summaryLine('burn', withdrawal.burn === true ? 'yes' : undefined),
    )
  }
  if (action === 'create_venft' && record.ve_nft) {
    const venft = asRecord(record.ve_nft)
    lines.push(
      ...summaryLine('lock', `${venft.amount_decimal} ${venft.governance_symbol}`),
      ...summaryLine('duration', `${venft.lock_duration_seconds}s`),
    )
  }
  if (record.position) {
    const position = asRecord(record.position)
    const pool = position.pool === undefined ? undefined : asRecord(position.pool)
    lines.push(
      ...summaryLine('position', position.id),
      ...summaryLine('pool', pool?.symbol),
    )
  }
  return lines.join('\n')
}

export function chainForSettings(chainId: number, rpcUrl?: string) {
  const settings = getChainSettings(chainId, { overrides: rpcUrl ? { rpcUrl } : undefined })
  return defineChain({
    id: settings.chainId,
    name: settings.chainName,
    nativeCurrency: { name: settings.nativeTokenSymbol, symbol: settings.nativeTokenSymbol, decimals: settings.nativeTokenDecimals },
    rpcUrls: { default: { http: [settings.rpcUrl] } },
  })
}

export function localMnemonicSigner(mnemonic: string, rpcUrl?: string): PlanSigner {
  const account = mnemonicToAccount(mnemonic)
  return {
    address: account.address,
    describe: 'local wallet',
    send: async (transaction, chainId) => {
      const chain = chainForSettings(chainId, rpcUrl)
      const client = createWalletClient({ account, chain, transport: http() })
      return client.sendTransaction({
        to: transaction.to,
        data: transaction.data,
        value: transaction.value,
      })
    },
  }
}

export type SendPlanOptions = {
  steps: PlanStep[]
  chainId: number
  signer: PlanSigner
  rpcUrl?: string
  log?: (line: string) => void
  publicClient?: PublicClient
}

export async function sendPlan(options: SendPlanOptions): Promise<Hex[]> {
  const { steps, chainId, signer, rpcUrl, log = console.log } = options
  const publicClient = options.publicClient
    ?? createPublicClient({ chain: chainForSettings(chainId, rpcUrl), transport: http() })
  const hashes: Hex[] = []
  for (const [index, step] of steps.entries()) {
    const label = `[${index + 1}/${steps.length}] ${step.role}`
    log(`${label}: sending via ${signer.describe}...`)
    const hash = await signer.send(step.transaction, chainId)
    hashes.push(hash)
    log(`${label}: ${hash} (waiting for confirmation)`)
    const receipt = await publicClient.waitForTransactionReceipt({ hash })
    if (receipt.status !== 'success') {
      throw new Error(`${label} reverted on-chain: ${hash}`)
    }
    log(`${label}: confirmed in block ${receipt.blockNumber}`)
  }
  return hashes
}
