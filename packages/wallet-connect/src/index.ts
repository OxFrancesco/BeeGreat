export type Eip1193Request = {
  method: string
  params?: readonly unknown[] | object
}

/** The small provider interface shared by injected wallets and WalletConnect. */
export type Eip1193Provider = {
  request<T = unknown>(request: Eip1193Request): Promise<T>
}

export type EoaTransaction = {
  to: string
  data: string
  /** Unsigned base-10 wei from BeeGreat's server-owned action payload. */
  value: string
}

export type SubmittedTransaction = {
  index: number
  hash: string
}

export type ConfirmedTransaction = SubmittedTransaction

export type EoaTransactionStep = {
  role: 'approval' | 'action'
  transaction: EoaTransaction
}

export type SubmittedFreshTransaction = SubmittedTransaction & {
  role: EoaTransactionStep['role']
}

export type ReceiptPollingOptions = {
  intervalMs?: number
  timeoutMs?: number
}

const EVM_ADDRESS = /^0x[0-9a-fA-F]{40}$/
const EVM_DATA = /^0x(?:[0-9a-fA-F]{2})*$/
const EVM_HASH = /^0x[0-9a-fA-F]{64}$/

export function sameEvmAddress(left: string, right: string) {
  return left.toLowerCase() === right.toLowerCase()
}

export function chainIdHex(chainId: number) {
  if (!Number.isSafeInteger(chainId) || chainId <= 0) {
    throw new Error('BeeGreat received an invalid EVM chain.')
  }
  return `0x${chainId.toString(16)}`
}

export function weiHex(value: string) {
  if (!/^\d+$/.test(value)) {
    throw new Error('BeeGreat received an invalid transaction value.')
  }
  return `0x${BigInt(value).toString(16)}`
}

export async function signWalletLink(
  provider: Eip1193Provider,
  address: string,
  message: string,
) {
  assertAddress(address)
  if (!message.trim()) throw new Error('The wallet-link request is empty.')
  return await provider.request<string>({
    method: 'personal_sign',
    params: [message, address],
  })
}

/**
 * Switch to the server-pinned chain, verify the active account, then submit
 * each server-built transaction in order. The wallet remains the signer and
 * shows its own approval UI for every request.
 */
export async function sendEoaTransactions({
  provider,
  address,
  chainId,
  transactions,
  onSubmitted,
  onConfirmed,
  receiptPolling,
}: {
  provider: Eip1193Provider
  address: string
  chainId: number
  transactions: readonly EoaTransaction[]
  onSubmitted?: (transaction: SubmittedTransaction) => void | Promise<void>
  onConfirmed?: (transaction: ConfirmedTransaction) => void | Promise<void>
  receiptPolling?: ReceiptPollingOptions
}) {
  assertAddress(address)
  if (transactions.length === 0) {
    throw new Error('BeeGreat received an empty transaction plan.')
  }

  await provider.request({
    method: 'wallet_switchEthereumChain',
    params: [{ chainId: chainIdHex(chainId) }],
  })

  const accounts = await provider.request<string[]>({ method: 'eth_accounts' })
  const activeAddress = accounts[0]
  if (!activeAddress || !sameEvmAddress(activeAddress, address)) {
    throw new Error(
      'Connect the wallet shown in this confirmation and try again.',
    )
  }

  const submitted: SubmittedTransaction[] = []
  for (const [index, transaction] of transactions.entries()) {
    assertTransaction(transaction)
    const hash = await provider.request<string>({
      method: 'eth_sendTransaction',
      params: [
        {
          from: address,
          to: transaction.to,
          data: transaction.data,
          value: weiHex(transaction.value),
        },
      ],
    })
    if (!EVM_HASH.test(hash)) {
      throw new Error('The wallet returned an invalid transaction hash.')
    }
    const result = { index, hash }
    submitted.push(result)
    await onSubmitted?.(result)
    await waitForSuccessfulReceipt(provider, hash, receiptPolling)
    await onConfirmed?.(result)
  }
  return submitted
}

/**
 * Submit one prerequisite at a time and ask the server for a fresh plan after
 * every receipt. This keeps allowance state, quotes, deadlines, and minimums
 * current before the wallet signs the final action.
 */
export async function sendFreshEoaTransactions({
  provider,
  address,
  chainId,
  buildPlan,
  onSubmitted,
  onConfirmed,
  receiptPolling,
  maxBuilds = 8,
}: {
  provider: Eip1193Provider
  address: string
  chainId: number
  buildPlan: () => Promise<readonly EoaTransactionStep[]>
  onSubmitted?: (transaction: SubmittedFreshTransaction) => void | Promise<void>
  onConfirmed?: (transaction: SubmittedFreshTransaction) => void | Promise<void>
  receiptPolling?: ReceiptPollingOptions
  maxBuilds?: number
}) {
  assertAddress(address)
  await provider.request({
    method: 'wallet_switchEthereumChain',
    params: [{ chainId: chainIdHex(chainId) }],
  })
  const accounts = await provider.request<string[]>({ method: 'eth_accounts' })
  const activeAddress = accounts[0]
  if (!activeAddress || !sameEvmAddress(activeAddress, address)) {
    throw new Error(
      'Connect the wallet shown in this confirmation and try again.',
    )
  }

  const submitted: SubmittedFreshTransaction[] = []
  for (let build = 0; build < maxBuilds; build += 1) {
    const plan = [...(await buildPlan())]
    if (
      plan.length === 0 ||
      plan.filter(({ role }) => role === 'action').length !== 1 ||
      plan.at(-1)?.role !== 'action'
    ) {
      throw new Error('BeeGreat received an invalid fresh transaction plan.')
    }
    plan.forEach(({ transaction }) => assertTransaction(transaction))
    const step = plan.find(({ role }) => role === 'approval') ?? plan.at(-1)!
    const hash = await provider.request<string>({
      method: 'eth_sendTransaction',
      params: [
        {
          from: address,
          to: step.transaction.to,
          data: step.transaction.data,
          value: weiHex(step.transaction.value),
        },
      ],
    })
    if (!EVM_HASH.test(hash)) {
      throw new Error('The wallet returned an invalid transaction hash.')
    }
    const result = { index: submitted.length, hash, role: step.role }
    submitted.push(result)
    await onSubmitted?.(result)
    await waitForSuccessfulReceipt(provider, hash, receiptPolling)
    await onConfirmed?.(result)
    if (step.role === 'action') return submitted
  }
  throw new Error(
    'The wallet plan still requires approvals after repeated refreshes.',
  )
}

async function waitForSuccessfulReceipt(
  provider: Eip1193Provider,
  hash: string,
  options: ReceiptPollingOptions = {},
) {
  const timeoutMs = options.timeoutMs ?? 120_000
  const intervalMs = options.intervalMs ?? 1_500
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new Error('Transaction receipt timeout must be positive.')
  }
  if (!Number.isFinite(intervalMs) || intervalMs < 0) {
    throw new Error('Transaction receipt interval must not be negative.')
  }
  const deadline = Date.now() + timeoutMs
  while (Date.now() <= deadline) {
    const receipt = await provider.request<{ status?: string } | null>({
      method: 'eth_getTransactionReceipt',
      params: [hash],
    })
    if (receipt) {
      if (receipt.status === '0x1') return receipt
      if (receipt.status === '0x0') {
        throw new Error(`Wallet transaction ${hash} reverted on-chain.`)
      }
      throw new Error(`Wallet transaction ${hash} returned an invalid receipt.`)
    }
    if (intervalMs > 0) {
      await new Promise<void>((resolve) => setTimeout(resolve, intervalMs))
    }
  }
  throw new Error(`Timed out waiting for wallet transaction ${hash}.`)
}

function assertAddress(address: string) {
  if (!EVM_ADDRESS.test(address)) {
    throw new Error('BeeGreat received an invalid wallet address.')
  }
}

function assertTransaction(transaction: EoaTransaction) {
  assertAddress(transaction.to)
  if (!EVM_DATA.test(transaction.data)) {
    throw new Error('BeeGreat received invalid transaction data.')
  }
  weiHex(transaction.value)
}
