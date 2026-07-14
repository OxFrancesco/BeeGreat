# `@beegreat/sugar`

Native TypeScript port of Velodrome/Aerodrome's Sugar SDK. It uses Viem for
RPC reads and ABI encoding and never signs or broadcasts transactions.

## Client API

```ts
import { SugarClient, parseTokenUnits } from '@beegreat/sugar'

const sugar = new SugarClient(8453, {
  account: '0xYourPublicWalletAddress',
})

const eth = await sugar.getToken('ETH')
const usdc = await sugar.getToken('USDC')
if (!eth || !usdc) throw new Error('token unavailable')

const quote = await sugar.getQuote(eth, usdc, parseTokenUnits(eth, '0.01'))
const unsignedTransactions = quote
  ? await sugar.swapFromQuote(quote)
  : []
```

`SugarClient` ports the Python chain surface:

- token, balance, pool, oracle-price, epoch, and position reads;
- mixed V2/V3 path discovery, quotes, and swaps;
- pool specs and basic/concentrated deposit quotes;
- deposit, withdrawal, stake, unstake, fee, and emission builders;
- bridge fees, ICA reads, bridge transaction builders, and allowances.

Every transaction result is `{ from, to, data, value }`. `value` and other
on-chain integers are `bigint` in the SDK and decimal strings after JSON
serialization.

## CLI-compatible action seam

The Web3 power-up uses the same twelve action names as the former Python CLI:

```ts
import { executeSugarActionJson } from '@beegreat/sugar'

const output = await executeSugarActionJson('pools', {
  chain: 8453,
  pool_type: 'cl',
  limit: 10,
})
```

Supported actions are `deposit`, `positions`, `pools`, `epochs_latest`,
`epochs`, `withdraw`, `stake`, `unstake`, `claim_emissions`, `claim_fees`,
`quote`, and `swap`.

The same actions are available from the Bun CLI:

```sh
bun run --cwd packages/sugar cli -- pools --chain=1135 --limit=1
bun run --cwd packages/sugar cli -- quote --chain=1135 \
  --from-token=ETH --to-token=USDT --amount=0.001 --use-decimals
```

The `sugar-ts` package bin exposes that entrypoint to workspace consumers.
Like the SDK, it only returns JSON reads and unsigned transactions.

## Chain clients

`OPChain`, `BaseChain`, `LiskChain`, `UniChain`, `ModeChain`, `FraxtalChain`,
`InkChain`, `SoneiumChain`, `SuperseedChain`, and `CeloChain` mirror the
Python chain-specific classes. `getChain`, token-based factories, async-name
aliases, and Lisk/Uni Supersim clients are exported as well.

## Superswap

`Superswap` ports the OP/Lisk/Uni cross-chain quote and unsigned transaction
flow. If a destination ICA relay is required, the returned result includes
`swapData`; pass the commitment transaction hash to `result.relayArgs(...)`
and then to a `SuperswapRelayer`.

## Configuration

The defaults and environment names match the Python SDK. Per-chain overrides
use names such as `SUGAR_RPC_URI_8453`, `SUGAR_SWAP_SLIPPAGE_8453`, and
`SUGAR_CONNECTOR_TOKENS_ADDRS_8453`; un-suffixed global values are also
accepted. Constructor options take precedence over environment values.

Supported chain IDs: 10, 130, 252, 1135, 1868, 5330, 8453, 34443, 42220,
and 57073. Local Supersim settings are available for Uni (130, port 4446) and
Lisk (1135, port 4445).

### RPC resilience

Sugar keeps its public interface Promise-based while using Effect internally
for RPC deadlines, retry classification, and bounded read concurrency. The
SDK-owned HTTP transport disables Viem retries so one policy owns all attempts.
By default, idempotent reads receive up to three retries with 150ms exponential
backoff inside a 120-second total deadline. Numeric and HTTP-date `Retry-After`
headers are honored without extending that deadline. Multi-stage reads share one
budget across pagination count/pages and quote multicall/fallback work; exhausted
rate limits and transport failures are not amplified through the quote fallback.

Callers can tune this with plain TypeScript options (no Effect types cross the
SDK interface):

```ts
const sugar = new SugarClient(8453, {
  rpcPolicy: {
    maxRetries: 2,
    baseDelayMs: 250,
    deadlineMs: 60_000,
  },
})
```

Expected RPC failures reject with `SugarRpcError`, whose `code` is one of
`RPC_TIMEOUT`, `RPC_RATE_LIMITED`, `RPC_UNAVAILABLE`, or `RPC_READ_FAILED`.
The original Viem error remains available as `cause`.

When injecting a custom `transport` or `publicClient`, configure its own retry
count to zero if Sugar should remain the sole retry owner. Effect can interrupt
its wait and sibling retry fibers at the deadline, but the underlying transport
may continue until its own timeout. An injected client is responsible for
physically aborting its network request when it supports cancellation.

## Headless verification

```sh
bun run --cwd packages/sugar test:headless
```

This runs the TypeScript CLI end to end against Lisk by default: a pool read,
an ETH-to-USDT quote, and unsigned swap construction. It never broadcasts.
Override `SUGAR_HEADLESS_CHAIN_ID`, `SUGAR_HEADLESS_RPC_URL`, token names,
amount, or public wallet address as needed. The upstream SDK does not ship a
public testnet deployment; its supported test environment is local Supersim,
so point `SUGAR_HEADLESS_RPC_URL` at the appropriate fork when it is running.
