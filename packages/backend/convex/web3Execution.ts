export type Web3Transaction = {
  to: string
  data: string
  value: string
}

export type SugarTransactionStep = {
  role: 'approval' | 'action'
  transaction: Web3Transaction
}

export type SugarBounds = {
  minimumOutput?: string
  maximumDeposit0?: string
  maximumDeposit1?: string
  minimumWithdrawal0?: string
  minimumWithdrawal1?: string
  veNftAmount?: string
  veNftLockDurationSeconds?: number
}

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined
}

function integerString(value: unknown): string | undefined {
  return typeof value === 'string' && /^\d+$/.test(value) ? value : undefined
}

function transaction(value: unknown): Web3Transaction | undefined {
  const item = record(value)
  if (
    !item ||
    typeof item.to !== 'string' ||
    typeof item.data !== 'string' ||
    typeof item.value !== 'string' ||
    !/^\d+$/.test(item.value)
  ) {
    return undefined
  }
  return { to: item.to, data: item.data, value: item.value }
}

export function sugarTransactionSteps(plan: unknown): SugarTransactionStep[] {
  const steps = record(plan)?.transaction_steps
  if (!Array.isArray(steps) || steps.length === 0) {
    throw new Error('Sugar plan is missing explicit transaction_steps metadata.')
  }
  const parsed = steps.map((value) => {
    const item = record(value)
    const role = item?.role
    const parsedTransaction = transaction(item?.transaction)
    if (
      (role !== 'approval' && role !== 'action') ||
      !parsedTransaction
    ) {
      throw new Error('Sugar returned an invalid transaction_steps entry.')
    }
    const parsedRole: 'approval' | 'action' = role
    return { role: parsedRole, transaction: parsedTransaction }
  })
  if (
    parsed.filter(({ role }) => role === 'action').length !== 1 ||
    parsed.at(-1)?.role !== 'action'
  ) {
    throw new Error('Sugar plans must contain exactly one final action step.')
  }
  return parsed
}

export function captureSugarBounds(plan: unknown): SugarBounds {
  const item = record(plan) ?? {}
  const quote = record(item.quote)
  const deposit = record(item.deposit)
  const withdrawal = record(item.withdrawal)
  const veNft = record(item.ve_nft)
  return {
    ...(integerString(quote?.min_amount_out)
      ? { minimumOutput: String(quote?.min_amount_out) }
      : {}),
    ...(integerString(deposit?.amount0)
      ? { maximumDeposit0: String(deposit?.amount0) }
      : {}),
    ...(integerString(deposit?.amount1)
      ? { maximumDeposit1: String(deposit?.amount1) }
      : {}),
    ...(integerString(withdrawal?.amount0)
      ? { minimumWithdrawal0: String(withdrawal?.amount0) }
      : {}),
    ...(integerString(withdrawal?.amount1)
      ? { minimumWithdrawal1: String(withdrawal?.amount1) }
      : {}),
    ...(integerString(veNft?.amount)
      ? { veNftAmount: String(veNft?.amount) }
      : {}),
    ...(typeof veNft?.lock_duration_seconds === 'number'
      ? { veNftLockDurationSeconds: veNft.lock_duration_seconds }
      : {}),
  }
}

function compareBound(
  actual: unknown,
  expected: string | undefined,
  direction: 'maximum' | 'minimum',
  message: string,
) {
  if (expected === undefined) return
  const parsed = integerString(actual)
  if (!parsed) throw new Error('The refreshed Sugar plan omitted a confirmed bound.')
  const violates = direction === 'minimum'
    ? BigInt(parsed) < BigInt(expected)
    : BigInt(parsed) > BigInt(expected)
  if (violates) throw new Error(message)
}

export function assertSugarBounds(plan: unknown, bounds: SugarBounds): void {
  const item = record(plan) ?? {}
  const quote = record(item.quote)
  const deposit = record(item.deposit)
  const withdrawal = record(item.withdrawal)
  const veNft = record(item.ve_nft)
  compareBound(
    quote?.min_amount_out,
    bounds.minimumOutput,
    'minimum',
    'The refreshed swap guarantees less than the amount you confirmed. Ask Bee to prepare it again.',
  )
  compareBound(
    deposit?.amount0,
    bounds.maximumDeposit0,
    'maximum',
    'The refreshed deposit requires more token0 than you confirmed. Ask Bee to prepare it again.',
  )
  compareBound(
    deposit?.amount1,
    bounds.maximumDeposit1,
    'maximum',
    'The refreshed deposit requires more token1 than you confirmed. Ask Bee to prepare it again.',
  )
  compareBound(
    withdrawal?.amount0,
    bounds.minimumWithdrawal0,
    'minimum',
    'The refreshed withdrawal returns less token0 than you confirmed. Ask Bee to prepare it again.',
  )
  compareBound(
    withdrawal?.amount1,
    bounds.minimumWithdrawal1,
    'minimum',
    'The refreshed withdrawal returns less token1 than you confirmed. Ask Bee to prepare it again.',
  )
  if (
    bounds.veNftAmount !== undefined &&
    integerString(veNft?.amount) !== bounds.veNftAmount
  ) {
    throw new Error('The refreshed veNFT amount differs from what you confirmed.')
  }
  if (
    bounds.veNftLockDurationSeconds !== undefined &&
    veNft?.lock_duration_seconds !== bounds.veNftLockDurationSeconds
  ) {
    throw new Error('The refreshed veNFT duration differs from what you confirmed.')
  }
}

export async function executeFreshSugarPlan({
  buildPlan,
  bounds = {},
  executeStep,
  maxBuilds = 8,
}: {
  buildPlan: () => Promise<unknown>
  bounds?: SugarBounds
  executeStep: (step: SugarTransactionStep) => Promise<unknown>
  maxBuilds?: number
}): Promise<void> {
  for (let build = 0; build < maxBuilds; build += 1) {
    const plan = await buildPlan()
    assertSugarBounds(plan, bounds)
    const steps = sugarTransactionSteps(plan)
    const prerequisite = steps.find(({ role }) => role === 'approval')
    if (prerequisite) {
      await executeStep(prerequisite)
      continue
    }
    await executeStep(steps[0])
    return
  }
  throw new Error('Sugar still requires prerequisites after repeated fresh plans.')
}

/**
 * Rebuild and validate a semantic intent immediately before submitting it as
 * one smart-account transaction. Approval calls are deliberately part of the
 * same batch as the final action so a failed action cannot leave allowances
 * behind and a retry cannot race an independently confirmed prerequisite.
 */
export async function executeSmartWalletIntent<T>({
  buildPlan,
  bounds = {},
  executeBatch,
  maxCalls = 8,
}: {
  buildPlan: () => Promise<unknown>
  bounds?: SugarBounds
  executeBatch: (steps: SugarTransactionStep[]) => Promise<T>
  maxCalls?: number
}): Promise<T> {
  const plan = await buildPlan()
  assertSugarBounds(plan, bounds)
  const steps = sugarTransactionSteps(plan)
  if (steps.length > maxCalls) {
    throw new Error(`Sugar plan exceeds the ${maxCalls}-call smart-wallet limit.`)
  }
  if (
    steps
      .slice(0, -1)
      .some(({ role, transaction }) => role !== 'approval' || transaction.value !== '0')
  ) {
    throw new Error('Sugar smart-wallet prerequisites must be zero-value approvals.')
  }
  return executeBatch(steps)
}

export class CrossmintTransactionPendingError extends Error {
  override readonly name = 'CrossmintTransactionPendingError'

  constructor(readonly transactionId: string) {
    super(`Crossmint transaction ${transactionId} is still pending.`)
  }
}

export type CrossmintTransactionResult = {
  hash: string
  explorerLink: string
  transactionId: string
}

type CrossmintWalletLike = {
  sendTransaction(input: {
    to: string
    data: `0x${string}`
    value: bigint
    options: { prepareOnly: true }
  }): Promise<{ transactionId: string }>
  approve(input: { transactionId: string }): Promise<CrossmintTransactionResult>
  transaction(transactionId: string): Promise<{
    id: string
    status: string
    onChain?: { txId?: string; txHash?: string; explorerLink?: string }
  }>
}

type CrossmintBatchWalletLike = Pick<CrossmintWalletLike, 'approve' | 'transaction'> & {
  address: string
  chain: string
  signer?: { locator(): string }
  apiClient: {
    createTransaction(
      walletLocator: string,
      input: {
        params: {
          signer: string
          chain: string
          calls: Array<{ to: string; value: string; data: `0x${string}` }>
        }
      },
    ): Promise<{ id: string } | { error: unknown }>
  }
}

function settledCrossmintResult(
  response: Awaited<ReturnType<CrossmintWalletLike['transaction']>>,
): CrossmintTransactionResult | undefined {
  if (response.status !== 'success') return undefined
  const hash = response.onChain?.txId ?? response.onChain?.txHash
  if (!hash) throw new Error('Crossmint succeeded without an on-chain hash.')
  return {
    hash,
    explorerLink: response.onChain?.explorerLink ?? '',
    transactionId: response.id,
  }
}

export async function prepareAndApproveCrossmintStep({
  wallet,
  step,
  onPrepared,
}: {
  wallet: CrossmintWalletLike
  step: SugarTransactionStep
  onPrepared: (transactionId: string) => Promise<void>
}): Promise<CrossmintTransactionResult> {
  const prepared = await wallet.sendTransaction({
    to: step.transaction.to,
    data: step.transaction.data as `0x${string}`,
    value: BigInt(step.transaction.value),
    options: { prepareOnly: true },
  })
  await onPrepared(prepared.transactionId)
  try {
    return await wallet.approve({ transactionId: prepared.transactionId })
  } catch (approvalError) {
    const response = await wallet.transaction(prepared.transactionId)
    const settled = settledCrossmintResult(response)
    if (settled) return settled
    if (response.status === 'pending' || response.status === 'awaiting-approval') {
      throw new CrossmintTransactionPendingError(prepared.transactionId)
    }
    throw approvalError
  }
}

export async function prepareAndApproveCrossmintBatch({
  wallet,
  steps,
  onPrepared,
}: {
  wallet: CrossmintBatchWalletLike
  steps: SugarTransactionStep[]
  onPrepared: (transactionId: string) => Promise<void>
}): Promise<CrossmintTransactionResult> {
  if (steps.length === 0) {
    throw new Error('Cannot prepare an empty Crossmint transaction batch.')
  }
  const signer = wallet.signer
  if (!signer) {
    throw new Error('Crossmint wallet has no active signer.')
  }
  const prepared = await wallet.apiClient.createTransaction(wallet.address, {
    params: {
      signer: signer.locator(),
      chain: wallet.chain,
      calls: steps.map(({ transaction }) => ({
        to: transaction.to,
        value: transaction.value,
        data: transaction.data as `0x${string}`,
      })),
    },
  })
  if ('error' in prepared) {
    throw new Error('Crossmint rejected the smart-wallet transaction batch.')
  }
  await onPrepared(prepared.id)
  try {
    return await wallet.approve({ transactionId: prepared.id })
  } catch (approvalError) {
    const response = await wallet.transaction(prepared.id)
    const settled = settledCrossmintResult(response)
    if (settled) return settled
    if (response.status === 'pending' || response.status === 'awaiting-approval') {
      throw new CrossmintTransactionPendingError(prepared.id)
    }
    throw approvalError
  }
}

export function reconcileCrossmintTransaction(response: Awaited<ReturnType<CrossmintWalletLike['transaction']>>) {
  const settled = settledCrossmintResult(response)
  if (settled) return { status: 'success' as const, result: settled }
  if (response.status === 'failed') return { status: 'failed' as const }
  return { status: 'pending' as const }
}
