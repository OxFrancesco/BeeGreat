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
}: {
  provider: Eip1193Provider
  address: string
  chainId: number
  transactions: readonly EoaTransaction[]
  onSubmitted?: (transaction: SubmittedTransaction) => void | Promise<void>
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
  }
  return submitted
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
