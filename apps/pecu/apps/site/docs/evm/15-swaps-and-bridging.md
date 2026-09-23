---
title: Swaps and bridging
description: Quote Socket V3 routes, store one route with exact approvals as a workflow, run it, and verify settlement on the destination chain.
group: CLI
---

## Endpoints

Socket commands call Socket's V3 swap API. Without configuration they use the public endpoint `https://public-backend.socket.tech`, which needs no key. With `SOCKET_API_KEY` set, they use `https://dedicated-backend.socket.tech` and send the key in the `x-api-key` header. `SOCKET_API_URL` overrides the endpoint, and `SOCKET_AFFILIATE` adds an `affiliate` header. Route availability and liquidity depend on Socket.

## Find chains and tokens

```sh
evm socket-chains
evm socket-tokens --input '{"chainId":8453,"query":"USDC"}'
```

`socket-tokens` searches by symbol or address and returns the matches on one chain. Native tokens use the address `0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee`.

## Get a quote

| Field | Meaning |
| --- | --- |
| `originChainId` | Source chain |
| `destinationChainId` | Destination chain. Same as the source for a swap. |
| `inputToken` | Token you send |
| `outputToken` | Token you receive |
| `inputAmount` | Amount in base units of `inputToken` |
| `userAddress` | Account that sends and signs |
| `receiverAddress` | Account that receives on the destination chain |
| `slippage` | Percent, from 0 to 5. The TUI defaults to `0.5`. |

```sh
evm socket-quote --input '{"originChainId":8453,"destinationChainId":42161,"inputToken":"0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913","outputToken":"0xaf88d065e77c8cC2239327C5EDb3A432268e5831","inputAmount":"10000000","userAddress":"0xYOUR_ADDRESS","receiverAddress":"0xYOUR_ADDRESS","slippage":0.5}'
```

This asks for routes that move 10 USDC from Base to USDC on Arbitrum. The result has the `request`, the `routes`, `fetchedAt` and the `endpoint` used. Each route has a `quoteId`, `expiresAt`, the output token with `amount` and `minAmountOut`, an optional `approval`, and `txData` with the transaction to send.

The toolkit checks that Socket echoed your chains, addresses, input token and amount, and fails with `InvalidState` if it did not. It drops expired routes and routes for the wrong chain or output token. With no route left, it fails with `ProviderUnavailable`. Quoting never signs.

## Prepare a bridge or swap

`bridge-prepare` takes the quote fields plus `key`, and optional `routeIndex` and `policy`. `swap` takes the same input and requires the origin and destination chains to match. Use `bridge-prepare` for cross-chain transfers. Both store the same kind of record, and both run with `bridge-run`.

```sh
evm bridge-prepare --input '{"originChainId":8453,"destinationChainId":42161,"inputToken":"0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913","outputToken":"0xaf88d065e77c8cC2239327C5EDb3A432268e5831","inputAmount":"10000000","userAddress":"0xYOUR_ADDRESS","receiverAddress":"0xYOUR_ADDRESS","slippage":0.5,"key":"bridge-usdc-001"}'
```

It fetches a fresh quote and takes the route at `routeIndex`, or the route tagged `SUGGESTED`, or the first route. Then it stores a workflow:

1. If Socket asks for an approval and your current allowance is too low, a step that resets a nonzero allowance to zero, then a step that approves exactly the route's amount with an allowance check.
2. A step that submits the route's calldata, with the route's expiry as its deadline.

It refuses a route that asks to approve a different token, more than your input amount, or a native token, and a native route whose value differs from your input amount. The result is `{ bridge, workflow }`. The same key with the same request returns the stored bridge. A different request, policy or `routeIndex` under the same key fails with `IdempotencyConflict`.

## Run it

```sh
evm bridge-run --input '{"id":"BRIDGE_ID"}' --approve 0xFINGERPRINT
```

`BRIDGE_ID` is `result.bridge.id`. The fingerprint to approve is the workflow's, at `result.workflow.workflow.fingerprint`. `bridge-run` runs the workflow steps in order, then returns the same result as `bridge-status`. Running it again with the same ID does not resend confirmed steps.

## Track settlement

```sh
evm bridge-status --input '{"id":"BRIDGE_ID"}'
evm bridge-wait --input '{"id":"BRIDGE_ID"}'
```

`bridge-status` reconciles the source workflow, then asks Socket about the stored `quoteId` and source transaction hash. It checks that Socket's answer names the same quote, chains, sender and receiver. The result has `bridge`, `source`, `destination` and `settlement`.

Socket reports `PENDING`, `IN_PROGRESS`, `COMPLETED`, `FAILED`, `EXPIRED` or `REFUNDED`. `settlement.verified` is `true` only when all of these hold:

- Socket reports `COMPLETED` and every source step is confirmed.
- Socket gives a destination transaction hash.
- The destination receipt succeeded and its block is canonical.
- For an ERC-20 output, the receipt's `Transfer` logs from the output token to the receiver add up to at least the route's `minAmountOut`.

For a native output, only a direct transaction value to the receiver counts. Native transfers made inside a contract need a trace, so they stay unverified. If the destination RPC is unavailable, settlement stays unverified with a reason. Source inclusion alone never proves settlement.

`bridge-wait` polls `bridge-status` every five seconds, up to 60 passes, until Socket reports `COMPLETED`, `FAILED`, `EXPIRED` or `REFUNDED`. An unfinished bridge stays recoverable under its ID.

## Retry rules

- Steps run in sequence and are not atomic. The approval can be included and the route can still fail.
- If the route expires after the approval, the route step fails with `PlanExpired`. Prepare a fresh quote under a new key and review it. Keep the old bridge ID so you can reconcile it.
- After a timeout, run `bridge-status` on the old bridge ID before you do anything else. Never retry a timed-out bridge under a new key without checking it.
- Approvals are exact. A new route reads your current allowance again and adds approval steps only when it is too low.

> [!NOTE]
> The route calldata comes from Socket. The toolkit checks the chain, sender, receiver, tokens, amounts and approval, but it cannot inspect what the route contract does internally.
