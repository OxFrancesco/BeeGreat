import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Address, Hex } from 'viem'
import { formatUnits, parseUnits } from 'viem'
import { SugarClient } from '../../../../packages/sugar/src/client'
import { createExecutionPlan, localMnemonicSigner, sendPlan } from '../../../../packages/sugar/src/send'
import { loadLocalWallet, openSecret } from '../../../../packages/sugar/src/wallet'
import {
  aeroBin,
  applyVerifyEnv,
  asArray,
  asObject,
  BASIC_LP,
  CHAIN_ID,
  CL_LP,
  extractLastJson,
  FLAKY_PATTERN,
  gitInfo,
  killActiveProcs,
  NEEDS_STATE_PATTERN,
  NVDAC,
  publicClient,
  readBalances,
  repoRoot,
  round6,
  rpcKind,
  runAero,
  runExpect,
  scrub,
  sleep,
  tokenDecimals,
  verifyHome,
  type Balances,
  type ProcResult,
  type Public,
  type VerifyLayout,
} from './lib'
import { ethUsdPrice, runDoctor } from './doctor'
import { acquireRunLock } from './safety'

/**
 * verify-aero runner. Drives the real aero CLI on Base 8453 from the isolated
 * wallet under AERO_VERIFY_HOME and writes evidence under runs/<run-id>/.
 *
 * Modes: full (live cycle), dry-run (reads + unsigned plans), reads (read
 * actions only), sweep (return stray balances to ETH).
 * Exit: 0 ok, 1 step failures, 2 regression vs baseline.json, 3 preflight refused.
 */

type Mode = 'full' | 'dry-run' | 'reads' | 'sweep'
type StepKind = 'read' | 'tx' | 'local' | 'sweep'
type StepStatus = 'ok' | 'fail' | 'skipped' | 'flaky'

type Assertion = { name: string; ok: boolean; detail?: string }

type StepRecord = {
  id: string
  title: string
  feature: string
  kind: StepKind
  command: string[]
  startedAt: string
  durationMs: number
  exitCode: number | null
  stdout: string
  stderr: string
  parsed: unknown
  plan: Record<string, unknown> | null
  hashes: string[]
  receipts: { hash: string; status: string; blockNumber: string; gasUsed: string }[]
  balanceDelta: Record<string, string> | null
  assertions: Assertion[]
  status: StepStatus
  reason?: string
  recovered?: boolean
  attempts: number
}

type Ctx = {
  mode: Mode
  layout: VerifyLayout
  client: Public
  wallet: Address | null
  budgetUsd: number
  ethUsd: number | null
  aeroUsd: number | null
  ethLeg: string
  usdcHalf: string
  venftAero: string
  clPriceLower: string
  clPriceUpper: string
  nvdacDecimals: number
  nvdaPriceUsd: number | null
  clPositionId: string | null
  almConfigured: boolean
  indexReady: boolean
  before: Balances | null
  journalSnapshot: Map<string, number>
  minBlock: bigint
  aborted: boolean
  upstreamFailed: boolean
  steps: StepRecord[]
  runId: string
  runDir: string
  stepsDir: string
  journalsDir: string
  interrupted: boolean
}

const STEP_TIMEOUT_MS = 10 * 60_000
const RECEIPT_TIMEOUT_MS = 2 * 60_000
const MAX_ATTEMPTS = 3
const RETRY_DELAY_MS = 45_000
const DUST_USD = 0.05

function assert(rec: StepRecord, name: string, ok: boolean, detail?: string): boolean {
  rec.assertions.push({ name, ok, detail })
  return ok
}

function allOk(rec: StepRecord): StepStatus {
  return rec.assertions.every((entry) => entry.ok) ? 'ok' : 'fail'
}

function newRecord(id: string, title: string, feature: string, kind: StepKind): StepRecord {
  return {
    id, title, feature, kind,
    command: [],
    startedAt: new Date().toISOString(),
    durationMs: 0,
    exitCode: null,
    stdout: '', stderr: '',
    parsed: null, plan: null,
    hashes: [], receipts: [],
    balanceDelta: null,
    assertions: [],
    status: 'skipped',
    attempts: 1,
  }
}

function finishStep(ctx: Ctx, rec: StepRecord, status: StepStatus, reason?: string): void {
  rec.status = status
  if (reason) rec.reason = reason
  ctx.steps.push(rec)
  const file = join(ctx.stepsDir, `${String(ctx.steps.length).padStart(2, '0')}-${rec.id}.json`)
  writeFileSync(file, JSON.stringify(rec, null, 2))
  console.log(`${status.toUpperCase().padEnd(7)} ${rec.id}${reason ? ` (${reason})` : ''}`)
}

/** Spawn the wrapper and fold the invocation into the step record. */
async function cli(rec: StepRecord, args: string[], timeoutMs = STEP_TIMEOUT_MS): Promise<ProcResult> {
  const result = await runAero(args, { timeoutMs })
  rec.command = ['scripts/aero', ...args]
  rec.exitCode = result.exitCode
  rec.stdout += `${rec.stdout ? '\n' : ''}$ scripts/aero ${args.join(' ')}\n${result.stdout}`
  if (result.stderr) rec.stderr += `${rec.stderr ? '\n' : ''}${result.stderr}`
  rec.durationMs += result.durationMs
  rec.parsed = extractLastJson(result.stdout)
  if (result.timedOut) rec.stderr += `[verify] killed after ${timeoutMs}ms\n`
  return result
}

function classifyFailure(ctx: Ctx, result: ProcResult): StepStatus {
  const blob = `${result.stderr}\n${result.stdout}`
  if (FLAKY_PATTERN.test(blob)) return 'flaky'
  if (ctx.mode === 'dry-run' && NEEDS_STATE_PATTERN.test(blob)) return 'skipped'
  return 'fail'
}

async function receipts(ctx: Ctx, rec: StepRecord, hashes: string[]): Promise<boolean> {
  let ok = true
  for (const hash of hashes) {
    try {
      const receipt = await ctx.client.waitForTransactionReceipt({ hash: hash as Hex, timeout: RECEIPT_TIMEOUT_MS })
      rec.receipts.push({
        hash,
        status: receipt.status,
        blockNumber: receipt.blockNumber.toString(),
        gasUsed: (receipt.gasUsed * receipt.effectiveGasPrice).toString(),
      })
      // Track the highest confirmed block so later reads can wait for the
      // node to catch up instead of trusting a stale latest.
      if (receipt.blockNumber > ctx.minBlock) ctx.minBlock = receipt.blockNumber
      if (!assert(rec, `receipt ${hash.slice(0, 10)} succeeded`, receipt.status === 'success', receipt.status)) ok = false
    } catch (cause) {
      assert(rec, `receipt ${hash.slice(0, 10)} fetched`, false, scrub(cause instanceof Error ? cause.message : String(cause)))
      ok = false
    }
  }
  return ok
}

async function withBalanceDelta(ctx: Ctx, rec: StepRecord, before: Balances | null, blockNumber?: bigint): Promise<Balances | null> {
  if (!ctx.wallet) return null
  // Read at the receipt block so the delta never races a lagging RPC node.
  const after = await readBalances(ctx.client, ctx.wallet, ctx.nvdacDecimals, blockNumber).catch(() => null)
  if (before && after) {
    rec.balanceDelta = {
      eth: (Number(after.eth) - Number(before.eth)).toFixed(8),
      usdc: (Number(after.usdc) - Number(before.usdc)).toFixed(6),
      aero: (Number(after.aero) - Number(before.aero)).toFixed(6),
      nvdac: (Number(after.nvdac) - Number(before.nvdac)).toFixed(6),
      veNftCount: String(after.veNftCount - before.veNftCount),
    }
  }
  return after
}

/**
 * Read balances at the node's latest block, but only once the node has
 * caught up to the highest receipt block this run produced — a stale latest
 * read must never make a sweep decide a held token is absent. Throws when
 * the node never catches up so the step classifies flaky, not nothing.
 */
async function latestBalances(ctx: Ctx): Promise<Balances> {
  if (!ctx.wallet) throw new Error('no wallet')
  for (let attempt = 0; attempt < 10; attempt++) {
    if (attempt > 0) await sleep(3000)
    const block = await ctx.client.getBlockNumber()
    if (block >= ctx.minBlock) return await readBalances(ctx.client, ctx.wallet, ctx.nvdacDecimals, block)
  }
  throw new Error(`RPC_UNAVAILABLE: node has not reached block ${ctx.minBlock} after 10 polls`)
}

/**
 * `aero positions` recorded into the step record, retried, and loud: a
 * rate-limited CLI used to surface here as an empty list, which made sweeps
 * read a held position as absent. Throws the CLI's first stderr line after
 * three attempts so the step classifies flaky instead of skipping.
 */
async function positions(rec: StepRecord): Promise<Record<string, unknown>[]> {
  let detail = ''
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await sleep(3000)
    const result = await cli(rec, ['positions'])
    const parsed = asArray(extractLastJson(result.stdout))
    if (result.exitCode === 0 && parsed) {
      return parsed.filter((item): item is Record<string, unknown> => asObject(item) !== null)
    }
    detail = result.stderr.trim().split('\n')[0]
      || (result.exitCode === 0 ? 'aero positions printed no JSON array' : `aero positions exited ${result.exitCode}`)
  }
  throw new Error(detail)
}

/** Re-poll `aero positions` until the predicate holds; returns the last list. */
async function positionsUntil(ctx: Ctx, rec: StepRecord, predicate: (all: Record<string, unknown>[]) => boolean, attempts = 4, delayMs = 3000): Promise<Record<string, unknown>[]> {
  let all = await positions(rec)
  // A negative answer only counts once the node has passed the highest
  // receipt block this run produced; otherwise positions can look absent
  // on a stale read right after a confirmed transaction.
  let trusted = ctx.minBlock === 0n
  for (let attempt = 1; attempt < attempts && !predicate(all); attempt++) {
    await sleep(delayMs)
    if (!trusted) {
      trusted = await ctx.client.getBlockNumber().then((block) => block >= ctx.minBlock).catch(() => false)
      if (!trusted) continue
    }
    all = await positions(rec)
  }
  if (!trusted && !predicate(all)) throw new Error(`RPC_UNAVAILABLE: node has not reached block ${ctx.minBlock}`)
  return all
}

function positionPool(position: Record<string, unknown>): Record<string, unknown> {
  return asObject(position.pool) ?? {}
}

function positionsInPool(all: Record<string, unknown>[], lp: string): Record<string, unknown>[] {
  return all.filter((position) => String(positionPool(position).lp).toLowerCase() === lp.toLowerCase())
}

function bigOf(value: unknown): bigint {
  try {
    return BigInt(String(value ?? '0'))
  } catch {
    return 0n
  }
}

/**
 * One CLI transaction end to end: capture the unsigned plan with --dry-run,
 * then broadcast with --yes and verify the receipts independently via viem.
 * The dry-run output and the send output both land in the record's stdout.
 */
async function cliTx(ctx: Ctx, rec: StepRecord, args: string[]): Promise<StepStatus> {
  const before = ctx.wallet ? await latestBalances(ctx).catch(() => null) : null

  const dry = await runAero([...args, '--dry-run'], { timeoutMs: STEP_TIMEOUT_MS })
  rec.stdout += `$ scripts/aero ${[...args, '--dry-run'].join(' ')}\n${dry.stdout}`
  if (dry.stderr) rec.stderr += dry.stderr
  rec.durationMs += dry.durationMs
  const plan = asObject(extractLastJson(dry.stdout))
  if (dry.exitCode !== 0 || plan === null) {
    rec.exitCode = dry.exitCode
    return classifyFailure(ctx, dry)
  }
  rec.plan = plan
  const steps = asArray(plan.transaction_steps)
  assert(rec, 'plan has transaction_steps', steps !== null && steps.length > 0, steps === null ? 'missing' : `${steps.length} step(s)`)

  if (ctx.mode === 'dry-run') {
    rec.command = ['scripts/aero', ...args, '--dry-run']
    rec.exitCode = dry.exitCode
    return allOk(rec)
  }

  const real = await runAero([...args, '--yes'], { timeoutMs: STEP_TIMEOUT_MS })
  rec.command = ['scripts/aero', ...args, '--yes']
  rec.exitCode = real.exitCode
  rec.stdout += `\n$ scripts/aero ${[...args, '--yes'].join(' ')}\n${real.stdout}`
  if (real.stderr) rec.stderr += real.stderr
  rec.durationMs += real.durationMs
  const sent = asObject(extractLastJson(real.stdout))
  rec.parsed = sent
  if (real.exitCode !== 0) {
    const combined = `${real.stdout}\n${real.stderr}`
    const reverted = REVERTED_ONCHAIN.exec(combined)
    // A reverted step can never resume (sendPlan throws on it), so it goes
    // straight to fail+abort with the gas detail instead of the journal path.
    if (reverted) return recordReverted(ctx, rec, reverted[1], before)
    const lost = LOST_RECEIPT.exec(combined)
    const journal = findActiveJournal(ctx, lost?.[1])
    if (journal !== null) {
      const hint = `reconcile by hand with scripts/aero executions resume --id ${journal.id} or scripts/aero executions cancel --id ${journal.id}`
      if (ctx.journalSnapshot.has(journal.name)) {
        // The journal predates this run, so the send hit the
        // unresolved-execution gate without broadcasting anything. A journal
        // the runner did not create is never auto-resumed.
        ctx.aborted = true
        rec.reason = `journal ${journal.id} predates this run and is still active, so the send hit the unresolved-execution gate; ${hint}`
        return 'fail'
      }
      if (journal.steps.some((step) => step.kind === 'submitting')) {
        // A step marked submitting may or may not have broadcast; resuming
        // could double-send, so this shape always needs a human.
        ctx.aborted = true
        rec.reason = `execution ${journal.id} has a step still in submitting, so the broadcast outcome is unknown; ${hint}`
        return 'fail'
      }
      const successReason = lost !== null
        ? RECONCILE_REASON
        : `CLI aborted mid-plan (${scrub(firstStderrLine(real.stderr)).slice(0, 120)}); completed via aero executions resume`
      return recoverExecution(ctx, rec, journal.id, before, successReason, lost?.[2])
    }
    if (/unresolved execution/i.test(combined)) {
      // The gate fired but the blocking journal could not be read; nothing
      // was broadcast and retrying would hit the same wall.
      ctx.aborted = true
      rec.reason = 'send refused: wallet has an unresolved execution journal; reconcile by hand with scripts/aero executions list then resume --id <id> or cancel --id <id>'
      return 'fail'
    }
    return classifyFailure(ctx, real)
  }
  if (sent === null) {
    if (/already balanced|no transactions needed/i.test(real.stdout)) return 'ok'
    assert(rec, 'result JSON printed', false, real.stdout.slice(-200))
    return 'fail'
  }
  if (!assert(rec, 'result status is sent', sent.status === 'sent', String(sent.status))) return 'fail'
  const hashes = asArray(sent.hashes)?.filter((hash): hash is string => typeof hash === 'string') ?? []
  // Accumulate: sweep steps run several CLI invocations per record; the count
  // assertion covers only this invocation's hashes against its own plan.
  rec.hashes.push(...hashes)
  if (!assert(rec, 'hashes match plan step count', steps !== null && hashes.length === steps.length, `${hashes.length} hashes vs ${steps?.length ?? '?'} plan steps`)) {
    return 'fail'
  }
  const receiptsOk = await receipts(ctx, rec, hashes)
  const maxBlock = rec.receipts.reduce((top, receipt) => BigInt(receipt.blockNumber) > top ? BigInt(receipt.blockNumber) : top, 0n)
  await withBalanceDelta(ctx, rec, before, maxBlock > 0n ? maxBlock : undefined)
  // A confirmed transaction whose post-state cannot be read is an
  // infrastructure flake, not a failed check: keep the receipts and let the
  // null delta classify the step flaky rather than failing on 'delta n/a'.
  if (receiptsOk && ctx.wallet !== null && rec.balanceDelta === null) {
    rec.reason = 'tx confirmed; balance read failed after retries'
    return 'flaky'
  }
  return receiptsOk ? 'ok' : 'fail'
}

const LOST_RECEIPT = /Execution outcome unknown; resume ([0-9a-f-]{36}) to check (0x[0-9a-fA-F]{64})/
const REVERTED_ONCHAIN = /reverted on-chain: (0x[0-9a-fA-F]{64})/
const RECONCILE_REASON = 'CLI lost the receipt wait (RPC); tx confirmed on chain; reconciled via aero executions resume'
const JOURNAL_NAME = /^[0-9a-f-]{36}\.json$/i

type JournalFile = {
  id: string
  name: string
  status: string | null
  sender: string | null
  steps: Record<string, unknown>[]
}

function firstStderrLine(text: string): string {
  return text.split('\n').map((line) => line.trim()).find((line) => line.length > 0) ?? 'no stderr output'
}

function readJournalFile(directory: string, name: string): JournalFile | null {
  try {
    const raw = asObject(JSON.parse(readFileSync(join(directory, name), 'utf8')))
    if (raw === null) return null
    const plan = asObject(raw.plan)
    return {
      id: name.slice(0, -5),
      name,
      status: typeof raw.status === 'string' ? raw.status : null,
      sender: plan !== null && typeof plan.sender === 'string' ? plan.sender : null,
      steps: asArray(raw.steps)?.filter((step): step is Record<string, unknown> => asObject(step) !== null) ?? [],
    }
  } catch {
    return null
  }
}

/**
 * The newest active journal this wallet owns, preferring `preferredId` (the
 * id a lost receipt wait printed) when it resolves to an active journal.
 */
function findActiveJournal(ctx: Ctx, preferredId?: string): JournalFile | null {
  const directory = ctx.layout.executionsDir
  if (ctx.wallet === null || !existsSync(directory)) return null
  const sender = ctx.wallet.toLowerCase()
  const active = readdirSync(directory)
    .filter((name) => JOURNAL_NAME.test(name))
    .map((name) => ({ file: readJournalFile(directory, name), mtime: statSync(join(directory, name)).mtimeMs }))
    .filter((entry): entry is { file: JournalFile; mtime: number } =>
      entry.file !== null && entry.file.status === 'active' && entry.file.sender?.toLowerCase() === sender)
  if (preferredId !== undefined) {
    const named = active.find((entry) => entry.file.id === preferredId)
    if (named) return named.file
  }
  active.sort((a, b) => b.mtime - a.mtime)
  return active[0]?.file ?? null
}

/**
 * Drive the CLI's own reconcile prompt through expect; returns null when
 * expect itself cannot run. The resume never rebroadcasts confirmed or
 * submitted steps, only unsubmitted `ready` ones.
 */
async function resumeExecution(rec: StepRecord, planId: string): Promise<ProcResult | null> {
  const script = [
    'log_user 1',
    'set timeout 120',
    `spawn /bin/bash $env(AERO_CLI) executions resume --id ${planId}`,
    'expect {',
    '  -re {Reconcile receipts and continue.*} { send "y\\r"; exp_continue }',
    '  timeout { puts stderr "timed out waiting for aero executions resume"; exit 1 }',
    '  eof {}',
    '}',
    'catch wait result',
    'exit [lindex $result 3]',
  ].join('\n')
  try {
    const resume = await runExpect(script, { AERO_CLI: aeroBin() })
    rec.stdout += `\n$ expect aero executions resume --id ${planId}\n${resume.stdout}`
    if (resume.stderr) rec.stderr += resume.stderr
    rec.durationMs += resume.durationMs
    return resume
  } catch (cause) {
    rec.stderr += `[verify] executions resume spawn failed: ${scrub(cause instanceof Error ? cause.message : String(cause))}\n`
    return null
  }
}

/**
 * The CLI can die mid-plan after some steps already broadcast: the receipt
 * wait can fail on an endpoint that refuses eth_getTransactionReceipt, or
 * local preparation can fail before broadcast (the step stays `ready`). In
 * both shapes the journal is `active` with no `submitting` step, so resuming
 * through the CLI's own path is safe and never resends. The run created the
 * journal (a pre-existing one is refused upstream), so one resume settles it.
 */
async function recoverExecution(ctx: Ctx, rec: StepRecord, planId: string, before: Balances | null, successReason: string, extraHash?: string): Promise<StepStatus> {
  const journalFile = join(ctx.layout.executionsDir, `${planId}.json`)
  const readJournal = () => JOURNAL_NAME.test(`${planId}.json`) ? readJournalFile(ctx.layout.executionsDir, `${planId}.json`) : null
  const submittedCount = (journal: JournalFile | null) => journal?.steps.filter((step) => step.kind === 'submitted').length ?? 0

  const submittedBefore = submittedCount(readJournal())
  let resume = await resumeExecution(rec, planId)
  let journal = readJournal()

  // The resume itself can die on the same transient preparation failure with
  // the step still `ready`. Nothing new broadcast (no `submitting`, no new
  // `submitted`), so one more attempt after a cooldown is safe — two total.
  if (journal !== null && journal.status === 'active'
    && !journal.steps.some((step) => step.kind === 'submitting')
    && submittedCount(journal) <= submittedBefore) {
    rec.stdout += `\n[verify] journal still active after resume; retrying once after 60s\n`
    await sleep(60_000)
    resume = await resumeExecution(rec, planId)
    journal = readJournal()
  }

  if (resume !== null) {
    assert(rec, 'executions resume exited 0', resume.exitCode === 0, String(resume.exitCode))
  }

  const journalComplete = journal?.status === 'complete'
  assert(rec, 'journal reconciled to complete', journalComplete, journalFile)

  const journalHashes = (journal?.steps ?? [])
    .map((step) => step.hash)
    .filter((hash): hash is string => typeof hash === 'string')
  if (extraHash !== undefined) journalHashes.push(extraHash)
  const allHashes = [...new Set(journalHashes)]
  rec.hashes.push(...allHashes.filter((hash) => !rec.hashes.includes(hash)))
  const unfetched = allHashes.filter((hash) => !rec.receipts.some((receipt) => receipt.hash === hash))
  const fetchedOk = await receipts(ctx, rec, unfetched)
  const receiptsOk = allHashes.length > 0 && fetchedOk && rec.receipts.every((receipt) => receipt.status === 'success')

  const maxBlock = rec.receipts.reduce((top, receipt) => BigInt(receipt.blockNumber) > top ? BigInt(receipt.blockNumber) : top, 0n)
  await withBalanceDelta(ctx, rec, before, maxBlock > 0n ? maxBlock : undefined)

  if (journalComplete && receiptsOk) {
    rec.reason = successReason
    rec.recovered = true
    return 'flaky'
  }
  ctx.aborted = true
  rec.reason = `plan aborted mid-flight and the reconcile did not settle it; reconcile by hand with scripts/aero executions resume --id ${planId} or scripts/aero executions cancel --id ${planId}`
  return 'fail'
}

/**
 * A step reverted on-chain: record the hash and receipt, then report the gas
 * detail so a tight-estimate revert (gasUsed near 100% of the limit) reads
 * differently from a contract-logic revert. sendPlan marks the journal
 * `failed`, which does not block later plans, so the run goes on: dependent
 * tx steps are skipped through upstreamFailed and the sweeps still run.
 */
async function recordReverted(ctx: Ctx, rec: StepRecord, hash: string, before: Balances | null): Promise<StepStatus> {
  const hint = 'journal marked failed (does not block new plans); dependent steps skip, sweeps still run'
  rec.hashes.push(hash)
  try {
    const [receipt, transaction] = await Promise.all([
      ctx.client.getTransactionReceipt({ hash: hash as Hex }),
      ctx.client.getTransaction({ hash: hash as Hex }),
    ])
    rec.receipts.push({
      hash,
      status: receipt.status,
      blockNumber: receipt.blockNumber.toString(),
      gasUsed: (receipt.gasUsed * receipt.effectiveGasPrice).toString(),
    })
    if (receipt.blockNumber > ctx.minBlock) ctx.minBlock = receipt.blockNumber
    const pct = transaction.gas > 0n ? receipt.gasUsed * 100n / transaction.gas : 0n
    rec.reason = `reverted on-chain (gasUsed ${receipt.gasUsed} of limit ${transaction.gas}, ${pct}%); ${hint}`
    await withBalanceDelta(ctx, rec, before, receipt.blockNumber)
  } catch (cause) {
    rec.stderr += `[verify] revert detail lookup failed: ${scrub(cause instanceof Error ? cause.message : String(cause))}\n`
    rec.reason = `reverted on-chain: ${hash}; ${hint}`
  }
  return 'fail'
}

/**
 * The single place the runner signs outside the CLI. The CLI has no veNFT
 * withdraw command, so an expired lock is swept through the SDK with the same
 * plan + journal machinery (sendPlan + the sealed local wallet) the CLI uses.
 */
async function sdkVeNftWithdraw(ctx: Ctx, rec: StepRecord, tokenId: bigint): Promise<StepStatus> {
  if (!ctx.wallet) return 'skipped'
  const local = loadLocalWallet()
  const passphrase = process.env.SUGAR_WALLET_PASSPHRASE
  if (!local || !passphrase) {
    assert(rec, 'local wallet + passphrase available', false)
    return 'fail'
  }
  try {
    const client = new SugarClient(CHAIN_ID, { account: ctx.wallet })
    const transactions = await client.withdrawVeNft(tokenId)
    const signer = localMnemonicSigner(openSecret(local.sealed, passphrase))
    const plan = createExecutionPlan({
      steps: transactions.map((transaction) => ({ role: 'action' as const, transaction })),
      chainId: CHAIN_ID,
      sender: ctx.wallet,
    })
    const hashes = await sendPlan({ plan, signer, log: (line) => { rec.stdout += `[sdk] ${line}\n` } })
    // Several expired veNFTs can be withdrawn under one step record; keep
    // every hash so the receipts and summary cover all of them.
    rec.hashes.push(...hashes)
    rec.command = ['sdk', `client.withdrawVeNft(${tokenId})`, 'sendPlan(localMnemonicSigner)']
    rec.exitCode = 0
    return (await receipts(ctx, rec, hashes)) ? 'ok' : 'fail'
  } catch (cause) {
    rec.stderr += `${scrub(cause instanceof Error ? cause.message : String(cause))}\n`
    return FLAKY_PATTERN.test(rec.stderr) ? 'flaky' : 'fail'
  }
}

function dustThreshold(ctx: Ctx, token: 'usdc' | 'aero' | 'nvdac'): number {
  if (token === 'usdc') return DUST_USD
  if (token === 'aero') return ctx.aeroUsd ? DUST_USD / ctx.aeroUsd : Number.POSITIVE_INFINITY
  // Without a live price, a few wei of NVDAc must never trigger a doomed sell,
  // so fall back to a small fixed unit threshold (0.0005 NVDAc).
  return ctx.nvdaPriceUsd ? DUST_USD / ctx.nvdaPriceUsd : 0.0005
}

// --- step definitions -------------------------------------------------------

type StepDef = {
  id: string
  title: string
  feature: string
  kind: StepKind
  modes: Mode[]
  needs?: (ctx: Ctx) => string | undefined
  run: (ctx: Ctx, rec: StepRecord) => Promise<StepStatus>
}

const READ_MODES: Mode[] = ['full', 'dry-run', 'reads']
const TX_MODES: Mode[] = ['full', 'dry-run']
const LOCAL_MODES: Mode[] = ['full', 'dry-run']
const SWEEP_MODES: Mode[] = ['full', 'sweep']

function readStep(def: { id: string; feature: string; title: string; modes?: Mode[]; needs?: (ctx: Ctx) => string | undefined; args: (ctx: Ctx) => string[]; check: (ctx: Ctx, rec: StepRecord) => StepStatus }): StepDef {
  return {
    id: def.id, title: def.title, feature: def.feature, kind: 'read',
    modes: def.modes ?? READ_MODES,
    needs: def.needs,
    run: async (ctx, rec) => {
      const result = await cli(rec, def.args(ctx))
      if (result.exitCode !== 0) return classifyFailure(ctx, result)
      return def.check(ctx, rec)
    },
  }
}

function txStep(def: { id: string; feature: string; title: string; args: (ctx: Ctx) => string[]; needs?: (ctx: Ctx) => string | undefined; check?: (ctx: Ctx, rec: StepRecord) => Promise<StepStatus> }): StepDef {
  return {
    id: def.id, title: def.title, feature: def.feature, kind: 'tx', modes: TX_MODES, needs: def.needs,
    run: async (ctx, rec) => {
      const status = await cliTx(ctx, rec, def.args(ctx))
      // A journal-recovered flaky has the tx confirmed on chain, so its check
      // still runs and never blocks downstream (only fail sets upstreamFailed).
      // A generic infra flake has no on-chain state to check; keep it flaky.
      if (status !== 'ok' && !(status === 'flaky' && rec.recovered)) return status
      if (!def.check) return status
      const checked = await def.check(ctx, rec)
      return checked === 'ok' ? status : checked
    },
  }
}

function localStep(def: { id: string; feature: string; title: string; args: (ctx: Ctx) => string[]; needs?: (ctx: Ctx) => string | undefined; check?: (ctx: Ctx, rec: StepRecord) => Promise<StepStatus> }): StepDef {
  return {
    id: def.id, title: def.title, feature: def.feature, kind: 'local', modes: LOCAL_MODES, needs: def.needs,
    run: async (ctx, rec) => {
      const result = await cli(rec, def.args(ctx))
      if (result.exitCode !== 0) return classifyFailure(ctx, result)
      return def.check ? def.check(ctx, rec) : 'ok'
    },
  }
}

function sweepStep(def: { id: string; title: string; modes: Mode[]; run: (ctx: Ctx, rec: StepRecord) => Promise<'did' | 'nothing' | 'failed' | 'flaky'> }): StepDef {
  return {
    id: def.id, title: def.title, feature: 'sweep', kind: 'sweep', modes: def.modes,
    run: async (ctx, rec) => {
      const outcome = await def.run(ctx, rec)
      if (outcome === 'nothing') return 'skipped'
      if (outcome === 'failed') return 'fail'
      if (outcome === 'flaky') return 'flaky'
      return 'ok'
    },
  }
}

const ZERO = '0x0000000000000000000000000000000000000000'

/** Unstake then withdraw any position we hold in one of the two pinned pools. */
async function sweepPool(ctx: Ctx, rec: StepRecord, lp: string): Promise<'did' | 'nothing' | 'failed' | 'flaky'> {
  // A failed positions read must never look like an empty wallet.
  const all = await positions(rec).catch(() => null)
  if (all === null) return 'flaky'
  const ours = positionsInPool(all, lp).filter((position) => String(position.alm ?? ZERO).toLowerCase() === ZERO)
  const isCl = ours.some((position) => positionPool(position).is_cl === true) || lp === CL_LP
  let did = false
  for (const position of ours) {
    const id = String(position.id)
    if (bigOf(position.staked) > 0n) {
      const args = isCl && id !== '0' ? ['unstake', '--position', id] : ['unstake', '--pool', lp]
      const status = await cliTx(ctx, rec, args)
      if (status === 'fail') return 'failed'
      if (status === 'flaky') return 'flaky'
      if (status === 'ok') did = true
    }
    if (bigOf(position.liquidity) > 0n) {
      const args = isCl && id !== '0' ? ['withdraw', '--position', id, '--burn'] : ['withdraw', '--pool', lp]
      const status = await cliTx(ctx, rec, args)
      if (status === 'fail') return 'failed'
      if (status === 'flaky') return 'flaky'
      if (status === 'ok') did = true
    }
  }
  return did ? 'did' : 'nothing'
}

/** Swap a full token balance above dust back to ETH. */
async function sweepTokenToEth(ctx: Ctx, rec: StepRecord, symbol: 'USDC' | 'AERO', balance: string): Promise<'did' | 'nothing' | 'failed' | 'flaky'> {
  const amount = Number(balance)
  if (!Number.isFinite(amount) || amount <= dustThreshold(ctx, symbol === 'USDC' ? 'usdc' : 'aero')) return 'nothing'
  const status = await cliTx(ctx, rec, ['swap', '--from-token', symbol, '--to-token', 'ETH', '--amount', balance, '--use-decimals'])
  if (status === 'fail') return 'failed'
  if (status === 'flaky') return 'flaky'
  return status === 'ok' ? 'did' : 'nothing'
}

/** Sell whatever NVDAc balance exists above dust back to USDC. */
async function sweepStocks(ctx: Ctx, rec: StepRecord): Promise<'did' | 'nothing' | 'failed' | 'flaky'> {
  if (!ctx.wallet) return 'nothing'
  const balances = await latestBalances(ctx).catch(() => null)
  if (!balances) return 'flaky'
  if (Number(balances.nvdac) <= dustThreshold(ctx, 'nvdac')) return 'nothing'
  const status = await cliTx(ctx, rec, ['stocks', 'sell', '--stock', 'NVDAc', '--amount', balances.nvdac])
  if (status === 'fail') return 'failed'
  if (status === 'flaky') return 'flaky'
  return status === 'ok' ? 'did' : 'nothing'
}

function buildSteps(): StepDef[] {
  const steps: StepDef[] = []
  const needCl = (ctx: Ctx) => ctx.clPositionId === null ? 'no CL position id (tx.deposit.cl did not run)' : undefined
  const needAlm = (ctx: Ctx) => ctx.almConfigured ? undefined : 'no ALM config (local.alm-init did not run)'
  const needIndex = (ctx: Ctx) => ctx.indexReady ? undefined : 'index not created'
  const needWallet = (ctx: Ctx) => ctx.wallet === null ? 'no wallet' : undefined

  steps.push(readStep({
    id: 'read.wallet-status', feature: 'wallet', title: 'Active wallet is the isolated local wallet',
    args: () => ['wallet', 'status'],
    check: (ctx, rec) => {
      assert(rec, 'reports a local encrypted wallet', rec.stdout.includes('local encrypted wallet'), rec.stdout.trim().slice(0, 160))
      assert(rec, 'prints the wallet address', ctx.wallet !== null && rec.stdout.includes(ctx.wallet), ctx.wallet ?? 'no wallet')
      return allOk(rec)
    },
  }))

  steps.push(readStep({
    id: 'read.pools', feature: 'reads', title: 'USDC/AERO pool list includes both pinned pools',
    args: () => ['pools', '--token0', 'USDC', '--token1', 'AERO', '--full', '--limit', '6'],
    check: (ctx, rec) => {
      const pools = asArray(rec.parsed) ?? []
      const lps = pools.map((pool) => String(asObject(pool)?.lp ?? '').toLowerCase())
      assert(rec, 'vAMM-USDC/AERO listed', lps.includes(BASIC_LP.toLowerCase()))
      assert(rec, 'CL2000-USDC/AERO listed', lps.includes(CL_LP.toLowerCase()))
      return allOk(rec)
    },
  }))

  steps.push(readStep({
    id: 'read.quote', feature: 'reads', title: 'ETH -> USDC quote returns a positive output',
    args: (ctx) => ['quote', '--from-token', 'ETH', '--to-token', 'USDC', '--amount', ctx.ethLeg, '--use-decimals'],
    check: (ctx, rec) => {
      const out = Number(asObject(rec.parsed)?.amount_out_decimal)
      assert(rec, 'amount_out_decimal > 0', Number.isFinite(out) && out > 0, String(out))
      return allOk(rec)
    },
  }))

  steps.push(readStep({
    id: 'read.positions.before', feature: 'reads', title: 'Positions list is a JSON array',
    args: () => ['positions'],
    check: (ctx, rec) => {
      assert(rec, 'positions is an array', asArray(rec.parsed) !== null)
      return allOk(rec)
    },
  }))

  steps.push(readStep({
    id: 'read.epochs-latest', feature: 'reads', title: 'Latest volatile epochs are non-empty',
    args: () => ['epochs-latest', '--pool-type', 'volatile'],
    check: (ctx, rec) => {
      const epochs = asArray(rec.parsed)
      assert(rec, 'non-empty array', epochs !== null && epochs.length > 0, `${epochs?.length ?? 'n/a'} epoch(s)`)
      return allOk(rec)
    },
  }))

  steps.push(readStep({
    id: 'read.epochs', feature: 'reads', title: 'Epoch history for the pinned volatile pool',
    args: () => ['epochs', '--lp', BASIC_LP, '--limit', '3'],
    check: (ctx, rec) => {
      const epochs = asArray(rec.parsed)
      assert(rec, 'non-empty array', epochs !== null && epochs.length > 0, `${epochs?.length ?? 'n/a'} epoch(s)`)
      return allOk(rec)
    },
  }))

  steps.push(readStep({
    id: 'read.stocks-list', feature: 'stocks', title: 'Stocks catalog lists all ten markets',
    args: () => ['stocks', 'list'],
    check: (ctx, rec) => {
      const stocks = asArray(rec.parsed)
      assert(rec, 'ten stocks listed', stocks !== null && stocks.length === 10, `${stocks?.length ?? 'n/a'}`)
      const nvda = stocks?.map(asObject).find((item) => item?.symbol === 'NVDAc')
      const price = Number(nvda?.price_usdc)
      if (Number.isFinite(price) && price > 0) ctx.nvdaPriceUsd = price
      return allOk(rec)
    },
  }))

  steps.push(readStep({
    id: 'read.executions.before', feature: 'executions', title: 'No active execution journal blocks new plans',
    modes: ['full', 'dry-run', 'reads', 'sweep'],
    args: () => ['executions', 'list'],
    check: (ctx, rec) => {
      const entries = (asArray(rec.parsed) ?? []).map(asObject).filter((item): item is Record<string, unknown> => item !== null)
      const active = entries.filter((entry) => entry.status === 'active')
      if (!assert(rec, 'no active execution', active.length === 0, active.map((entry) => String(entry.id)).join(', '))) {
        // Only modes that broadcast must stop; the unresolved-execution gate
        // lives in sendPlan, so reads and dry-run never touch it.
        if (ctx.mode === 'full' || ctx.mode === 'sweep') {
          rec.stderr += '\nreconcile first: scripts/aero executions resume --id <id> or scripts/aero executions cancel --id <id>\n'
          ctx.aborted = true
        }
        return 'fail'
      }
      return 'ok'
    },
  }))

  // Pre-run sweep (full and sweep modes): return strays to ETH.

  steps.push(sweepStep({
    id: 'sweep.pre.positions', title: 'Unstake and withdraw leftovers in the two pinned pools', modes: SWEEP_MODES,
    run: async (ctx, rec) => {
      const basic = await sweepPool(ctx, rec, BASIC_LP)
      if (basic === 'failed' || basic === 'flaky') return basic
      const cl = await sweepPool(ctx, rec, CL_LP)
      if (cl === 'failed' || cl === 'flaky') return cl
      return basic === 'did' || cl === 'did' ? 'did' : 'nothing'
    },
  }))

  steps.push(sweepStep({
    id: 'sweep.pre.venft-expired', title: 'Withdraw expired non-permanent veNFT locks via the SDK', modes: SWEEP_MODES,
    run: async (ctx, rec) => {
      if (!ctx.wallet) return 'nothing'
      const client = new SugarClient(CHAIN_ID, { account: ctx.wallet })
      let nfts
      try {
        nfts = await client.getVeNfts(ctx.wallet)
      } catch (cause) {
        rec.stderr += `${scrub(cause instanceof Error ? cause.message : String(cause))}\n`
        return FLAKY_PATTERN.test(rec.stderr) ? 'flaky' : 'failed'
      }
      const nowSeconds = Math.floor(Date.now() / 1000)
      // Managed veNFTs need withdrawVeNftFromManaged, not plain withdraw.
      const expired = nfts.filter((nft) => !nft.permanent && nft.managedId === 0n && nft.lockedAmount > 0n && nft.expiresAt > 0 && nft.expiresAt <= nowSeconds)
      assert(rec, 'enumerated veNFTs', true, `${nfts.length} total, ${expired.length} expired and withdrawable`)
      let did = false
      for (const nft of expired) {
        const status = await sdkVeNftWithdraw(ctx, rec, nft.id)
        if (status === 'fail') return 'failed'
        if (status === 'flaky') return 'flaky'
        if (status === 'ok') did = true
      }
      return did ? 'did' : 'nothing'
    },
  }))

  steps.push(sweepStep({
    id: 'sweep.pre.stocks', title: 'Sell any NVDAc balance above dust', modes: SWEEP_MODES,
    run: (ctx, rec) => sweepStocks(ctx, rec),
  }))

  for (const [id, symbol] of [['sweep.pre.usdc', 'USDC'], ['sweep.pre.aero', 'AERO']] as const) {
    steps.push(sweepStep({
      id, title: `Swap leftover ${symbol} above dust back to ETH`, modes: SWEEP_MODES,
      run: async (ctx, rec) => {
        if (!ctx.wallet) return 'nothing'
        const balances = await latestBalances(ctx).catch(() => null)
        if (!balances) return 'flaky'
        return sweepTokenToEth(ctx, rec, symbol, symbol === 'USDC' ? balances.usdc : balances.aero)
      },
    }))
  }

  // Swaps.

  steps.push(txStep({
    id: 'tx.swap.eth-usdc', feature: 'swap', title: 'Swap the ETH leg into USDC',
    args: (ctx) => ['swap', '--from-token', 'ETH', '--to-token', 'USDC', '--amount', ctx.ethLeg, '--use-decimals'],
    check: async (ctx, rec) => {
      const minOut = asObject(rec.plan?.quote)?.min_amount_out
      if (rec.balanceDelta === null) return 'flaky'
      const delta = rec.balanceDelta.usdc
      assert(rec, 'USDC delta covers min_amount_out', minOut !== undefined && Number(delta) >= Number(formatUnits(BigInt(String(minOut)), 6)), `delta ${delta} USDC vs min ${String(minOut)}`)
      return allOk(rec)
    },
  }))

  steps.push(txStep({
    id: 'tx.swap.eth-aero', feature: 'swap', title: 'Swap the ETH leg into AERO',
    args: (ctx) => ['swap', '--from-token', 'ETH', '--to-token', 'AERO', '--amount', ctx.ethLeg, '--use-decimals'],
    check: async (ctx, rec) => {
      const minOut = asObject(rec.plan?.quote)?.min_amount_out
      if (rec.balanceDelta === null) return 'flaky'
      const delta = rec.balanceDelta.aero
      assert(rec, 'AERO delta covers min_amount_out', minOut !== undefined && Number(delta) >= Number(formatUnits(BigInt(String(minOut)), 18)), `delta ${delta} AERO vs min ${String(minOut)}`)
      return allOk(rec)
    },
  }))

  // Basic (vAMM) liquidity lifecycle.

  steps.push(txStep({
    id: 'tx.deposit.basic', feature: 'liquidity-basic', title: 'Deposit into vAMM-USDC/AERO',
    args: (ctx) => ['deposit', '--pool', BASIC_LP, '--amount0', ctx.usdcHalf, '--use-decimals'],
    check: async (ctx, rec) => {
      const hasLiquidity = (all: Record<string, unknown>[]) => positionsInPool(all, BASIC_LP).some((position) => bigOf(position.liquidity) > 0n)
      const ours = positionsInPool(await positionsUntil(ctx, rec, hasLiquidity), BASIC_LP)
      assert(rec, 'position with liquidity exists', ours.some((position) => bigOf(position.liquidity) > 0n), `${ours.length} position(s) in pool`)
      return allOk(rec)
    },
  }))

  steps.push(txStep({
    id: 'tx.stake.basic', feature: 'liquidity-basic', title: 'Stake the basic position in its gauge',
    args: () => ['stake', '--pool', BASIC_LP],
    check: async (ctx, rec) => {
      const isStaked = (all: Record<string, unknown>[]) => positionsInPool(all, BASIC_LP).some((position) => bigOf(position.staked) > 0n)
      const ours = positionsInPool(await positionsUntil(ctx, rec, isStaked), BASIC_LP)
      assert(rec, 'staked > 0', ours.some((position) => bigOf(position.staked) > 0n))
      return allOk(rec)
    },
  }))

  steps.push(txStep({
    id: 'tx.claim-emissions.basic', feature: 'liquidity-basic', title: 'Claim emissions on the staked basic position',
    args: () => ['claim-emissions', '--pool', BASIC_LP],
  }))

  steps.push(txStep({
    id: 'tx.unstake.basic', feature: 'liquidity-basic', title: 'Unstake the basic position',
    args: () => ['unstake', '--pool', BASIC_LP],
    check: async (ctx, rec) => {
      const isUnstaked = (all: Record<string, unknown>[]) => positionsInPool(all, BASIC_LP).every((position) => bigOf(position.staked) === 0n)
      const ours = positionsInPool(await positionsUntil(ctx, rec, isUnstaked), BASIC_LP)
      assert(rec, 'staked == 0', ours.every((position) => bigOf(position.staked) === 0n))
      assert(rec, 'liquidity > 0', ours.some((position) => bigOf(position.liquidity) > 0n))
      return allOk(rec)
    },
  }))

  steps.push(txStep({
    id: 'tx.claim-fees.basic', feature: 'liquidity-basic', title: 'Claim LP fees on the basic position',
    args: () => ['claim-fees', '--pool', BASIC_LP],
  }))

  steps.push(txStep({
    id: 'tx.withdraw.basic', feature: 'liquidity-basic', title: 'Withdraw all basic liquidity',
    args: () => ['withdraw', '--pool', BASIC_LP],
    check: async (ctx, rec) => {
      const isEmpty = (all: Record<string, unknown>[]) => positionsInPool(all, BASIC_LP).every((position) => bigOf(position.liquidity) === 0n && bigOf(position.staked) === 0n)
      const ours = positionsInPool(await positionsUntil(ctx, rec, isEmpty), BASIC_LP)
      assert(rec, 'no liquidity left in pool', ours.every((position) => bigOf(position.liquidity) === 0n && bigOf(position.staked) === 0n))
      const delta = rec.balanceDelta
      if (delta === null) return 'flaky'
      assert(rec, 'USDC and AERO increased', Number(delta.usdc) > 0 && Number(delta.aero) > 0, `+${delta.usdc} USDC +${delta.aero} AERO`)
      return allOk(rec)
    },
  }))

  // CL liquidity lifecycle and the ALM dry-run.

  steps.push(txStep({
    id: 'tx.deposit.cl', feature: 'liquidity-cl', title: 'Deposit into CL2000-USDC/AERO around spot',
    args: (ctx) => ['deposit', '--pool', CL_LP, '--amount0', ctx.usdcHalf, '--price-lower', ctx.clPriceLower, '--price-upper', ctx.clPriceUpper, '--use-decimals'],
    check: async (ctx, rec) => {
      const hasCl = (all: Record<string, unknown>[]) => positionsInPool(all, CL_LP).some((position) => positionPool(position).is_cl === true && bigOf(position.liquidity) > 0n)
      const ours = positionsInPool(await positionsUntil(ctx, rec, hasCl), CL_LP)
        .filter((position) => positionPool(position).is_cl === true && bigOf(position.liquidity) > 0n)
      if (!assert(rec, 'CL position with liquidity exists', ours.length > 0)) return 'fail'
      const chosen = ours.reduce((top, position) => bigOf(position.id) > bigOf(top.id) ? position : top)
      // Several NFTs in the pool (a stray from an earlier run) is a warning,
      // not a failure: the newest id is the one this run minted.
      if (ours.length > 1) assert(rec, 'single CL position in pool (warning)', true, `${ours.length} found; using highest id ${String(chosen.id)}`)
      ctx.clPositionId = String(chosen.id)
      assert(rec, 'captured position id', /^\d+$/.test(ctx.clPositionId), ctx.clPositionId)
      return allOk(rec)
    },
  }))

  steps.push(localStep({
    id: 'local.alm-init', feature: 'alm', title: 'Scaffold the ALM config for the CL position',
    args: (ctx) => ['alm', 'init', '--force', '--position-id', ctx.clPositionId ?? '0'],
    needs: needCl,
    check: async (ctx, rec) => {
      const configPath = ctx.layout.almConfig
      if (!assert(rec, 'alm.json written', existsSync(configPath), configPath)) return 'fail'
      const config = asObject(JSON.parse(readFileSync(configPath, 'utf8')))
      const entries = asArray(config?.positions) ?? []
      const names = entries.map((entry) => String(asObject(entry)?.pool ?? '').toLowerCase())
      assert(rec, 'config names the CL pool', names.includes(CL_LP.toLowerCase()), names.join(', '))
      ctx.almConfigured = allOk(rec) === 'ok'
      return allOk(rec)
    },
  }))

  steps.push(readStep({
    id: 'read.alm-status', feature: 'alm', title: 'ALM status reports the position in range',
    modes: ['full', 'dry-run'],
    needs: needAlm,
    args: () => ['alm', 'status'],
    check: (ctx, rec) => {
      const entries = asArray(rec.parsed) ?? []
      const entry = entries.map(asObject).find((item) => String(item?.pool ?? '').toLowerCase() === CL_LP.toLowerCase())
      if (!assert(rec, 'status entry for CL pool', entry !== undefined)) return 'fail'
      assert(rec, 'in_range is true', entry?.in_range === true, String(entry?.in_range))
      assert(rec, 'position_id matches', String(entry?.position_id) === ctx.clPositionId, `${String(entry?.position_id)} vs ${ctx.clPositionId}`)
      return allOk(rec)
    },
  }))

  steps.push({
    id: 'read.alm-serve-once', title: 'One ALM serve pass in dry-run broadcasts nothing', feature: 'alm', kind: 'read', modes: ['full', 'dry-run'],
    needs: needAlm,
    run: async (ctx, rec) => {
      const beforeList = existsSync(ctx.layout.executionsDir) ? readdirSync(ctx.layout.executionsDir).sort() : []
      const result = await cli(rec, ['serve', '--once'])
      const afterList = existsSync(ctx.layout.executionsDir) ? readdirSync(ctx.layout.executionsDir).sort() : []
      if (result.exitCode !== 0) return classifyFailure(ctx, result)
      assert(rec, 'no journal written (nothing broadcast)', JSON.stringify(beforeList) === JSON.stringify(afterList), `${beforeList.length} -> ${afterList.length} file(s)`)
      return allOk(rec)
    },
  })

  steps.push(txStep({
    id: 'tx.stake.cl', feature: 'liquidity-cl', title: 'Stake the CL position (approve + deposit)',
    args: (ctx) => ['stake', '--position', ctx.clPositionId ?? '0'],
    needs: needCl,
    check: async (ctx, rec) => {
      const isStaked = (all: Record<string, unknown>[]) => positionsInPool(all, CL_LP).some((position) => String(position.id) === ctx.clPositionId && bigOf(position.staked) > 0n)
      const target = positionsInPool(await positionsUntil(ctx, rec, isStaked), CL_LP).find((position) => String(position.id) === ctx.clPositionId)
      assert(rec, 'staked > 0', target !== undefined && bigOf(target.staked) > 0n)
      return allOk(rec)
    },
  }))

  steps.push(txStep({
    id: 'tx.claim-emissions.cl', feature: 'liquidity-cl', title: 'Claim emissions on the staked CL position',
    args: (ctx) => ['claim-emissions', '--position', ctx.clPositionId ?? '0'],
    needs: needCl,
  }))

  steps.push(txStep({
    id: 'tx.unstake.cl', feature: 'liquidity-cl', title: 'Unstake the CL position',
    args: (ctx) => ['unstake', '--position', ctx.clPositionId ?? '0'],
    needs: needCl,
    check: async (ctx, rec) => {
      const isUnstaked = (all: Record<string, unknown>[]) => positionsInPool(all, CL_LP).some((position) => String(position.id) === ctx.clPositionId && bigOf(position.staked) === 0n)
      const target = positionsInPool(await positionsUntil(ctx, rec, isUnstaked), CL_LP).find((position) => String(position.id) === ctx.clPositionId)
      assert(rec, 'staked == 0', target !== undefined && bigOf(target.staked) === 0n)
      return allOk(rec)
    },
  }))

  steps.push(txStep({
    id: 'tx.claim-fees.cl', feature: 'liquidity-cl', title: 'Claim fees on the CL position',
    args: (ctx) => ['claim-fees', '--position', ctx.clPositionId ?? '0'],
    needs: needCl,
  }))

  steps.push(txStep({
    id: 'tx.withdraw.cl', feature: 'liquidity-cl', title: 'Withdraw the CL position and burn the NFT',
    args: (ctx) => ['withdraw', '--position', ctx.clPositionId ?? '0', '--burn'],
    needs: needCl,
    check: async (ctx, rec) => {
      const isGone = (all: Record<string, unknown>[]) => !positionsInPool(all, CL_LP).some((position) => String(position.id) === ctx.clPositionId)
      const ours = positionsInPool(await positionsUntil(ctx, rec, isGone), CL_LP)
      assert(rec, 'position id gone from positions', !ours.some((position) => String(position.id) === ctx.clPositionId))
      return allOk(rec)
    },
  }))

  // veNFT, stocks, indices.

  steps.push(txStep({
    id: 'tx.create-venft', feature: 'venft', title: 'Lock AERO into a one-week veNFT',
    args: (ctx) => ['create-venft', '--amount', ctx.venftAero, '--use-decimals', '--lock-duration-seconds', '604800'],
    check: async (ctx, rec) => {
      if (rec.balanceDelta === null) return 'flaky'
      assert(rec, 'veNFT count +1', rec.balanceDelta.veNftCount === '1', rec.balanceDelta.veNftCount)
      return allOk(rec)
    },
  }))

  steps.push({
    id: 'tx.stocks.buy', title: 'Buy NVDAc with USDC', feature: 'stocks', kind: 'tx', modes: TX_MODES,
    run: async (ctx, rec) => {
      if (!ctx.wallet) return 'skipped'
      const balances = await latestBalances(ctx).catch(() => null)
      if (!balances) return 'flaky'
      const spend = Math.min(ctx.budgetUsd, 0.95 * Number(balances.usdc))
      if (spend < DUST_USD) return 'skipped'
      const status = await cliTx(ctx, rec, ['stocks', 'buy', '--stock', 'NVDAc', '--amount', spend.toFixed(6)])
      if (status !== 'ok') return status
      if (rec.balanceDelta === null) return 'flaky'
      assert(rec, 'NVDAc balance increased', Number(rec.balanceDelta.nvdac) > 0, rec.balanceDelta.nvdac)
      return allOk(rec)
    },
  })

  steps.push({
    id: 'tx.stocks.sell', title: 'Sell the full NVDAc balance back to USDC', feature: 'stocks', kind: 'tx', modes: TX_MODES,
    run: async (ctx, rec) => {
      if (!ctx.wallet) return 'skipped'
      const balances = await latestBalances(ctx).catch(() => null)
      if (!balances) return 'flaky'
      if (Number(balances.nvdac) <= 0) return 'skipped'
      const status = await cliTx(ctx, rec, ['stocks', 'sell', '--stock', 'NVDAc', '--amount', balances.nvdac])
      if (status !== 'ok') return status
      // Read at the step's receipt block so the check cannot race the node.
      const maxBlock = rec.receipts.reduce((top, receipt) => BigInt(receipt.blockNumber) > top ? BigInt(receipt.blockNumber) : top, 0n)
      const after = await readBalances(ctx.client, ctx.wallet, ctx.nvdacDecimals, maxBlock > 0n ? maxBlock : undefined).catch(() => null)
      if (after === null) return 'flaky'
      assert(rec, 'NVDAc balance is zero', Number(after.nvdac) === 0, after.nvdac)
      return allOk(rec)
    },
  })

  steps.push(localStep({
    id: 'local.index.create', feature: 'indices', title: 'Save a 50/50 NVDAc/AAPLc index',
    args: () => ['index', 'create', '--name', 'aero-verify', '--allocations', 'NVDAc=50,AAPLc=50'],
    check: async (ctx, rec) => {
      const parsed = asObject(rec.parsed)
      const ok = assert(rec, 'index saved', parsed?.name === 'aero-verify' && parsed?.allocations === 'NVDAc=50,AAPLc=50', JSON.stringify(parsed))
      ctx.indexReady = ok
      return allOk(rec)
    },
  }))

  steps.push(localStep({
    id: 'local.index.list', feature: 'indices', title: 'List includes the saved index',
    args: () => ['index', 'list'],
    needs: needIndex,
    check: async (ctx, rec) => {
      const names = (asArray(rec.parsed) ?? []).map((item) => asObject(item)?.name)
      assert(rec, 'aero-verify listed', names.includes('aero-verify'), names.join(', '))
      return allOk(rec)
    },
  }))

  steps.push(localStep({
    id: 'local.index.show', feature: 'indices', title: 'Show reads back the saved weights',
    args: () => ['index', 'show', '--name', 'aero-verify'],
    needs: needIndex,
    check: async (ctx, rec) => {
      const parsed = asObject(rec.parsed)
      assert(rec, 'allocations round-trip', parsed?.allocations === 'NVDAc=50,AAPLc=50', String(parsed?.allocations))
      return allOk(rec)
    },
  }))

  steps.push(readStep({
    id: 'read.index.rebalance-dry-run', feature: 'indices', title: 'Index rebalance dry-run prints a trades plan',
    modes: LOCAL_MODES,
    needs: needIndex,
    args: () => ['index', 'rebalance', '--name', 'aero-verify', '--cash', '0.5', '--dry-run'],
    check: (ctx, rec) => {
      assert(rec, 'plan has trades array', asArray(asObject(rec.parsed)?.trades) !== null)
      return allOk(rec)
    },
  }))

  steps.push(localStep({
    id: 'local.index.update', feature: 'indices', title: 'Replace the weights with NVDAc=100',
    args: () => ['index', 'update', '--name', 'aero-verify', '--allocations', 'NVDAc=100'],
    needs: needIndex,
    check: async (ctx, rec) => {
      assert(rec, 'allocations updated', asObject(rec.parsed)?.allocations === 'NVDAc=100', String(asObject(rec.parsed)?.allocations))
      return allOk(rec)
    },
  }))

  steps.push(localStep({
    id: 'local.index.delete', feature: 'indices', title: 'Delete the saved index',
    args: () => ['index', 'delete', '--name', 'aero-verify'],
    needs: needIndex,
    check: async (ctx, rec) => {
      const list = await cli(rec, ['index', 'list'])
      const names = (asArray(extractLastJson(list.stdout)) ?? []).map((item) => asObject(item)?.name)
      assert(rec, 'index gone', !names.includes('aero-verify'), names.join(', '))
      ctx.indexReady = false
      return allOk(rec)
    },
  }))

  // Post-run sweep: everything back to ETH.

  steps.push(sweepStep({
    id: 'sweep.post.stocks', title: 'Sell any leftover NVDAc', modes: ['full'],
    run: (ctx, rec) => sweepStocks(ctx, rec),
  }))

  for (const [id, symbol] of [['sweep.post.usdc', 'USDC'], ['sweep.post.aero', 'AERO']] as const) {
    steps.push(sweepStep({
      id, title: `Swap remaining ${symbol} above dust back to ETH`, modes: ['full'],
      run: async (ctx, rec) => {
        if (!ctx.wallet) return 'nothing'
        const balances = await latestBalances(ctx).catch(() => null)
        if (!balances) return 'flaky'
        return sweepTokenToEth(ctx, rec, symbol, symbol === 'USDC' ? balances.usdc : balances.aero)
      },
    }))
  }


  // Finals.

  steps.push(readStep({
    id: 'read.positions.after', feature: 'reads', title: 'No liquidity or stake remains in the pinned pools',
    args: () => ['positions'],
    check: (ctx, rec) => {
      const all = (asArray(rec.parsed) ?? []).filter((item): item is Record<string, unknown> => asObject(item) !== null)
      const remaining = [...positionsInPool(all, BASIC_LP), ...positionsInPool(all, CL_LP)]
        .filter((position) => bigOf(position.liquidity) > 0n || bigOf(position.staked) > 0n)
      assert(rec, 'pinned pools are empty', remaining.length === 0, `${remaining.length} position(s) left`)
      return allOk(rec)
    },
  }))

  steps.push(readStep({
    id: 'read.executions.after', feature: 'executions', title: 'Every journal settled; none active or failed',
    args: () => ['executions', 'list'],
    check: (ctx, rec) => {
      const entries = (asArray(rec.parsed) ?? []).map(asObject).filter((item): item is Record<string, unknown> => item !== null)
      // Judge only journals this run created or touched, the same rule the
      // journal copy uses; historical journals belong to their own runs.
      const touchedThisRun = (id: unknown): boolean => {
        if (typeof id !== 'string' || !JOURNAL_NAME.test(`${id}.json`)) return true
        const file = join(ctx.layout.executionsDir, `${id}.json`)
        if (!existsSync(file)) return true
        const previous = ctx.journalSnapshot.get(`${id}.json`)
        return previous === undefined || statSync(file).mtimeMs > previous
      }
      const bad = entries.filter((entry) => (entry.status === 'active' || entry.status === 'failed') && touchedThisRun(entry.id))
      assert(rec, 'no active or failed journals from this run', bad.length === 0, bad.map((entry) => `${String(entry.id)}:${String(entry.status)}`).join(', '))
      return allOk(rec)
    },
  }))

  steps.push({
    id: 'final.balances', title: 'Record balances, gas spend, and leftover dust', feature: 'final', kind: 'local', modes: ['full', 'sweep', 'dry-run'],
    needs: needWallet,
    run: async (ctx, rec) => {
      const after = ctx.wallet ? await latestBalances(ctx).catch(() => null) : null
      if (!after) return 'flaky'
      rec.parsed = { before: ctx.before, after }
      const dust: string[] = []
      if (Number(after.usdc) > dustThreshold(ctx, 'usdc')) dust.push(`usdc ${after.usdc}`)
      if (Number(after.aero) > dustThreshold(ctx, 'aero')) dust.push(`aero ${after.aero}`)
      if (Number(after.nvdac) > dustThreshold(ctx, 'nvdac')) dust.push(`nvdac ${after.nvdac}`)
      // In dry-run nothing was sent, so dust only documents the wallet state.
      if (ctx.mode !== 'dry-run') {
        assert(rec, 'all non-ETH balances below dust ($0.05)', dust.length === 0, dust.join(', ') || 'clean')
      }
      return allOk(rec)
    },
  })

  return steps
}

// --- summary, compare, report -----------------------------------------------

type StepSummary = {
  id: string
  feature: string
  kind: StepKind
  status: StepStatus
  hashes: string[]
  txCount: number
  gasUsedWei: string
  durationMs: number
  reason?: string
  attempts: number
}

type CompareRow = { id: string; baseline: string; current: string; verdict: 'REGRESSION' | 'WARN' | 'INFO' | 'same'; detail?: string }

function compareWithBaseline(steps: StepRecord[], baselineRaw: unknown): CompareRow[] {
  const baseline = asObject(baselineRaw)
  const baseSteps = new Map<string, Record<string, unknown>>()
  for (const item of asArray(baseline?.steps) ?? []) {
    const step = asObject(item)
    if (step && typeof step.id === 'string') baseSteps.set(step.id, step)
  }
  const rows: CompareRow[] = []
  const seen = new Set<string>()
  for (const step of steps) {
    seen.add(step.id)
    const base = baseSteps.get(step.id)
    if (!base) {
      rows.push({ id: step.id, baseline: 'absent', current: step.status, verdict: 'INFO', detail: 'new step' })
      continue
    }
    const baseStatus = String(base.status)
    const baseTxCount = Number(base.txCount ?? -1)
    const txCount = asArray(step.plan?.transaction_steps)?.length ?? step.hashes.length
    if (baseStatus === 'ok' && step.status === 'fail') {
      rows.push({ id: step.id, baseline: baseStatus, current: step.status, verdict: 'REGRESSION', detail: step.reason })
    } else if (baseStatus === 'ok' && step.status === 'skipped') {
      rows.push({ id: step.id, baseline: baseStatus, current: step.status, verdict: 'WARN', detail: step.reason })
    } else if (baseStatus === 'ok' && step.status === 'ok' && step.kind === 'tx' && baseTxCount >= 0 && txCount !== baseTxCount) {
      rows.push({ id: step.id, baseline: baseStatus, current: step.status, verdict: 'WARN', detail: `plan tx count ${baseTxCount} -> ${txCount}` })
    } else {
      rows.push({ id: step.id, baseline: baseStatus, current: step.status, verdict: 'same' })
    }
  }
  for (const [id, base] of baseSteps) {
    if (!seen.has(id)) rows.push({ id, baseline: String(base.status), current: 'absent', verdict: 'WARN', detail: 'step no longer runs' })
  }
  return rows
}

function stepSummary(step: StepRecord): StepSummary {
  const gasUsedWei = step.receipts.reduce((sum, receipt) => sum + BigInt(receipt.gasUsed), 0n)
  return {
    id: step.id,
    feature: step.feature,
    kind: step.kind,
    status: step.status,
    hashes: step.hashes,
    txCount: asArray(step.plan?.transaction_steps)?.length ?? step.hashes.length,
    gasUsedWei: gasUsedWei.toString(),
    durationMs: step.durationMs,
    reason: step.reason,
    attempts: step.attempts,
  }
}

function renderReport(ctx: Ctx, summary: Record<string, unknown>, compare: CompareRow[] | null): string {
  const lines: string[] = []
  lines.push(`# verify-aero run ${ctx.runId}`)
  lines.push('')
  lines.push(`Mode ${ctx.mode} on Base ${CHAIN_ID} from wallet ${ctx.wallet ?? 'unknown'}. RPC ${rpcKind()}. Budget $${ctx.budgetUsd}.`)
  lines.push('')
  lines.push('## Steps')
  lines.push('')
  lines.push('| step | feature | kind | status | txs | gas (wei) | ms | note |')
  lines.push('| --- | --- | --- | --- | --- | --- | --- | --- |')
  for (const step of ctx.steps) {
    const gas = step.receipts.reduce((sum, receipt) => sum + BigInt(receipt.gasUsed), 0n)
    lines.push(`| ${step.id} | ${step.feature} | ${step.kind} | ${step.status} | ${step.hashes.length} | ${gas.toString()} | ${step.durationMs} | ${step.reason ?? ''} |`)
  }
  lines.push('')
  lines.push('## Money')
  lines.push('')
  const totals = asObject(summary.totals)
  if (totals) {
    const balances = asObject(summary.balances)
    const before = asObject(balances?.before)
    const after = asObject(balances?.after)
    if (before || after) {
      lines.push(`ETH before/after: ${String(before?.eth ?? 'n/a')} -> ${String(after?.eth ?? 'n/a')} ETH.`)
    }
    lines.push(`Prices used: ETH/USD ${ctx.ethUsd === null ? 'unavailable' : `$${ctx.ethUsd.toFixed(2)}`}, AERO/USD ${ctx.aeroUsd === null ? 'unavailable' : `$${ctx.aeroUsd.toFixed(4)}`}.`)
    lines.push(`Transactions sent: ${String(totals.txCount)}. Gas spent: ${String(totals.gasUsedWei)} wei.`)
    lines.push(`Net ETH delta: ${String(totals.netEthDeltaWei)} wei (${String(totals.netEthDeltaUsd)} USD).`)
    const dust = asArray(totals.dust) ?? []
    lines.push(dust.length ? `Leftover dust above $${DUST_USD}: ${dust.join(', ')}.` : 'No leftover dust above $0.05.')
    lines.push(`veNFTs held: ${String(totals.veNftCount)}.`)
  } else {
    lines.push('No balance snapshot was captured.')
  }
  lines.push('')
  if (compare) {
    lines.push('## Compare with baseline')
    lines.push('')
    lines.push('| step | baseline | now | verdict | detail |')
    lines.push('| --- | --- | --- | --- | --- |')
    for (const row of compare) {
      lines.push(`| ${row.id} | ${row.baseline} | ${row.current} | ${row.verdict} | ${row.detail ?? ''} |`)
    }
    lines.push('')
  }
  lines.push('## Evidence')
  lines.push('')
  lines.push(`Run dir: ${ctx.runDir}`)
  lines.push(`Steps: ${ctx.stepsDir}`)
  lines.push(`Journals: ${ctx.journalsDir}`)
  lines.push(`Summary: ${join(ctx.runDir, 'summary.json')}`)
  lines.push('')
  return lines.join('\n')
}

// --- main --------------------------------------------------------------------

type ParsedArgs = { mode: Mode; only: string[]; skip: string[]; budgetUsd: number; accept: boolean; noCompare: boolean }

function parseArgs(argv: string[]): ParsedArgs {
  const parsed: ParsedArgs = { mode: 'full', only: [], skip: [], budgetUsd: 0.8, accept: false, noCompare: false }
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index]
    const [flag, inline] = arg.split('=', 2) as [string, string?]
    const value = () => inline ?? argv[++index]
    if (flag === '--mode') parsed.mode = value() as Mode
    else if (flag === '--only') parsed.only = (value() ?? '').split(',').filter(Boolean)
    else if (flag === '--skip') parsed.skip = (value() ?? '').split(',').filter(Boolean)
    else if (flag === '--budget-usd') parsed.budgetUsd = Number(value())
    else if (flag === '--accept') parsed.accept = true
    else if (flag === '--no-compare') parsed.noCompare = true
    else throw new Error(`unknown flag ${arg}`)
  }
  if (!['full', 'dry-run', 'reads', 'sweep'].includes(parsed.mode)) throw new Error(`unknown --mode ${parsed.mode}`)
  if (!Number.isFinite(parsed.budgetUsd) || parsed.budgetUsd <= 0) throw new Error('--budget-usd must be a positive number')
  return parsed
}

function makeRunId(mode: Mode): string {
  const now = new Date()
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}-${mode}`
}

function snapshotJournals(executionsDir: string): Map<string, number> {
  const map = new Map<string, number>()
  if (!existsSync(executionsDir)) return map
  for (const name of readdirSync(executionsDir)) {
    if (name.endsWith('.json')) map.set(name, statSync(join(executionsDir, name)).mtimeMs)
  }
  return map
}

async function aeroQuoteDecimal(fromToken: string, toToken: string, amount: string): Promise<number | null> {
  const result = await runAero(['quote', '--from-token', fromToken, '--to-token', toToken, '--amount', amount, '--use-decimals'])
  const out = Number(asObject(extractLastJson(result.stdout))?.amount_out_decimal)
  return Number.isFinite(out) && out > 0 ? out : null
}

async function main(): Promise<number> {
  const args = parseArgs(process.argv.slice(2))
  const layout = applyVerifyEnv(verifyHome())
  const id = makeRunId(args.mode)
  const runDir = join(layout.runsDir, id)
  const stepsDir = join(runDir, 'steps')
  const journalsDir = join(runDir, 'journals')
  mkdirSync(stepsDir, { recursive: true })
  mkdirSync(journalsDir, { recursive: true })

  const ctx: Ctx = {
    mode: args.mode,
    layout,
    client: publicClient(),
    wallet: null,
    budgetUsd: args.budgetUsd,
    ethUsd: null,
    aeroUsd: null,
    ethLeg: '0',
    usdcHalf: round6(args.budgetUsd / 2),
    venftAero: '0',
    clPriceLower: '0',
    clPriceUpper: '0',
    nvdacDecimals: 18,
    nvdaPriceUsd: null,
    clPositionId: null,
    almConfigured: false,
    indexReady: false,
    before: null,
    journalSnapshot: new Map(),
    aborted: false,
    upstreamFailed: false,
    minBlock: 0n,
    steps: [],
    runId: id,
    runDir,
    stepsDir,
    journalsDir,
    interrupted: false,
  }

  const refuse = (problems: string[]): number => {
    console.error('Preflight refused:')
    for (const problem of problems) console.error(`  - ${problem}`)
    const summary = {
      runId: id, mode: args.mode, startedAt: new Date().toISOString(), finishedAt: new Date().toISOString(),
      gitRev: gitInfo(repoRoot()).rev, chain: CHAIN_ID, wallet: ctx.wallet, rpc: rpcKind(), budgetUsd: args.budgetUsd,
      prices: { ethUsd: null, aeroUsd: null }, steps: [], balances: { before: null, after: null },
      totals: { txCount: 0, gasUsedWei: '0', netEthDeltaWei: '0', netEthDeltaUsd: null, dust: [], veNftCount: 0 },
      compare: null, refused: problems,
    }
    writeFileSync(join(runDir, 'summary.json'), JSON.stringify(summary, null, 2))
    writeFileSync(join(runDir, 'report.md'), `# verify-aero run ${id}\n\nPreflight refused.\n\n${problems.map((problem) => `- ${problem}`).join('\n')}\n`)
    return 3
  }

  // Preflight: doctor, run lock, then pricing, sizing, and snapshots.
  let doctor: Awaited<ReturnType<typeof runDoctor>> | null = null
  if (args.mode !== 'reads') {
    doctor = await runDoctor({ budgetUsd: args.budgetUsd })
    writeFileSync(join(runDir, 'doctor.json'), JSON.stringify(doctor, null, 2))
    ctx.wallet = doctor.wallet.address as Address | null
    // In dry-run mode nothing is broadcast, so a thin wallet or a stale
    // active journal does not block; missing funds only downgrade the steps
    // that need a balance.
    const blocking = args.mode === 'dry-run'
      ? doctor.problems.filter((problem) => !/ETH balance|could not price ETH|active execution journal/.test(problem))
      : [...doctor.problems]
    if ((args.mode === 'full' || args.mode === 'sweep') && doctor.rpc.receipts === false) {
      blocking.push(
        `endpoint cannot serve eth_getTransactionReceipt (${doctor.rpc.receiptsError ?? 'probe failed'}); the CLI would strand every plan as active. Pin a receipt-capable endpoint via AERO_VERIFY_RPC in $AERO_VERIFY_HOME/env`,
      )
    }
    if (blocking.length > 0) return refuse(blocking)
    try {
      acquireRunLock(layout.runLock)
    } catch (error) {
      return refuse([error instanceof Error ? error.message : String(error)])
    }
  } else {
    doctor = await runDoctor({ budgetUsd: args.budgetUsd }).catch(() => null)
    if (doctor) writeFileSync(join(runDir, 'doctor.json'), JSON.stringify(doctor, null, 2))
    ctx.wallet = (doctor?.wallet.address as Address | undefined) ?? null
  }

  const releaseLock = () => {
    try {
      if (existsSync(layout.runLock)) {
        const existing = JSON.parse(readFileSync(layout.runLock, 'utf8')) as { pid?: number }
        if (existing.pid === process.pid) rmSync(layout.runLock)
      }
    } catch { /* leave a foreign lock for cleanup.sh */ }
  }

  process.on('SIGINT', () => {
    ctx.interrupted = true
    killActiveProcs()
  })

  try {
    if (!ctx.wallet) {
      const status = await runAero(['wallet', 'status'])
      const match = status.stdout.match(/0x[0-9a-fA-F]{40}/)
      ctx.wallet = match ? match[0] as Address : null
    }

    // Sizing from live prices. Real transactions never use made-up prices:
    // full and sweep refuse when live pricing is unavailable. Dry-run and
    // reads fall back so plan building can still be exercised on a dead RPC.
    ctx.ethUsd = doctor?.ethUsd ?? await ethUsdPrice().catch(() => null)
    const aeroPerUsdc = await aeroQuoteDecimal('USDC', 'AERO', '1').catch(() => null)
    ctx.aeroUsd = aeroPerUsdc !== null && aeroPerUsdc > 0 ? 1 / aeroPerUsdc : null
    let pricesFallback = false
    if (args.mode === 'full' || args.mode === 'sweep') {
      const missing: string[] = []
      if (ctx.ethUsd === null) missing.push('ETH/USD')
      if (ctx.aeroUsd === null) missing.push('AERO/USDC')
      if (missing.length > 0) return refuse([`live pricing unavailable for ${missing.join(' and ')}; refusing to size real transactions on made-up prices`])
    } else if (ctx.ethUsd === null || ctx.aeroUsd === null) {
      pricesFallback = true
    }
    const ethUsd = ctx.ethUsd ?? 3000
    const aeroUsd = ctx.aeroUsd ?? 0.5
    const aeroPerUsdcSafe = aeroPerUsdc ?? 2
    ctx.ethLeg = round6(args.budgetUsd / ethUsd)
    ctx.venftAero = round6(0.3 / aeroUsd)
    ctx.clPriceLower = String(Math.round(aeroPerUsdcSafe * 0.5 * 1e6) / 1e6)
    ctx.clPriceUpper = String(Math.round(aeroPerUsdcSafe * 2 * 1e6) / 1e6)
    const sizings: [string, number][] = [
      ['ethLeg', Number(ctx.ethLeg) * ethUsd],
      ['usdcHalf', Number(ctx.usdcHalf)],
      ['venftAero', Number(ctx.venftAero) * aeroUsd],
    ]
    for (const [label, usd] of sizings) {
      if (usd > args.budgetUsd * 1.000_001) throw new Error(`sizing: ${label} is $${usd.toFixed(4)} over --budget-usd ${args.budgetUsd}`)
    }

    if (ctx.wallet) {
      ctx.nvdacDecimals = await tokenDecimals(ctx.client, NVDAC).catch(() => 18)
      ctx.before = await readBalances(ctx.client, ctx.wallet, ctx.nvdacDecimals).catch(() => null)
    }
    ctx.journalSnapshot = snapshotJournals(layout.executionsDir)

    writeFileSync(join(runDir, 'env.json'), JSON.stringify({
      home: layout.home,
      rpcKind: rpcKind(),
      git: gitInfo(repoRoot()),
      bun: Bun.version,
      budgetUsd: args.budgetUsd,
      wallet: ctx.wallet,
      mode: args.mode,
      pricesFallback,
    }, null, 2))

    const allSteps = buildSteps()
    const wanted = (step: StepDef): boolean => {
      const hits = (filter: string) => step.id === filter || step.id.startsWith(`${filter}.`) || step.feature === filter
      if (args.only.length > 0 && !args.only.some(hits)) return false
      if (args.skip.some(hits)) return false
      return step.modes.includes(args.mode)
    }

    // A --only run on tx steps that skips the funding swaps needs USDC/AERO
    // already in the wallet; warn when there is nothing to spend.
    const selected = allSteps.filter(wanted)
    const needsFunding = selected.some((step) => step.kind === 'tx' && !step.id.startsWith('tx.swap.'))
    const hasFundingSwap = selected.some((step) => step.id.startsWith('tx.swap.'))
    if (args.mode === 'full' && args.only.length > 0 && needsFunding && !hasFundingSwap && ctx.before
      && Number(ctx.before.usdc) <= dustThreshold(ctx, 'usdc') && Number(ctx.before.aero) <= dustThreshold(ctx, 'aero')) {
      console.log('note: --only selected transaction steps but no tx.swap.* funding swap, and the wallet holds no USDC/AERO above dust; add `swap` to --only to fund first')
    }

    for (const step of allSteps) {
      if (!wanted(step)) continue
      if (ctx.aborted || ctx.interrupted) break
      const rec = newRecord(step.id, step.title, step.feature, step.kind)
      const missing = step.needs?.(ctx)
      if (missing) {
        finishStep(ctx, rec, 'skipped', missing)
        continue
      }
      if (ctx.upstreamFailed && (step.kind === 'tx' || step.kind === 'local')) {
        finishStep(ctx, rec, 'skipped', 'upstream failed')
        continue
      }
      // A pure infra flake (flaky, nothing broadcast) gets up to 3 attempts
      // with a 45 s cooldown; a step holding a hash or receipt touched the
      // chain, so it is final no matter the status.
      let status: StepStatus = 'skipped'
      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        rec.attempts = attempt
        if (attempt > 1) await sleep(RETRY_DELAY_MS)
        rec.stdout += `# attempt ${attempt}\n`
        try {
          status = await step.run(ctx, rec)
        } catch (cause) {
          const message = scrub(cause instanceof Error ? cause.message : String(cause))
          rec.stderr += `[verify] ${message}\n`
          status = FLAKY_PATTERN.test(message) ? 'flaky' : 'fail'
        }
        if (ctx.interrupted) {
          status = 'fail'
          rec.reason = 'interrupted'
        }
        const retryable = status === 'flaky' && rec.hashes.length === 0 && rec.receipts.length === 0 && !ctx.interrupted && !ctx.aborted
        if (!retryable) break
      }
      finishStep(ctx, rec, status)
      if (status === 'fail' && step.kind === 'tx') ctx.upstreamFailed = true
      if (ctx.aborted) break
    }

    // Copy every journal created or touched during the run into the evidence dir.
    if (existsSync(layout.executionsDir)) {
      for (const name of readdirSync(layout.executionsDir)) {
        if (!name.endsWith('.json')) continue
        const source = join(layout.executionsDir, name)
        const previous = ctx.journalSnapshot.get(name)
        if (previous === undefined || statSync(source).mtimeMs > previous) {
          copyFileSync(source, join(journalsDir, name))
        }
      }
    }

    const after = ctx.wallet ? await latestBalances(ctx).catch(() => null) : null
    const totalGas = ctx.steps.reduce((sum, step) => sum + step.receipts.reduce((inner, receipt) => inner + BigInt(receipt.gasUsed), 0n), 0n)
    const txCount = ctx.steps.reduce((sum, step) => sum + step.hashes.length, 0)
    const netEthDeltaWei = ctx.before && after
      ? (parseUnits(after.eth, 18) - parseUnits(ctx.before.eth, 18)).toString()
      : '0'
    const dust: string[] = []
    if (after) {
      if (Number(after.usdc) > dustThreshold(ctx, 'usdc')) dust.push(`usdc ${after.usdc}`)
      if (Number(after.aero) > dustThreshold(ctx, 'aero')) dust.push(`aero ${after.aero}`)
      if (Number(after.nvdac) > dustThreshold(ctx, 'nvdac')) dust.push(`nvdac ${after.nvdac}`)
    }

    const baseline = !args.noCompare && existsSync(layout.baselineFile)
      ? JSON.parse(readFileSync(layout.baselineFile, 'utf8')) as unknown
      : null
    const compare = baseline ? compareWithBaseline(ctx.steps, baseline) : null
    const regressions = (compare ?? []).filter((row) => row.verdict === 'REGRESSION')

    const summary = {
      runId: id,
      mode: args.mode,
      startedAt: ctx.steps[0]?.startedAt ?? new Date().toISOString(),
      finishedAt: new Date().toISOString(),
      gitRev: doctor?.git.rev ?? gitInfo(repoRoot()).rev,
      chain: CHAIN_ID,
      wallet: ctx.wallet,
      rpc: rpcKind(),
      budgetUsd: args.budgetUsd,
      prices: { ethUsd: ctx.ethUsd, aeroUsd: ctx.aeroUsd },
      steps: ctx.steps.map(stepSummary),
      balances: { before: ctx.before, after },
      totals: {
        txCount,
        gasUsedWei: totalGas.toString(),
        netEthDeltaWei,
        netEthDeltaUsd: ctx.ethUsd ? (Number(netEthDeltaWei) / 1e18 * ctx.ethUsd).toFixed(4) : null,
        dust,
        veNftCount: after?.veNftCount ?? null,
      },
      compare: compare === null ? null : { rows: compare, regressions: regressions.length },
    }
    writeFileSync(join(runDir, 'summary.json'), JSON.stringify(summary, null, 2))
    writeFileSync(join(runDir, 'report.md'), renderReport(ctx, summary, compare))

    if (ctx.aborted) return 3
    const failures = ctx.steps.filter((step) => step.status === 'fail').length
    const exitCode = regressions.length > 0 ? 2 : failures > 0 ? 1 : 0
    if (args.accept && exitCode === 0) {
      copyFileSync(join(runDir, 'summary.json'), layout.baselineFile)
      console.log(`Baseline updated: ${layout.baselineFile}`)
    }
    const tally = (status: StepStatus) => ctx.steps.filter((step) => step.status === status).length
    console.log(`\nRun ${id}: ${tally('ok')} ok, ${tally('fail')} failed, ${tally('skipped')} skipped, ${tally('flaky')} flaky, ${regressions.length} regressions`)
    console.log(`Evidence: ${runDir}`)
    return exitCode
  } finally {
    releaseLock()
  }
}

if (import.meta.main) {
  process.exit(await main())
}
