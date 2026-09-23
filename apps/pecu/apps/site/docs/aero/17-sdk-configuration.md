---
title: Configuration
description: Environment variables and their precedence, the RPC retry policy, SugarRpcError codes, the failover transport and the shared caches.
group: SDK
---

## Precedence

For each setting, the client uses the first value it finds.

1. The constructor, meaning the `rpcUrl` option or a field in `settings`.
2. `SUGAR_<NAME>_<chainId>`, such as `SUGAR_RPC_URI_8453`.
3. `SUGAR_<NAME>` without a chain suffix, which applies to every chain.
4. The built-in default.

Variables are read from `process.env` when the client is created, or from the `env` option when you pass one. A `transport` or `publicClient` option replaces the RPC URL for requests.

```sh
export SUGAR_RPC_URI_8453="https://YOUR_BASE_RPC"
export SUGAR_SWAP_SLIPPAGE=0.005
```

## Environment variables

Every variable below also works with a chain suffix, such as `SUGAR_SWAP_SLIPPAGE_8453`.

| Variable | Setting | Default |
| --- | --- | --- |
| `SUGAR_RPC_URI` | `rpcUrl` | A public endpoint per chain, listed in [Chains](/docs/aero/sdk-chains) |
| `SUGAR_SWAP_SLIPPAGE` | `swapSlippage` | `0.01` |
| `SUGAR_CONNECTOR_TOKENS_ADDRS` | `connectorTokenAddresses` | A vetted list per chain |
| `SUGAR_EXCLUDED_TOKENS_ADDRS` | `excludedTokenAddresses` | A list on Base and OP Mainnet, empty elsewhere |
| `SUGAR_THREADING_MAX_WORKERS` | `requestConcurrency` | `5` |
| `SUGAR_QUOTE_MAX_PATHS` | `quoteMaxPaths` | `3000` |
| `SUGAR_QUOTE_BATCH_SIZE` | `quoteBatchSize` | `64` |
| `SUGAR_PRICE_BATCH_SIZE` | `priceBatchSize` | `40` |
| `SUGAR_PRICE_THRESHOLD_FILTER` | `priceThresholdFilter` | `10` |
| `SUGAR_PRICING_CACHE_TIMEOUT_SECONDS` | `pricingCacheTimeoutSeconds` | `5` |
| `SUGAR_PAGINATION_LIMIT` | `paginationLimit` | `2000` |
| `SUGAR_POOL_PAGINATION_TARGET_CALLS` | `poolPaginationTargetCalls` | `90` |
| `SUGAR_POOL_PAGINATION_MIN_SIZE` | `poolPaginationMinSize` | `10` |
| `SUGAR_POOL_PAGINATION_MAX_SIZE` | `poolPaginationMaxSize` | `400` |
| `SUGAR_NATIVE_TOKEN_DECIMALS` | `nativeTokenDecimals` | `18` |

Token lists are comma-separated addresses, and a value replaces the default list rather than adding to it.

These names match the Python Sugar SDK. `chainName` and `nativeTokenSymbol` have no variable, but you can change them through `settings`.

### Contract addresses

Each contract address has a variable too, for forks and test deployments.

`SUGAR_SUGAR_CONTRACT_ADDR`, `SUGAR_SUGAR_REWARDS_CONTRACT_ADDR`, `SUGAR_VE_SUGAR_CONTRACT_ADDR`, `SUGAR_VOTER_CONTRACT_ADDR`, `SUGAR_ROUTER_CONTRACT_ADDR`, `SUGAR_QUOTER_CONTRACT_ADDR`, `SUGAR_SWAPPER_CONTRACT_ADDR`, `SUGAR_NFPM_CONTRACT_ADDR`, `SUGAR_SLIPSTREAM_CONTRACT_ADDR`, `SUGAR_SLIPSTREAM_FACTORY_ADDR`, `SUGAR_OLD_SLIPSTREAM_FACTORY_ADDR`, `SUGAR_PRICE_ORACLE_CONTRACT_ADDR`, `SUGAR_STABLE_TOKEN_ADDR`, `SUGAR_TOKEN_ADDR`, `SUGAR_WRAPPED_NATIVE_TOKEN_ADDR`, `SUGAR_BRIDGE_CONTRACT_ADDR`, `SUGAR_BRIDGE_TOKEN_ADDR`, `SUGAR_INTERCHAIN_ROUTER_CONTRACT_ADDR` and `SUGAR_MESSAGE_MODULE_CONTRACT_ADDR`.

`SUGAR_VE_SUGAR_CONTRACT_ADDR` and `SUGAR_TOKEN_ADDR` only take effect on Base and OP Mainnet, the chains that have those contracts by default.

> [!WARNING]
> Address overrides decide where your approvals and tokens go. A wrong router, swapper or position manager address builds transactions that hand your tokens to that contract. Only set them for a local fork or a deployment you have verified.

### CLI and TUI variables

The `aero` CLI and TUI read more variables that the SDK ignores.

| Variables | Page |
| --- | --- |
| `SUGAR_WALLET_PASSPHRASE`, `SUGAR_WALLET_DIR`, `SUGAR_WALLET_NO_KEYCHAIN`, `WALLETCONNECT_PROJECT_ID` | [Wallets](/docs/aero/wallets) |
| `AERO_CACHE_DIR` | [TUI](/docs/aero/tui) |
| `AERO_INDEX_DIR` | [Stocks and indices](/docs/aero/stocks-and-indices) |
| `DUNE_API_KEY`, `SUGAR_DUNE_API_KEY` | [Analytics](/docs/aero/analytics) |
| `AERO_ALM_CONFIG` | [ALM](/docs/aero/alm) |

## RPC resilience

Every read goes through one retry policy. The public methods stay Promise-based and no Effect types cross the SDK interface.

| `rpcPolicy` field | Default | Meaning |
| --- | --- | --- |
| `maxRetries` | `3` | Retries after the first attempt, for transient failures only |
| `baseDelayMs` | `150` | First backoff delay. It doubles on each retry |
| `deadlineMs` | `120000` | Total time for one operation, including every retry |

`maxRetries` and `baseDelayMs` must be non-negative integers and `deadlineMs` a positive integer, or the constructor throws.

```ts
import { SugarClient } from '@beegreat/sugar'

const sugar = new SugarClient(8453, {
  rpcPolicy: { maxRetries: 2, baseDelayMs: 250, deadlineMs: 60_000 },
  onRpcEvent: (event) => console.log(event.operation, event.status, event.durationMs),
})
```

- HTTP 403, 408, 413, 429, 500, 502, 503 and 504, JSON-RPC codes -32005, -32603, -32002 and -1, timeouts and dropped connections count as transient and are retried.
- Contract reverts are never retried.
- A numeric or HTTP-date `Retry-After` header lengthens the next delay but never extends the deadline.
- Multi-step reads, such as paginated pool scans and batched quotes, share one deadline, so a rate limit is not multiplied through fallbacks.

The SDK's own HTTP transport turns Viem's retries off so the policy above is the only one, and times out each request after 30 seconds or the deadline, whichever is shorter. It sends no JSON-RPC batch requests, since some public endpoints reject them, and batches contract reads through Multicall3 instead.

### RPC events

`onRpcEvent` receives one event per read, batch, pagination run or transport attempt.

| Field | Meaning |
| --- | --- |
| `operation` | Stable name such as `positions` or `quoteExactInput.multicall` |
| `phase` | `read`, `batch`, `pagination` or `transport` |
| `status` | `success` or `error` |
| `attemptCount` | Attempts made |
| `durationMs`, `itemCount`, `pageCount` | Present when they apply |
| `failoverUsed` | On transport events, whether a backup endpoint answered |

Events never include wallet addresses, calldata, request parameters or URLs. An error thrown by your callback is ignored.

## Errors

Expected RPC failures reject with `SugarRpcError`.

| Field | Meaning |
| --- | --- |
| `code` | `RPC_TIMEOUT`, `RPC_RATE_LIMITED`, `RPC_UNAVAILABLE` or `RPC_READ_FAILED` |
| `operation` | The contract function or phase that failed |
| `retryable` | Whether the failure was classified as transient |
| `attempts` | Attempts made before giving up |
| `message` | A readable message, such as `RPC read tokens was rate limited` |
| `cause` | A redacted summary of the underlying error with `name`, `message`, and `status` or `code` when present |

| Code | When |
| --- | --- |
| `RPC_RATE_LIMITED` | HTTP 429 or JSON-RPC code -32005 |
| `RPC_TIMEOUT` | A request timed out, or the operation ran out of deadline |
| `RPC_UNAVAILABLE` | Any other transient HTTP, JSON-RPC or connection failure |
| `RPC_READ_FAILED` | A contract revert or any failure that is not transient |

`cause` is not the original Viem error. In its message, the part of a URL after `/v2/` or `/v3/`, where many providers put an API key, is replaced with `[REDACTED]`.

```ts
import { SugarRpcError } from '@beegreat/sugar'

try {
  await sugar.getPools()
} catch (error) {
  if (error instanceof SugarRpcError && error.code === 'RPC_RATE_LIMITED') {
    console.error('Rate limited. Set SUGAR_RPC_URI_8453 to a dedicated endpoint.')
  }
  throw error
}
```

Invalid input and failed preconditions, such as a missing `account`, a non-positive amount or an unsupported chain, throw a plain `Error`.

## Failover transport

```ts
import { SugarClient, createSugarFailoverTransport } from '@beegreat/sugar'

const transport = createSugarFailoverTransport(
  ['https://PRIMARY_RPC', 'https://BACKUP_RPC'],
  { timeoutMs: 15_000, minIntervalMs: 50 },
)
const sugar = new SugarClient(8453, { transport })
```

`createSugarFailoverTransport(rpcUrls, options?)` tries the endpoints in order and moves to the next one only on a transient failure. Reverts throw at once instead of being replayed on every endpoint. It throws when the list is empty.

| Option | Default | Meaning |
| --- | --- | --- |
| `timeoutMs` | `30000` | Timeout for each attempt on each endpoint |
| `minIntervalMs` | `0` | Minimum gap between request starts across all endpoints, for plans limited by compute units |
| `onRpcEvent` | none | Receives `transport` events with `failoverUsed` |

With more than one endpoint, a revert that mentions an insufficient allowance or balance, or a nonce that is too low, is treated as a lagging endpoint rather than a real revert, and the retry policy tries again.

## Custom transports and clients

When you pass your own `transport` or `publicClient`, set its retry count to 0 so the Sugar policy stays the only retry layer. At the deadline Sugar stops waiting, but your transport may keep the request open until its own timeout, so give it one. Add `viem` to your own dependencies before importing from it.

```ts
import { http } from 'viem'
import { SugarClient } from '@beegreat/sugar'

const sugar = new SugarClient(8453, {
  transport: http('https://YOUR_BASE_RPC', { retryCount: 0, timeout: 20_000 }),
})
```

## Shared caches

By default each client keeps its own caches. `createSugarCacheStore` shares the token catalog, pool lists and oracle rates between clients on the same chain, RPC URL and settings, so a new client does not rescan every pool.

```ts
import { SugarClient, createSugarCacheStore } from '@beegreat/sugar'

const cacheStore = createSugarCacheStore({ ttlMs: 60_000 })
const first = new SugarClient(8453, { cacheStore })
const second = new SugarClient(8453, { cacheStore })
```

`ttlMs` defaults to 120000. The store keeps up to 64 entries, and clients beyond that get caches of their own. `cacheStore.invalidate()` clears every entry. Quote amounts always come from live quoter calls.

## Pool locator store

Reading one pool by address, and reading positions by pool, needs the pool's offset in Sugar's pool list. Without a stored offset, a fresh process scans the whole list to find it. `poolLocatorStore` saves those offsets somewhere durable.

```ts
import { SugarClient, type SugarPoolLocatorKey } from '@beegreat/sugar'

const offsets = new Map<string, { offset: number }>()
const id = (key: SugarPoolLocatorKey) => `${key.chainId}:${key.sugarContractAddress}:${key.poolAddress}`

const sugar = new SugarClient(8453, {
  poolLocatorStore: {
    get: async (key) => offsets.get(id(key)),
    set: async (key, locator) => { offsets.set(id(key), locator) },
    delete: async (key) => { offsets.delete(id(key)) },
  },
})
```

Replace the `Map` with your database. Keys have `chainId`, `sugarContractAddress` and `poolAddress`, and values have `offset`.

A stored offset is never trusted as is. Each client checks it with one `all(1, offset)` read and deletes it when the pool there no longer matches, then falls back to a scan. Store errors are ignored, so the store can speed reads up but cannot make them fail.
