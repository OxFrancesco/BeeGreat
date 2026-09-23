---
title: Chains
description: Supported chain IDs and default RPCs, the chain client classes, getChain, Superswap between OP Mainnet, Lisk and Unichain, and local Supersim clients.
group: SDK
---

## Supported chains

| Chain ID | `chainName` | Class | Default RPC | veNFTs |
| --- | --- | --- | --- | --- |
| 8453 | Base | `BaseChain` | `https://base-mainnet.g.alchemy.com/public` | Yes |
| 10 | OP | `OPChain` | `https://optimism-mainnet.wallet.coinbase.com` | Yes |
| 130 | Uni | `UniChain` | `https://unichain-rpc.publicnode.com` | No |
| 252 | Fraxtal | `FraxtalChain` | `https://fraxtal-rpc.publicnode.com` | No |
| 1135 | Lisk | `LiskChain` | `https://lisk.drpc.org` | No |
| 1868 | Soneium | `SoneiumChain` | `https://soneium-rpc.publicnode.com` | No |
| 5330 | Superseed | `SuperseedChain` | `https://superseed.drpc.org` | No |
| 34443 | Mode | `ModeChain` | `https://mode.drpc.org` | No |
| 42220 | Celo | `CeloChain` | `https://celo-rpc.publicnode.com` | No |
| 57073 | Ink | `InkChain` | `https://ink.drpc.org` | No |

Base runs Aerodrome. The other chains run Velodrome. Base and OP Mainnet are the governance deployments with veNFTs. The rest are leaf deployments that still have gauges and pool incentives.

The default RPCs are public endpoints and rate-limit large reads such as `getPools()` and quotes. Set `SUGAR_RPC_URI_<chainId>` or pass `rpcUrl` for anything beyond occasional reads. See [Configuration](/docs/aero/sdk-configuration).

`SUPPORTED_CHAIN_IDS` lists the IDs, `isSupportedChainId(id)` checks one, and `getChainSettings(chainId, { env, overrides })` returns the resolved settings without creating a client.

## Chain classes

Each class is a `SugarClient` with the chain ID filled in. It takes the same options, minus the chain ID, and exposes common tokens as fields that need no RPC read.

```ts
import { BaseChain, parseTokenUnits } from '@beegreat/sugar'

const base = new BaseChain({ account: '0xYOUR_ADDRESS' })
const plan = await base.swap(base.eth, base.usdc, parseTokenUnits(base.eth, '0.001'))
```

| Class | Token fields |
| --- | --- |
| `BaseChain` | `usdc`, `aero`, `eth` |
| `OPChain` | `usdc`, `velo`, `eth`, `oUsdt` |
| `UniChain` | `eth`, `oUsdt`, `usdc` |
| `LiskChain` | `oUsdt`, `lsk`, `eth`, `usdt` |
| `ModeChain` | `eth`, `oUsdt`, `usdc` |
| `FraxtalChain` | `frax`, `oUsdt`, `frxUsd` |
| `InkChain` | `eth`, `oUsdt`, `usdc` |
| `SoneiumChain` | `eth`, `oUsdt`, `usdc` |
| `SuperseedChain` | `eth`, `oUsdt`, `usdc` |
| `CeloChain` | `celo`, `oUsdt`, `usdt`, `weth` |

The fields exist on the class, such as `BaseChain.usdc`, and on instances. `BaseChain.tokens` holds all of them. The same tokens are in `KNOWN_TOKENS[chainId]` and `getKnownTokens(chainId)`.

Names with an `Async` prefix, such as `AsyncBaseChain` and `getAsyncChain`, are aliases kept for parity with the Python SDK. They are the same classes and functions.

## Pick a client by chain

```ts
import { getChain, getChainFromToken, LiskChain } from '@beegreat/sugar'

const op = getChain(10)
const lisk = getChainFromToken(LiskChain.usdt)
```

`getChain(chainId, options?)` returns the matching class instance and throws `Unsupported chain ID` for anything else. `getChainFromToken(token, options?)` picks the client for `token.chainId`.

## Superswap

`Superswap` builds cross-chain swaps between OP Mainnet (10), Lisk (1135) and Unichain (130). Any other chain throws `Superswap only supports OP, Lisk, Uni`. `SUPERSWAP_SUPPORTED_CHAINS` holds the three chain names.

A Superswap has up to three legs.

1. On the origin chain, swap the input into the bridge token, oUSDT, unless the input already is oUSDT.
2. Bridge oUSDT to the destination chain with Hyperlane.
3. On the destination chain, swap oUSDT into the output token through your interchain account (ICA). This leg needs a relay step.

When both tokens are oUSDT, the quote is a plain bridge with `isBridge` set to `true`.

```ts
import { LiskChain, Superswap, UniChain, parseTokenUnits } from '@beegreat/sugar'

const superswap = new Superswap({ account: '0xYOUR_ADDRESS' })

const quote = await superswap.getQuote(
  LiskChain.eth,
  UniChain.usdc,
  parseTokenUnits(LiskChain.eth, '0.01'),
)
if (!quote) throw new Error('no route')

const result = await superswap.swapFromQuote(quote, 0.01)
```

`getQuote` needs `account` whenever the output is not oUSDT, because it reads the balance of your interchain account on the destination chain.

`result.transactions` runs on the origin chain, Lisk here. It holds an approval of the input token to the origin swapper when the allowance is below the amount, then one `execute` call. For a native input the approval is for the wrapped token. The `execute` call's `value` covers the bridge fee and the cross-chain message fee, plus the input amount when the input is the native token.

After the `execute` transaction is mined, relay the destination calls when `result.swapData` is present. `txHash` is the hash of that transaction.

```ts
if (result.swapData) {
  await superswap.relay(result, txHash)
}
```

| Member | Use |
| --- | --- |
| `getQuote(from, to, amount)` | Returns a `SuperswapQuote` with `amountOut`, `bridgedAmount` and the origin and destination quotes, or `undefined` |
| `swapFromQuote(quote, slippage?, salt?)` | Builds a `SuperswapResult`. Slippage defaults to the origin chain's `swapSlippage` |
| `swap(from, to, amount, slippage?)` | Quotes and builds in one call |
| `result.relayArgs(txHash)` | The relay payload. Throws when the swap needs no relay |
| `relay(result, txHash)` | Sends `relayArgs(txHash)` through the relayer |
| `getDomain(chainId)` | The chain's Hyperlane domain |

`new Superswap(options)` takes the client options, which apply to the clients for every chain involved, plus `relayer` and `clientFactory`. `account` is used on the origin chain only.

The default relayer, `HttpSuperswapRelayer`, posts the calls, salt, transaction hash, origin domain and relayer addresses to Hyperlane's offchain lookup service at `HYPERLANE_RELAY_URL`. To use a different service, pass any object with a `shareCalls(args)` method as `relayer`. `MockSuperswapRelayer` counts calls and is meant for tests.

> [!WARNING]
> When a relay is needed, the bridge sends oUSDT to your interchain account on the destination chain, and it stays there until the relayed calls run. If you never relay, or the relay fails, the funds wait in that account. If the destination swap reverts, the relayed calls send the oUSDT to your address instead of the output token.

## Supersim

The upstream Sugar SDK has no public testnet deployment. Its supported test environment is Supersim, which runs local forks of OP Stack chains. Aero ships clients for the Lisk and Unichain forks.

| Chain | Class | RPC |
| --- | --- | --- |
| Lisk, 1135 | `LiskChainSimnet` | `http://127.0.0.1:4445` |
| Unichain, 130 | `UniChainSimnet` | `http://127.0.0.1:4446` |

```ts
import { getSimnetChain, requireSupersim } from '@beegreat/sugar'

await requireSupersim('http://127.0.0.1:4445')
const lisk = getSimnetChain(1135, { account: '0xYOUR_ADDRESS' })
```

`getSimnetChain(chainId, options?)` returns the simnet class and throws `Unsupported simnet chain ID` for other IDs. Simnet clients set `requestConcurrency` to 1 and `isSimnet` to `true`, and a `rpcUrl` option still wins over the local default. `getSimnetSettings(chainId)` returns the settings alone.

`requireSupersim(rpcUrl)` throws when the node does not answer `eth_chainId` within 2 seconds. Called without an argument it checks `http://127.0.0.1:4444`.

In a clone, `bun run test:headless` runs a pool read, a quote and an unsigned swap build through the headless CLI against Lisk and never broadcasts. Point it at a fork with `SUGAR_HEADLESS_RPC_URL`, and change the chain, tokens, amount or wallet with `SUGAR_HEADLESS_CHAIN_ID`, `SUGAR_HEADLESS_FROM_TOKEN`, `SUGAR_HEADLESS_TO_TOKEN`, `SUGAR_HEADLESS_AMOUNT` and `SUGAR_HEADLESS_WALLET`.
