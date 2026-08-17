import { join } from 'node:path'
import type { Address, Hex } from 'viem'
import { SUPPORTED_CHAIN_IDS } from './config'
import type { UnsignedTransaction } from './types'
import {
  deleteWalletConnectRecord,
  loadWalletConnectRecord,
  saveWalletConnectRecord,
  walletDir,
  type WalletConnectRecord,
} from './wallet'

/**
 * WalletConnect v2 pairing for the CLI: the QR code (or copied wc: URI) links
 * a browser-extension or mobile wallet, which then signs and broadcasts every
 * transaction itself. The CLI never sees a private key on this path.
 */

const METADATA = {
  name: 'sugar-ts (aero CLI)',
  description: 'Aerodrome/Velodrome CLI built on the BeeGreat Sugar SDK',
  url: 'https://github.com/velodrome-finance/sdk.js',
  icons: ['https://raw.githubusercontent.com/velodrome-finance/sdk.js/main/sugar.png'],
}

type SignClientInstance = Awaited<ReturnType<(typeof import('@walletconnect/sign-client'))['SignClient']['init']>>

export function walletConnectProjectId(): string {
  const projectId = process.env.WALLETCONNECT_PROJECT_ID ?? process.env.REOWN_PROJECT_ID
  if (!projectId) {
    throw new Error('WalletConnect needs a project id: set WALLETCONNECT_PROJECT_ID (free at https://dashboard.reown.com)')
  }
  return projectId
}

async function initSignClient(): Promise<SignClientInstance> {
  const { SignClient } = await import('@walletconnect/sign-client')
  return SignClient.init({
    projectId: walletConnectProjectId(),
    metadata: METADATA,
    storageOptions: { database: join(walletDir(), 'walletconnect') },
  })
}

function accountsToRecord(topic: string, accounts: string[], peer?: string): WalletConnectRecord {
  const parsed = accounts.map((account) => {
    const [, chain, address] = account.split(':')
    return { chain: Number(chain), address: address as Address }
  })
  if (parsed.length === 0) throw new Error('wallet approved the session without any account')
  return {
    version: 1,
    topic,
    address: parsed[0].address,
    chains: [...new Set(parsed.map((item) => item.chain))],
    peer,
  }
}

export async function connectWalletConnect(
  log: (line: string) => void = console.log,
  chainId = 8453,
): Promise<WalletConnectRecord> {
  const client = await initSignClient()
  const optionalChains = SUPPORTED_CHAIN_IDS.filter((chain) => chain !== chainId)
  const { uri, approval } = await client.connect({
    requiredNamespaces: {
      eip155: {
        methods: ['eth_sendTransaction'],
        chains: [`eip155:${chainId}`],
        events: ['accountsChanged', 'chainChanged'],
      },
    },
    optionalNamespaces: {
      eip155: {
        methods: ['eth_sendTransaction', 'personal_sign', 'eth_signTypedData_v4'],
        chains: optionalChains.map((chain) => `eip155:${chain}`),
        events: ['accountsChanged', 'chainChanged'],
      },
    },
  })
  if (!uri) throw new Error('WalletConnect did not produce a pairing URI')
  const { renderUnicodeCompact } = await import('uqr')
  log('Scan with your wallet app, or paste the URI into a WalletConnect-capable extension:\n')
  log(renderUnicodeCompact(uri))
  log(`\n${uri}\n`)
  log('Waiting for wallet approval...')
  const session = await approval()
  const record = accountsToRecord(session.topic, session.namespaces.eip155?.accounts ?? [], session.peer.metadata.name)
  saveWalletConnectRecord(record)
  return record
}

export async function walletConnectSendTransaction(
  transaction: UnsignedTransaction,
  chainId: number,
  log: (line: string) => void = console.log,
): Promise<Hex> {
  const record = loadWalletConnectRecord()
  if (!record) throw new Error('no WalletConnect session; run: wallet connect')
  const client = await initSignClient()
  const session = client.session.getAll().find((item) => item.topic === record.topic)
  if (!session) {
    deleteWalletConnectRecord()
    throw new Error('the WalletConnect session expired; run: wallet connect')
  }
  log('Approve the transaction in your wallet...')
  const hash = await client.request<Hex>({
    topic: record.topic,
    chainId: `eip155:${chainId}`,
    request: {
      method: 'eth_sendTransaction',
      params: [{
        from: transaction.from,
        to: transaction.to,
        data: transaction.data,
        value: `0x${transaction.value.toString(16)}`,
      }],
    },
  })
  return hash
}

export async function disconnectWalletConnect(): Promise<boolean> {
  const record = loadWalletConnectRecord()
  if (!record) return false
  try {
    const client = await initSignClient()
    await client.disconnect({
      topic: record.topic,
      reason: { code: 6000, message: 'User disconnected' },
    })
  } catch { /* the relay session may already be gone; local cleanup still applies */ }
  deleteWalletConnectRecord()
  return true
}
