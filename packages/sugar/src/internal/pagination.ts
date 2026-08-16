import { abis } from '../abis'
import type { SugarContext } from './context'
import type { RpcDeadline, RpcReadTask } from './rpc-executor'

const MAX_PAGINATION_REQUESTS = 10_000

export function pageSize(ctx: SugarContext, poolCount: number): number {
  if (!Number.isSafeInteger(poolCount) || poolCount < 0) {
    throw new RangeError('Sugar pool count must be a safe non-negative integer')
  }
  const minimum = ctx.settings.poolPaginationMinSize
  const maximum = ctx.settings.poolPaginationMaxSize
  const targetCalls = ctx.settings.poolPaginationTargetCalls
  if (![minimum, maximum, targetCalls].every((value) => Number.isSafeInteger(value) && value > 0)) {
    throw new RangeError('Sugar pagination settings must be positive safe integers')
  }
  if (minimum > maximum) {
    throw new RangeError('Sugar pagination minimum cannot exceed maximum')
  }
  return Math.max(minimum, Math.min(Math.floor(poolCount / targetCalls), maximum))
}

export function getPoolPaginator(ctx: SugarContext, poolCount: number): Array<{ offset: number; limit: number }> {
  return [...poolPageRequests(ctx, poolCount)]
}

export function* poolPageRequests(
  ctx: SugarContext,
  poolCount: number,
  requestedLimit?: number,
): Generator<{ offset: number; limit: number }> {
  const defaultLimit = pageSize(ctx, poolCount)
  const limit = requestedLimit ?? defaultLimit
  if (
    !Number.isSafeInteger(limit)
    || limit <= 0
    || limit > ctx.settings.poolPaginationMaxSize
  ) {
    throw new RangeError(
      `Sugar pagination limit must be a positive safe integer no greater than ${ctx.settings.poolPaginationMaxSize}`,
    )
  }
  const pageCount = Math.ceil((poolCount + 10) / limit)
  if (!Number.isSafeInteger(pageCount) || pageCount > MAX_PAGINATION_REQUESTS) {
    throw new RangeError(`Sugar pagination allows at most ${MAX_PAGINATION_REQUESTS} requests`)
  }
  for (let page = 0; page < pageCount; page++) yield { offset: page * limit, limit }
}

export async function paginate<T>(
  ctx: SugarContext,
  operation: string,
  reader: (limit: number, offset: number) => RpcReadTask<T[]>,
  deadline = ctx.rpc.deadline(operation),
  pageLimit?: number,
): Promise<T[]> {
  const startedAt = Date.now()
  let pageCount = 0
  try {
    const count = await getPoolCountWithin(ctx, deadline)
    const requests = pageLimit === undefined
      ? getPoolPaginator(ctx, count)
      : [...poolPageRequests(ctx, count, pageLimit)]
    pageCount = requests.length
    const pages = await ctx.rpc.forEachRead(
      operation,
      requests,
      ({ limit, offset }, _index, signal) => reader(limit, offset)(signal),
      ctx.settings.requestConcurrency,
      deadline,
    )
    const results = pages.flat()
    ctx.emitRpcEvent({
      attemptCount: deadline.attempts,
      durationMs: Date.now() - startedAt,
      itemCount: results.length,
      operation,
      pageCount,
      phase: 'pagination',
      status: 'success',
    })
    return results
  } catch (error) {
    ctx.emitRpcEvent({
      attemptCount: deadline.attempts,
      durationMs: Date.now() - startedAt,
      itemCount: 0,
      operation,
      pageCount,
      phase: 'pagination',
      status: 'error',
    })
    throw error
  }
}

export function getPoolCountWithin(ctx: SugarContext, deadline: RpcDeadline): Promise<number> {
  if (!ctx.caches.poolCountCache) {
    const promise = ctx.read<bigint>(
      ctx.settings.sugarContractAddress,
      abis.sugar,
      'count',
      undefined,
      deadline,
    ).then((rawCount) => {
      const count = Number(rawCount)
      if (rawCount < 0n || !Number.isSafeInteger(count)) {
        throw new RangeError('Sugar pool count must be a safe non-negative integer')
      }
      return count
    })
    ctx.caches.poolCountCache = promise
    void promise.catch(() => {
      if (ctx.caches.poolCountCache === promise) ctx.caches.poolCountCache = undefined
    })
  }
  return ctx.caches.poolCountCache
}

export function getPoolCount(ctx: SugarContext): Promise<number> {
  return getPoolCountWithin(ctx, ctx.rpc.deadline('count'))
}
