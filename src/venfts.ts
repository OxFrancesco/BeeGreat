import type { Address } from 'viem'
import { abis } from './abis'
import { addressKey, normalizeAddress, tokenContractAddress, tupleValues } from './helpers'
import type { SugarContext } from './internal/context'
import { veNftFromTuple, veNftRewardFromTuple } from './models'
import { approveAddressIfNeeded } from './transactions'
import {
  ADDRESS_ZERO,
  type LiquidityPool,
  type PoolRewardContracts,
  type Token,
  type UnsignedTransaction,
  type VeNft,
  type VeNftContracts,
  type VeNftReward,
  type VeNftVote,
} from './types'

export function supportsVeNfts(ctx: SugarContext): boolean {
  return ctx.settings.veSugarContractAddress !== undefined
}

export function requireVeSugar(ctx: SugarContext): Address {
  if (!ctx.settings.veSugarContractAddress) {
    throw new Error(`veNFTs are not supported on ${ctx.settings.chainName}`)
  }
  return ctx.settings.veSugarContractAddress
}

export function getVeNftContracts(ctx: SugarContext): Promise<VeNftContracts> {
  const veSugar = requireVeSugar(ctx)
  if (!ctx.veNftContractsCache) {
    const pending = Promise.all([
      ctx.read<Address>(veSugar, abis.veSugar, 'voter'),
      ctx.read<Address>(veSugar, abis.veSugar, 've'),
      ctx.read<Address>(veSugar, abis.veSugar, 'token'),
      ctx.read<Address>(veSugar, abis.veSugar, 'dist'),
    ]).then(([voter, votingEscrow, governanceToken, rewardsDistributor]) => ({
      veSugar,
      voter: normalizeAddress(voter),
      votingEscrow: normalizeAddress(votingEscrow),
      governanceToken: normalizeAddress(governanceToken),
      rewardsDistributor: normalizeAddress(rewardsDistributor),
    }))
    ctx.veNftContractsCache = pending
    void pending.catch(() => {
      if (ctx.veNftContractsCache === pending) ctx.veNftContractsCache = undefined
    })
  }
  return ctx.veNftContractsCache
}

export async function getVeNfts(ctx: SugarContext, owner?: Address): Promise<VeNft[]> {
  const veSugar = requireVeSugar(ctx)
  if (!owner) throw new Error('Owner address is required to list veNFTs')
  const [contracts, raw] = await Promise.all([
    ctx.client.getVeNftContracts(),
    ctx.read<unknown[]>(veSugar, abis.veSugar, 'byAccount', [normalizeAddress(owner)]),
  ])
  const states = await ctx.rpc.forEachRead(
    'escrowType',
    raw,
    (item, _index, signal) => ctx.readTask<number>(
      contracts.votingEscrow,
      abis.votingEscrow,
      'escrowType',
      [BigInt(String(tupleValues(item)[0]))],
    )(signal),
    ctx.settings.requestConcurrency,
  )
  return raw.map((item, index) => veNftFromTuple(item, states[index], ctx.settings))
}

export async function getVeNft(ctx: SugarContext, tokenId: bigint): Promise<VeNft | undefined> {
  assertVeNftId(tokenId)
  const veSugar = requireVeSugar(ctx)
  const [contracts, raw] = await Promise.all([
    ctx.client.getVeNftContracts(),
    ctx.read<unknown>(veSugar, abis.veSugar, 'byId', [tokenId]),
  ])
  const values = tupleValues(raw)
  if (BigInt(String(values[0])) === 0n || normalizeAddress(String(values[1])) === ADDRESS_ZERO) {
    return undefined
  }
  const state = await ctx.read<number>(
    contracts.votingEscrow,
    abis.votingEscrow,
    'escrowType',
    [tokenId],
  )
  return veNftFromTuple(raw, state, ctx.settings)
}

export async function getVeNftRewards(ctx: SugarContext, tokenId: bigint, pool?: Address): Promise<VeNftReward[]> {
  assertVeNftId(tokenId)
  requireVeSugar(ctx)
  const rewardsSugar = ctx.settings.sugarRewardsContractAddress
  if (pool) {
    const raw = await ctx.read<unknown[]>(
      rewardsSugar,
      abis.sugarRewards,
      'rewardsByAddress',
      [tokenId, normalizeAddress(pool)],
    )
    return raw.map(veNftRewardFromTuple)
  }
  const rawLimit = await ctx.read<bigint>(rewardsSugar, abis.sugarRewards, 'MAX_REWARDS')
  const limit = Number(rawLimit)
  if (!Number.isSafeInteger(limit) || limit <= 0) throw new Error('Invalid RewardsSugar page limit')
  const results: unknown[] = []
  for (let offset = 0; offset < 10_000; offset += limit) {
    const page = await ctx.read<unknown[]>(
      rewardsSugar,
      abis.sugarRewards,
      'rewards',
      [BigInt(limit), BigInt(offset), tokenId],
    )
    results.push(...page)
    if (page.length < limit) return results.map(veNftRewardFromTuple)
  }
  throw new Error('veNFT reward pagination exceeded 10,000 entries')
}

export async function createVeNft(ctx: SugarContext, amount: bigint, lockDurationSeconds: number): Promise<UnsignedTransaction[]> {
  if (amount <= 0n) throw new Error('veNFT amount must be positive')
  if (!Number.isSafeInteger(lockDurationSeconds) || lockDurationSeconds <= 0) {
    throw new Error('veNFT lock duration must be a positive integer number of seconds')
  }
  const contracts = await ctx.client.getVeNftContracts()
  const approval = await approveAddressIfNeeded(
    ctx,
    contracts.governanceToken,
    contracts.votingEscrow,
    amount,
  )
  const create = ctx.tx(
    contracts.votingEscrow,
    ctx.encode(abis.votingEscrow, 'createLock', [amount, BigInt(lockDurationSeconds)]),
  )
  return [approval, create].filter((transaction): transaction is UnsignedTransaction => transaction !== undefined)
}

export async function increaseVeNftAmount(ctx: SugarContext, tokenId: bigint, amount: bigint): Promise<UnsignedTransaction[]> {
  if (tokenId <= 0n) throw new Error('veNFT token id must be positive')
  if (amount <= 0n) throw new Error('veNFT amount must be positive')
  const contracts = await ctx.client.getVeNftContracts()
  const approval = await approveAddressIfNeeded(
    ctx,
    contracts.governanceToken,
    contracts.votingEscrow,
    amount,
  )
  const increase = ctx.tx(
    contracts.votingEscrow,
    ctx.encode(abis.votingEscrow, 'increaseAmount', [tokenId, amount]),
  )
  return [approval, increase].filter((transaction): transaction is UnsignedTransaction => transaction !== undefined)
}

function assertVeNftId(tokenId: bigint, label = 'veNFT token id'): void {
  if (tokenId <= 0n) throw new Error(`${label} must be positive`)
}

async function buildVeNftCall(ctx: SugarContext, functionName: string, args: readonly unknown[]): Promise<UnsignedTransaction[]> {
  const { votingEscrow } = await ctx.client.getVeNftContracts()
  return [ctx.tx(votingEscrow, ctx.encode(abis.votingEscrow, functionName, args))]
}

export async function extendVeNftLock(ctx: SugarContext, tokenId: bigint, lockDurationSeconds: number): Promise<UnsignedTransaction[]> {
  assertVeNftId(tokenId)
  if (!Number.isSafeInteger(lockDurationSeconds) || lockDurationSeconds <= 0) {
    throw new Error('veNFT lock duration must be a positive integer number of seconds')
  }
  return buildVeNftCall(ctx, 'increaseUnlockTime', [tokenId, BigInt(lockDurationSeconds)])
}

export async function withdrawVeNft(ctx: SugarContext, tokenId: bigint): Promise<UnsignedTransaction[]> {
  assertVeNftId(tokenId)
  return buildVeNftCall(ctx, 'withdraw', [tokenId])
}

export async function mergeVeNfts(ctx: SugarContext, fromTokenId: bigint, intoTokenId: bigint): Promise<UnsignedTransaction[]> {
  assertVeNftId(fromTokenId, 'source veNFT token id')
  assertVeNftId(intoTokenId, 'destination veNFT token id')
  if (fromTokenId === intoTokenId) throw new Error('source and destination veNFTs must differ')
  return buildVeNftCall(ctx, 'merge', [fromTokenId, intoTokenId])
}

export async function splitVeNft(ctx: SugarContext, tokenId: bigint, amount: bigint): Promise<UnsignedTransaction[]> {
  assertVeNftId(tokenId)
  if (amount <= 0n) throw new Error('veNFT split amount must be positive')
  return buildVeNftCall(ctx, 'split', [tokenId, amount])
}

export async function setVeNftPermanent(ctx: SugarContext, tokenId: bigint, permanent: boolean): Promise<UnsignedTransaction[]> {
  assertVeNftId(tokenId)
  return buildVeNftCall(ctx, permanent ? 'lockPermanent' : 'unlockPermanent', [tokenId])
}

export async function delegateVeNft(ctx: SugarContext, tokenId: bigint, delegateTokenId: bigint): Promise<UnsignedTransaction[]> {
  assertVeNftId(tokenId)
  if (delegateTokenId < 0n) throw new Error('delegate veNFT token id must not be negative')
  return buildVeNftCall(ctx, 'delegate', [tokenId, delegateTokenId])
}

async function buildVoterCall(ctx: SugarContext, functionName: string, args: readonly unknown[]): Promise<UnsignedTransaction[]> {
  const { voter } = await ctx.client.getVeNftContracts()
  return [ctx.tx(voter, ctx.encode(abis.voter, functionName, args))]
}

export async function voteVeNft(ctx: SugarContext, tokenId: bigint, votes: readonly VeNftVote[]): Promise<UnsignedTransaction[]> {
  assertVeNftId(tokenId)
  if (votes.length === 0) throw new Error('veNFT vote requires at least one pool vote')
  const pools = votes.map(({ pool }) => normalizeAddress(pool))
  if (new Set(pools.map(addressKey)).size !== pools.length) {
    throw new Error('veNFT vote pools must be unique')
  }
  if (votes.some(({ weight }) => weight <= 0n)) {
    throw new Error('veNFT vote weights must be positive')
  }
  return buildVoterCall(ctx, 'vote', [tokenId, pools, votes.map(({ weight }) => weight)])
}

export async function resetVeNftVotes(ctx: SugarContext, tokenId: bigint): Promise<UnsignedTransaction[]> {
  assertVeNftId(tokenId)
  return buildVoterCall(ctx, 'reset', [tokenId])
}

export async function pokeVeNftVotes(ctx: SugarContext, tokenId: bigint): Promise<UnsignedTransaction[]> {
  assertVeNftId(tokenId)
  return buildVoterCall(ctx, 'poke', [tokenId])
}

export async function depositVeNftIntoManaged(ctx: SugarContext, tokenId: bigint, managedTokenId: bigint): Promise<UnsignedTransaction[]> {
  assertVeNftId(tokenId)
  assertVeNftId(managedTokenId, 'managed veNFT token id')
  if (tokenId === managedTokenId) throw new Error('veNFT and managed veNFT token ids must differ')
  return buildVoterCall(ctx, 'depositManaged', [tokenId, managedTokenId])
}

export async function withdrawVeNftFromManaged(ctx: SugarContext, tokenId: bigint): Promise<UnsignedTransaction[]> {
  assertVeNftId(tokenId)
  return buildVoterCall(ctx, 'withdrawManaged', [tokenId])
}

export async function claimVeNftRewards(ctx: SugarContext, tokenId: bigint, pool?: Address): Promise<UnsignedTransaction[]> {
  assertVeNftId(tokenId)
  const rewards = (await ctx.client.getVeNftRewards(tokenId, pool)).filter(({ amount }) => amount > 0n)
  const group = (field: 'feeVotingReward' | 'incentiveVotingReward') => {
    const grouped = new Map<string, { contract: Address; tokens: Map<string, Address> }>()
    for (const reward of rewards) {
      const contract = reward[field]
      if (contract === ADDRESS_ZERO) continue
      const key = addressKey(contract)
      const entry = grouped.get(key) ?? { contract, tokens: new Map<string, Address>() }
      entry.tokens.set(addressKey(reward.token), reward.token)
      grouped.set(key, entry)
    }
    const entries = [...grouped.values()]
    return {
      contracts: entries.map((entry) => entry.contract),
      tokens: entries.map((entry) => [...entry.tokens.values()]),
    }
  }
  const incentives = group('incentiveVotingReward')
  const fees = group('feeVotingReward')
  const { voter } = await ctx.client.getVeNftContracts()
  const transactions: UnsignedTransaction[] = []
  if (incentives.contracts.length > 0) {
    transactions.push(ctx.tx(voter, ctx.encode(abis.voter, 'claimBribes', [
      incentives.contracts,
      incentives.tokens,
      tokenId,
    ])))
  }
  if (fees.contracts.length > 0) {
    transactions.push(ctx.tx(voter, ctx.encode(abis.voter, 'claimFees', [
      fees.contracts,
      fees.tokens,
      tokenId,
    ])))
  }
  return transactions
}

export async function getVeNftRebase(ctx: SugarContext, tokenId: bigint): Promise<bigint> {
  assertVeNftId(tokenId)
  const { rewardsDistributor } = await ctx.client.getVeNftContracts()
  return ctx.read<bigint>(rewardsDistributor, abis.rewardsDistributor, 'claimable', [tokenId])
}

export async function claimVeNftRebase(ctx: SugarContext, tokenId: bigint): Promise<UnsignedTransaction[]> {
  assertVeNftId(tokenId)
  const { rewardsDistributor } = await ctx.client.getVeNftContracts()
  return [ctx.tx(
    rewardsDistributor,
    ctx.encode(abis.rewardsDistributor, 'claim', [tokenId]),
  )]
}

export async function claimVeNftRebases(ctx: SugarContext, tokenIds: readonly bigint[]): Promise<UnsignedTransaction[]> {
  if (tokenIds.length === 0) throw new Error('veNFT rebase claim requires at least one token id')
  tokenIds.forEach((tokenId) => assertVeNftId(tokenId))
  if (new Set(tokenIds).size !== tokenIds.length) {
    throw new Error('veNFT rebase token ids must be unique')
  }
  const { rewardsDistributor } = await ctx.client.getVeNftContracts()
  return [ctx.tx(
    rewardsDistributor,
    ctx.encode(abis.rewardsDistributor, 'claimMany', [[...tokenIds]]),
  )]
}

export async function getPoolRewardContracts(ctx: SugarContext, pool: LiquidityPool): Promise<PoolRewardContracts> {
  if (pool.chainId !== ctx.settings.chainId) {
    throw new Error(`Pool chain ${pool.chainId} does not match client chain ${ctx.settings.chainId}`)
  }
  const gauge = normalizeAddress(pool.gauge)
  if (gauge === ADDRESS_ZERO) throw new Error(`pool ${pool.symbol} has no gauge`)
  const incentiveFunction = ctx.client.supportsVeNfts() ? 'gaugeToBribe' : 'gaugeToIncentive'
  const [feeVotingReward, incentiveVotingReward] = await Promise.all([
    ctx.read<Address>(ctx.settings.voterContractAddress, abis.voter, 'gaugeToFees', [gauge]),
    ctx.read<Address>(ctx.settings.voterContractAddress, abis.voter, incentiveFunction, [gauge]),
  ])
  return {
    gauge,
    feeVotingReward: normalizeAddress(feeVotingReward),
    incentiveVotingReward: normalizeAddress(incentiveVotingReward),
  }
}

export async function incentivizePool(
  ctx: SugarContext,
  pool: LiquidityPool,
  token: Token,
  amount: bigint,
): Promise<UnsignedTransaction[]> {
  if (token.chainId !== ctx.settings.chainId) {
    throw new Error(`Reward token chain ${token.chainId} does not match client chain ${ctx.settings.chainId}`)
  }
  if (amount <= 0n) throw new Error('Pool incentive amount must be positive')
  const { incentiveVotingReward } = await ctx.client.getPoolRewardContracts(pool)
  if (incentiveVotingReward === ADDRESS_ZERO) {
    throw new Error(`pool ${pool.symbol} has no incentive voting reward contract`)
  }
  const tokenAddress = tokenContractAddress(token)
  const approval = await approveAddressIfNeeded(ctx, tokenAddress, incentiveVotingReward, amount)
  const notify = ctx.tx(
    incentiveVotingReward,
    ctx.encode(abis.votingReward, 'notifyRewardAmount', [tokenAddress, amount]),
  )
  return [approval, notify].filter((transaction): transaction is UnsignedTransaction => transaction !== undefined)
}
