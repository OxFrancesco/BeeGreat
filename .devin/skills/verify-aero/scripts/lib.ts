import { existsSync, readFileSync, realpathSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, isAbsolute, join } from 'node:path'
import { createPublicClient, formatUnits, http, parseAbi, type Address, type Hex } from 'viem'
import { base } from 'viem/chains'
import { assertIsolatedHome } from './safety'

/**
 * Shared plumbing for the verify-aero scripts. The layout here must match
 * env.sh: one AERO_VERIFY_HOME holding the wallet, caches, indices, ALM
 * config, run evidence, baseline, and the run lock.
 */

export const CHAIN_ID = 8453
export const BASIC_LP: Address = '0x6cDcb1C4A4D1C3C6d054b27AC5B77e89eAFb971d' // vAMM-USDC/AERO
export const CL_LP: Address = '0xBE00fF35AF70E8415D0eB605a286D8A45466A4c1' // CL2000-USDC/AERO
export const USDC: Address = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'
export const AERO_TOKEN: Address = '0x940181a94A35A4569E4529A3CDfB74e38FD98631'
export const NVDAC: Address = '0xb20000000000000000000078ee7ce2fe4908108c'
// Confirmed live through SugarClient.getVeNftContracts() on Base.
export const VOTING_ESCROW: Address = '0xeBf418Fe2512e7E6bd9b87a8F0f294aCDC67e6B4'
export const REAL_WALLET_DIR = join(homedir(), '.config', 'sugar-ts')

/** Scripts dir resolved through the .agents/.claude symlinks to the real file. */
export function scriptsDir(): string {
  return dirname(realpathSync(import.meta.path))
}

/** Repo root: the first ancestor containing packages/sugar/package.json. */
export function repoRoot(): string {
  let dir = scriptsDir()
  for (;;) {
    if (existsSync(join(dir, 'packages/sugar/package.json'))) return dir
    const parent = dirname(dir)
    if (parent === dir) throw new Error('verify-aero: repo root not found (no packages/sugar/package.json above)')
    dir = parent
  }
}

export function aeroBin(): string {
  return join(scriptsDir(), 'aero')
}

export function verifyHome(): string {
  return process.env.AERO_VERIFY_HOME ?? join(homedir(), '.aero-verify')
}

export type VerifyLayout = {
  home: string
  walletDir: string
  passphraseFile: string
  cacheDir: string
  indexDir: string
  almConfig: string
  runsDir: string
  baselineFile: string
  runLock: string
  executionsDir: string
}

export function verifyLayout(home: string): VerifyLayout {
  const walletDir = join(home, 'wallet')
  return {
    home,
    walletDir,
    passphraseFile: join(home, 'passphrase'),
    cacheDir: join(home, 'cache'),
    indexDir: join(home, 'indices'),
    almConfig: join(home, 'alm.json'),
    runsDir: join(home, 'runs'),
    baselineFile: join(home, 'baseline.json'),
    runLock: join(home, 'run.lock'),
    executionsDir: join(walletDir, 'executions'),
  }
}

/**
 * Per-machine settings: $AERO_VERIFY_HOME/env holds plain KEY=VALUE lines
 * (# comment lines allowed). Only AERO_VERIFY_RPC and SUGAR_* keys are
 * honored, and only when the variable is not already set in the environment.
 * Values are never logged.
 */
function loadEnvFile(home: string): void {
  const file = join(home, 'env')
  if (!existsSync(file)) return
  for (const rawLine of readFileSync(file, 'utf8').split('\n')) {
    const line = rawLine.trim()
    if (line === '' || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq <= 0) continue
    const key = line.slice(0, eq).trim()
    if (key !== 'AERO_VERIFY_RPC' && !key.startsWith('SUGAR_')) continue
    if (process.env[key] !== undefined) continue
    process.env[key] = line.slice(eq + 1).trim()
  }
}

/** Mirror of env.sh for the TypeScript scripts; the two must stay in sync. */
export function applyVerifyEnv(home: string): VerifyLayout {
  assertIsolatedHome(home)
  const layout = verifyLayout(home)
  process.env.AERO_VERIFY_HOME = layout.home
  loadEnvFile(layout.home)
  process.env.SUGAR_WALLET_DIR = layout.walletDir
  process.env.SUGAR_WALLET_NO_KEYCHAIN = '1'
  process.env.AERO_CACHE_DIR = layout.cacheDir
  process.env.AERO_INDEX_DIR = layout.indexDir
  process.env.AERO_ALM_CONFIG = layout.almConfig
  // Resolve the RPC kind before exporting the chosen URL as
  // SUGAR_RPC_URI_8453, which would otherwise look like a user-env override.
  resolvedRpcKind = rpcKind()
  process.env.SUGAR_RPC_URI_8453 = rpcUrl()
  // SDK profile picked by the resolved endpoint's throttling model (see the
  // profile comments below). Env-file and process values already loaded above
  // win over these defaults.
  const profile = process.env.SUGAR_RPC_URI_8453 === PUBLICNODE_RPC ? PUBLICNODE_PROFILE : KEYED_PROFILE
  for (const [key, value] of Object.entries(profile)) {
    const bare = key.replace(/_8453$/, '')
    if (process.env[key] === undefined && process.env[bare] === undefined) {
      process.env[key] = value
    }
  }
  if (!process.env.SUGAR_WALLET_PASSPHRASE && existsSync(layout.passphraseFile)) {
    process.env.SUGAR_WALLET_PASSPHRASE = readFileSync(layout.passphraseFile, 'utf8').trim()
  }
  return layout
}

export type RpcKind = 'verify-override' | 'user-env' | 'publicnode-default'

// The SDK's public default and mainnet.base.org rate-limit the quote path
// within seconds; publicnode handles it. A dedicated endpoint via
// AERO_VERIFY_RPC also makes runs faster because the TUI raises scan
// concurrency when SUGAR_RPC_URI_8453 is set.
export const PUBLICNODE_RPC = 'https://base-rpc.publicnode.com'

// publicnode caps the size of each call, so its profile keeps batches small.
export const PUBLICNODE_PROFILE: Record<string, string> = {
  SUGAR_THREADING_MAX_WORKERS_8453: '1',
  SUGAR_QUOTE_BATCH_SIZE_8453: '8',
  SUGAR_QUOTE_MAX_PATHS_8453: '200',
  SUGAR_PRICE_BATCH_SIZE_8453: '8',
  SUGAR_POOL_PAGINATION_MAX_SIZE_8453: '75',
}

// Keyed endpoints like Alchemy throttle on request count (CU/s), so they win
// with fewer, larger calls: the SDK's default batch sizes on one worker.
export const KEYED_PROFILE: Record<string, string> = {
  SUGAR_THREADING_MAX_WORKERS_8453: '1',
  SUGAR_QUOTE_BATCH_SIZE_8453: '64',
  SUGAR_QUOTE_MAX_PATHS_8453: '200',
  SUGAR_PRICE_BATCH_SIZE_8453: '40',
  SUGAR_POOL_PAGINATION_MAX_SIZE_8453: '400',
}

let resolvedRpcKind: RpcKind | null = null

export function rpcKind(): RpcKind {
  if (resolvedRpcKind !== null) return resolvedRpcKind
  if (process.env.AERO_VERIFY_RPC) return 'verify-override'
  if (process.env.SUGAR_RPC_URI_8453) return 'user-env'
  return 'publicnode-default'
}

function rpcUrl(): string {
  return process.env.AERO_VERIFY_RPC ?? process.env.SUGAR_RPC_URI_8453 ?? PUBLICNODE_RPC
}

export type Public = ReturnType<typeof createPublicClient<ReturnType<typeof http>, typeof base>>

export function publicClient(): Public {
  return createPublicClient({ chain: base, transport: http(rpcUrl(), { retryCount: 5, retryDelay: 1000, timeout: 30_000 }) })
}

const erc20 = parseAbi([
  'function balanceOf(address) view returns (uint256)',
  'function decimals() view returns (uint8)',
])
const erc721 = parseAbi(['function balanceOf(address) view returns (uint256)'])

export type Balances = {
  eth: string
  usdc: string
  aero: string
  nvdac: string
  veNftCount: number
}

export async function readBalances(client: Public, wallet: Address, nvdacDecimals = 18, blockNumber?: bigint): Promise<Balances> {
  // A lagging or throttled node can fail one of the five reads, so retry the
  // batch before giving up. Pinning every call to blockNumber keeps a lagging
  // node erroring rather than answering with stale state.
  let lastError: unknown = new Error('balance reads never ran')
  for (let attempt = 0; attempt < 5; attempt++) {
    if (attempt > 0) await sleep(3000)
    try {
      const [eth, usdc, aero, nvdac, veNfts] = await Promise.all([
        client.getBalance({ address: wallet, ...(blockNumber !== undefined ? { blockNumber } : {}) }),
        client.readContract({ address: USDC, abi: erc20, functionName: 'balanceOf', args: [wallet], ...(blockNumber !== undefined ? { blockNumber } : {}) }),
        client.readContract({ address: AERO_TOKEN, abi: erc20, functionName: 'balanceOf', args: [wallet], ...(blockNumber !== undefined ? { blockNumber } : {}) }),
        client.readContract({ address: NVDAC, abi: erc20, functionName: 'balanceOf', args: [wallet], ...(blockNumber !== undefined ? { blockNumber } : {}) }),
        client.readContract({ address: VOTING_ESCROW, abi: erc721, functionName: 'balanceOf', args: [wallet], ...(blockNumber !== undefined ? { blockNumber } : {}) }),
      ])
      return {
        eth: formatUnits(eth, 18),
        usdc: formatUnits(usdc, 6),
        aero: formatUnits(aero, 18),
        nvdac: formatUnits(nvdac, nvdacDecimals),
        veNftCount: Number(veNfts),
      }
    } catch (cause) {
      lastError = cause
    }
  }
  throw lastError
}

export async function tokenDecimals(client: Public, token: Address): Promise<number> {
  return Number(await client.readContract({ address: token, abi: erc20, functionName: 'decimals' }))
}

/** Remove configured RPC URLs (which may carry API keys) from captured text. */
export function scrub(text: string): string {
  let out = text
  for (const url of [process.env.AERO_VERIFY_RPC, process.env.SUGAR_RPC_URI_8453, process.env.SUGAR_RPC_URI]) {
    if (url) out = out.split(url).join('[redacted-rpc-url]')
  }
  return out
}

export type ProcResult = {
  exitCode: number
  stdout: string
  stderr: string
  durationMs: number
  timedOut: boolean
}

/** Live children so a SIGINT can kill the in-flight CLI instead of orphaning it. */
export const activeProcs = new Set<ReturnType<typeof Bun.spawn>>()

export function killActiveProcs(): void {
  for (const proc of activeProcs) {
    try {
      proc.kill('SIGKILL')
    } catch { /* already gone */ }
  }
}

/** Spawn a child, capture output, kill on timeout. */
export async function runProcess(argv: string[], options: { cwd?: string; env?: NodeJS.ProcessEnv; stdin?: Blob; timeoutMs?: number } = {}): Promise<ProcResult> {
  const startedAt = Date.now()
  const proc = Bun.spawn(argv, {
    cwd: options.cwd,
    env: options.env ?? process.env,
    stdin: options.stdin ?? 'ignore',
    stdout: 'pipe',
    stderr: 'pipe',
  })
  activeProcs.add(proc)
  let timedOut = false
  const timeoutMs = options.timeoutMs ?? 10 * 60_000
  const timer = setTimeout(() => {
    timedOut = true
    proc.kill('SIGKILL')
  }, timeoutMs)
  try {
    const [exitCode, stdout, stderr] = await Promise.all([
      proc.exited,
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
    ])
    return { exitCode, stdout: scrub(stdout), stderr: scrub(stderr), durationMs: Date.now() - startedAt, timedOut }
  } finally {
    clearTimeout(timer)
    activeProcs.delete(proc)
  }
}

export function runAero(args: string[], options: { timeoutMs?: number } = {}): Promise<ProcResult> {
  return runProcess([aeroBin(), ...args], options)
}

/**
 * Drive an interactive aero command through expect: the Tcl script goes to
 * expect's stdin (`expect -`) and extra env vars ride along. Same shape
 * setup-wallet.sh uses, for commands that prompt on a TTY.
 */
export function runExpect(script: string, env: Record<string, string>, timeoutMs = 2 * 60_000): Promise<ProcResult> {
  return runProcess(['/usr/bin/expect', '-'], { env: { ...process.env, ...env }, stdin: new Blob([script]), timeoutMs })
}

/** The last top-level JSON value printed to stdout (reads and plans are pretty-printed last). */
export function extractLastJson(stdout: string): unknown {
  const trimmed = stdout.trim()
  if (!trimmed) return null
  try {
    return JSON.parse(trimmed)
  } catch {
    // human lines precede the JSON on tx commands
  }
  const lines = stdout.split('\n')
  for (let index = 0; index < lines.length; index++) {
    const first = lines[index].trimStart().charAt(0)
    if (first !== '{' && first !== '[') continue
    try {
      return JSON.parse(lines.slice(index).join('\n'))
    } catch {
      // not the start of the trailing JSON block; keep scanning
    }
  }
  return null
}

export function asObject(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
}

export function asArray(value: unknown): unknown[] | null {
  return Array.isArray(value) ? value : null
}

/** Infra failures classify as flaky, never as regressions. The CLI renders
 * SugarRpcError messages, so the rendered phrases match alongside the codes. */
export const FLAKY_PATTERN = /RPC_RATE_LIMITED|RPC_TIMEOUT|RPC_UNAVAILABLE|429|rate limited|timed out|is unavailable/i

/** Plan-build failures that mean "no live state to act on", not a bug. */
export const NEEDS_STATE_PATTERN = /position not found|no LP|not staked|is not staked|has no liquidity|insufficient|no cl positions/i

export function round6(value: number): string {
  return (Math.floor(value * 1e6) / 1e6).toFixed(6).replace(/\.?0+$/, '') || '0'
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export type GitInfo = { rev: string; dirty: boolean | null; note?: string }

const SHA = /^[0-9a-fA-F]{40}$/

/**
 * Resolve HEAD without a git binary: read .git/HEAD, follow a branch ref
 * through refs/ or packed-refs. Returns null when nothing parses.
 */
function headShaFromGitDir(root: string): string | null {
  try {
    let gitDir = join(root, '.git')
    if (!existsSync(gitDir)) return null
    if (statSync(gitDir).isFile()) {
      // A worktree or submodule .git file points at the real gitdir.
      const target = /^gitdir:\s*(.+)$/.exec(readFileSync(gitDir, 'utf8').trim())?.[1]
      if (!target) return null
      gitDir = isAbsolute(target) ? target : join(root, target)
    }
    const head = readFileSync(join(gitDir, 'HEAD'), 'utf8').trim()
    if (SHA.test(head)) return head
    const ref = /^ref:\s*(.+)$/.exec(head)?.[1]
    if (!ref) return null
    const refFile = join(gitDir, ref)
    if (existsSync(refFile)) {
      const sha = readFileSync(refFile, 'utf8').trim()
      if (SHA.test(sha)) return sha
    }
    const packedRefs = join(gitDir, 'packed-refs')
    if (existsSync(packedRefs)) {
      for (const line of readFileSync(packedRefs, 'utf8').split('\n')) {
        if (line.startsWith('#') || line.startsWith('^')) continue
        const [sha, name] = line.trim().split(' ')
        if (name === ref && SHA.test(sha ?? '')) return sha
      }
    }
    return null
  } catch {
    return null
  }
}

/**
 * Git provenance for reports. A broken git (for example an unaccepted Xcode
 * license) must not poison the run: fall back to .git files for the rev and
 * report dirty as unknown.
 */
export function gitInfo(root: string): GitInfo {
  const revParse = Bun.spawnSync(['git', '-C', root, 'rev-parse', 'HEAD'])
  const rev = revParse.stdout.toString().trim()
  if (revParse.exitCode === 0 && SHA.test(rev)) {
    const status = Bun.spawnSync(['git', '-C', root, 'status', '--porcelain'])
    return { rev, dirty: status.exitCode === 0 ? status.stdout.toString().trim().length > 0 : null }
  }
  const firstLine = scrub(revParse.stderr.toString()).trim().split('\n')[0] ?? 'rev-parse failed'
  return { rev: headShaFromGitDir(root) ?? 'unknown', dirty: null, note: `git unavailable: ${firstLine}` }
}

export function pidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch (cause) {
    return (cause as NodeJS.ErrnoException).code === 'EPERM'
  }
}

export function isHash(value: unknown): value is Hex {
  return typeof value === 'string' && /^0x[0-9a-fA-F]{64}$/.test(value)
}
