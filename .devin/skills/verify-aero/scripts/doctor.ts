import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import type { Address } from 'viem'
import {
  applyVerifyEnv,
  CHAIN_ID,
  extractLastJson,
  NVDAC,
  pidAlive,
  publicClient,
  readBalances,
  REAL_WALLET_DIR,
  repoRoot,
  rpcKind,
  runAero,
  scrub,
  type GitInfo,
  type RpcKind,
  gitInfo,
  tokenDecimals,
  verifyHome,
  type Balances,
  type VerifyLayout,
} from './lib'

/**
 * Read-only health check for the verify-aero environment. Prints one JSON
 * report and exits 0 when the setup is driveable, 1 when anything is wrong.
 */

export type DoctorReport = {
  ok: boolean
  problems: string[]
  warnings: string[]
  bun: string
  git: GitInfo
  home: string
  wallet: { present: boolean; address: string | null; dir: string }
  passphrase: boolean
  rpc: { kind: RpcKind }
  chain: { id: number | null; ok: boolean; block: string | null }
  balances: Balances | null
  ethUsd: number | null
  requiredEth: number | null
  budgetUsd: number
  journals: { files: number; active: string[]; locks: string[] }
  runLock: { present: boolean; pid: number | null; live: boolean }
  realWalletDirSafe: boolean
}

type JournalWire = { status?: string; plan?: { id?: string } }

function journalState(layout: VerifyLayout): { files: number; active: string[]; locks: string[] } {
  if (!existsSync(layout.executionsDir)) return { files: 0, active: [], locks: [] }
  const names = readdirSync(layout.executionsDir)
  const locks = names.filter((name) => name.endsWith('.lock'))
  const active: string[] = []
  let files = 0
  for (const name of names) {
    if (!/^[0-9a-f-]{36}\.json$/i.test(name)) continue
    files += 1
    try {
      const journal = JSON.parse(readFileSync(join(layout.executionsDir, name), 'utf8')) as JournalWire
      if (journal.status === 'active') active.push(journal.plan?.id ?? name.slice(0, -5))
    } catch {
      active.push(`${name.slice(0, -5)} (unreadable)`)
    }
  }
  return { files, active, locks }
}

function runLockState(layout: VerifyLayout): { present: boolean; pid: number | null; live: boolean } {
  if (!existsSync(layout.runLock)) return { present: false, pid: null, live: false }
  try {
    const parsed = JSON.parse(readFileSync(layout.runLock, 'utf8')) as { pid?: number }
    const pid = typeof parsed.pid === 'number' ? parsed.pid : null
    return { present: true, pid, live: pid !== null && pidAlive(pid) }
  } catch {
    return { present: true, pid: null, live: false }
  }
}

/** ETH quote for the budget math: from_price_usd, else the implied out rate. */
export async function ethUsdPrice(): Promise<number | null> {
  const result = await runAero(['quote', '--from-token', 'ETH', '--to-token', 'USDC', '--amount', '0.01', '--use-decimals'])
  const parsed = asRecordSafe(extractLastJson(result.stdout))
  if (parsed === null) return null
  const fromPrice = Number(parsed.from_price_usd)
  if (Number.isFinite(fromPrice) && fromPrice > 0) return fromPrice
  const out = Number(parsed.amount_out_decimal)
  return Number.isFinite(out) && out > 0 ? out / 0.01 : null
}

function asRecordSafe(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
}

export async function runDoctor(options: { budgetUsd?: number } = {}): Promise<DoctorReport> {
  const budgetUsd = options.budgetUsd ?? 0.8
  const home = verifyHome()
  const layout = applyVerifyEnv(home)
  const problems: string[] = []
  const warnings: string[] = []

  const walletFile = join(layout.walletDir, 'wallet.enc')
  const walletPresent = existsSync(walletFile)
  const passphrase = Boolean(process.env.SUGAR_WALLET_PASSPHRASE)
  const realWalletDirSafe = layout.walletDir !== REAL_WALLET_DIR

  let address: Address | null = null
  if (walletPresent) {
    const status = await runAero(['wallet', 'status'])
    const match = status.stdout.match(/0x[0-9a-fA-F]{40}/)
    address = match ? match[0] as Address : null
    if (!address) problems.push('wallet file exists but `aero wallet status` printed no address')
  } else {
    problems.push(`wallet missing: run ${join('scripts', 'setup-wallet.sh')} (home ${home})`)
  }
  if (!passphrase) problems.push('passphrase missing: no SUGAR_WALLET_PASSPHRASE and no passphrase file')
  if (!realWalletDirSafe) problems.push(`SUGAR_WALLET_DIR points at the real wallet dir ${REAL_WALLET_DIR}`)

  const client = publicClient()
  let chainId: number | null = null
  let block: bigint | null = null
  try {
    chainId = await client.getChainId()
    block = await client.getBlockNumber()
    if (chainId !== CHAIN_ID) problems.push(`wrong chain: RPC reports ${chainId}, expected ${CHAIN_ID}`)
  } catch (cause) {
    problems.push(`RPC unreachable: ${scrub(cause instanceof Error ? cause.message : String(cause))}`)
  }

  let balances: Balances | null = null
  if (address && chainId === CHAIN_ID) {
    try {
      const nvdacDecimals = await tokenDecimals(client, NVDAC)
      balances = await readBalances(client, address, nvdacDecimals)
    } catch (cause) {
      problems.push(`balance reads failed: ${scrub(cause instanceof Error ? cause.message : String(cause))}`)
    }
  }

  let ethUsd: number | null = null
  if (chainId === CHAIN_ID) {
    try {
      ethUsd = await ethUsdPrice()
    } catch (cause) {
      warnings.push(`ETH price quote failed: ${scrub(cause instanceof Error ? cause.message : String(cause))}`)
    }
    if (ethUsd === null) warnings.push('could not price ETH (aero quote ETH -> USDC failed); funding check is approximate')
  }

  const requiredEth = ethUsd === null ? null : (2 * budgetUsd + 0.5) / ethUsd
  if (balances !== null) {
    if (requiredEth !== null && Number(balances.eth) < requiredEth) {
      problems.push(`ETH balance ${balances.eth} below required ${requiredEth.toFixed(6)} (2*$${budgetUsd} + $0.50 gas headroom)`)
    } else if (requiredEth === null && Number(balances.eth) <= 0) {
      problems.push('ETH balance is 0; cannot verify funding while the price quote is failing')
    }
  }

  const journals = journalState(layout)
  if (journals.active.length > 0) {
    problems.push(`active execution journal(s): ${journals.active.join(', ')}; reconcile with aero executions resume --id <id> or aero executions cancel --id <id>`)
  }
  if (journals.locks.length > 0) problems.push(`stale execution lock file(s): ${journals.locks.join(', ')}`)

  const runLock = runLockState(layout)
  if (runLock.present && runLock.live) problems.push(`run.lock held by live pid ${runLock.pid}`)

  const git = gitInfo(repoRoot())

  return {
    ok: problems.length === 0,
    problems,
    warnings,
    bun: Bun.version,
    git,
    home,
    wallet: { present: walletPresent, address, dir: layout.walletDir },
    passphrase,
    rpc: { kind: rpcKind() },
    chain: { id: chainId, ok: chainId === CHAIN_ID, block: block === null ? null : block.toString() },
    balances,
    ethUsd,
    requiredEth,
    budgetUsd,
    journals,
    runLock,
    realWalletDirSafe,
  }
}

if (import.meta.main) {
  const budgetArg = process.argv.find((arg) => arg.startsWith('--budget-usd='))
  const report = await runDoctor({ budgetUsd: budgetArg ? Number(budgetArg.split('=')[1]) : undefined })
  console.log(JSON.stringify(report, null, 2))
  process.exit(report.ok ? 0 : 1)
}
