---
title: Effect SDK
description: Run catalog commands from TypeScript through one Effect runtime, or compose the underlying services, workflows and schemas directly.
group: SDK
---

## Package

The SDK is the `@beegreat/evm` package in the [standalone repository](https://github.com/OxFrancesco/evmSDK). It is marked private and not published to npm, so use it from a checkout or as a workspace package. It runs on Bun and is written with Effect 4 (`effect` pinned to `4.0.0-rc.115`) and viem (`2.33.1`).

| Import path | Contents |
| --- | --- |
| `@beegreat/evm` | `dispatch`, `commands`, `discover`, `runtimeLayer`, the services, layers and functions listed below, and everything from `./safe` |
| `@beegreat/evm/model` | Shared schemas such as `Address`, `Hash`, `Hex`, `Uint`, `Id`, `ChainId`, `Plan`, `Operation`, `PrepareInput`, `CallInput`, `ExecuteInput` and `EvmError` |
| `@beegreat/evm/crossmint` | `crossmintAdapter`, `crossmintChains`, `SmartTransaction`, `CrossmintTransaction`, `normalizeCrossmintTransaction` and the `SmartWalletAdapter` type |
| `@beegreat/evm/safe` | Safe schemas and workflows for owners, proposals, batches, modules, budgets, roles, passkeys and sponsored execution |
| `@beegreat/evm/safe/passkey-browser` | `createSafePasskey` and `signSafeWithPasskey`, for browsers only |

## Run a command

`dispatch(name, input)` runs any catalog command with the same schema checks as the CLI. It returns an Effect that needs the services `runtimeLayer` provides.

```ts
import { ManagedRuntime } from 'effect'
import { dispatch, runtimeLayer } from '@beegreat/evm'

const runtime = ManagedRuntime.make(runtimeLayer({ database: './evm.sqlite' }))
try {
  const result = await runtime.runPromise(dispatch('balance', {
    chainId: 8453,
    address: '0x1111111111111111111111111111111111111111',
  }))
  console.log(result)
} finally {
  await runtime.dispose()
}
```

A failed command fails the Effect with an `EvmError` that has `code`, `message` and `retryable`. To handle it as a value, as the MCP server and TUI do, map the Effect with `Effect.match` before running it:

```ts
import { Effect, ManagedRuntime } from 'effect'
import { dispatch, runtimeLayer } from '@beegreat/evm'

const runtime = ManagedRuntime.make(runtimeLayer({ database: './evm.sqlite' }))
const outcome = await runtime.runPromise(dispatch('units', { amount: '2.5', decimals: 6 }).pipe(Effect.match({
  onSuccess: result => ({ ok: true, result }),
  onFailure: error => ({ ok: false, code: error.code, message: error.message }),
})))
await runtime.dispose()
```

## Runtime options

`runtimeLayer` takes a `RuntimeOptions` object. It does not read environment variables. Only the CLI does.

| Option | Meaning |
| --- | --- |
| `database` | Required. Journal path, or `':memory:'` |
| `rpcUrl` | One RPC URL, checked against every requested chain like `EVM_RPC_URL` |
| `rpcUrls` | `Map<number, string>` of RPC URLs by chain ID. Takes precedence over `rpcUrl`. |
| `rpcFallbacks` | `Map<number, ReadonlyArray<string>>` of fallback URLs by chain ID |
| `etherscanApiKey` | Etherscan key as an Effect `Redacted` value |
| `signer` | A viem `LocalAccount` for unattended signing |
| `policy` | Policy name bound to every plan, like `EVM_POLICY` |
| `externalSigner` | An `ExternalSigner` in place of the connected-wallet manager |
| `interactive` | Allow wallet pairing and interactive wallet requests. Defaults to `false`. |
| `onPairing` | Receives pairing links and QR text. Defaults to writing to standard error. |
| `walletProjectId` | WalletConnect project ID |
| `smartWalletUrl` | Hosted smart-wallet page |
| `socketUrl`, `socketApiKey`, `socketAffiliate` | Socket endpoint, key as `Redacted`, and affiliate |
| `safeRelay` | `{ chainId, bundlerUrl, paymasterUrl, sponsorshipPolicyId? }` with both URLs as `Redacted` |

Wallet connection files go in a `wallets` directory next to `database`.

## Signers

Pass a viem account for unattended signing, and bind it to a policy you created with `policy-create`:

```ts
import { ManagedRuntime } from 'effect'
import { privateKeyToAccount } from 'viem/accounts'
import { runtimeLayer } from '@beegreat/evm'

declare const agentKey: `0x${string}`

const runtime = ManagedRuntime.make(runtimeLayer({
  database: './agent.sqlite',
  signer: privateKeyToAccount(agentKey),
  policy: 'agent-session',
}))
```

An `ExternalSigner` hands transactions to something else. It has an `address`, an `interactive` flag and a `send(plan, nonce)` function that returns the transaction hash. It can also have `request(method, params, chainId)` for typed data and EIP-5792 batches, `preflight(chainId)`, and `smart` for a smart-wallet adapter.

`crossmintAdapter(wallet, chainId)` wraps a Crossmint wallet you have already configured into a `SmartWalletAdapter`. It checks that the wallet's chain matches `chainId` and that each prepared transaction matches the plan before approving it. Credentials, custody and signer scopes stay your responsibility. The toolkit does not create or scope signers for you.

## Compose services

Every command is built from exported Effect functions, so you can call them directly inside a runtime:

```ts
import { Effect, ManagedRuntime } from 'effect'
import type { LocalAccount } from 'viem'
import { execute, prepare, runtimeLayer, waitForOperation } from '@beegreat/evm'

declare const agentAccount: LocalAccount

const program = Effect.gen(function* () {
  const operation = yield* prepare({
    chainId: 8453,
    account: '0x1111111111111111111111111111111111111111',
    to: '0x2222222222222222222222222222222222222222',
    data: '0x',
    value: '1000',
    key: 'pay-001',
  })
  yield* execute({ id: operation.plan.id, approval: { _tag: 'approved', fingerprint: operation.plan.fingerprint } })
  return yield* waitForOperation(operation.plan.id)
})

const runtime = ManagedRuntime.make(runtimeLayer({ database: './evm.sqlite', signer: agentAccount }))
try {
  const operation = await runtime.runPromise(program)
  console.log(operation.state._tag)
} finally {
  await runtime.dispose()
}
```

`prepare` and `execute` return the full stored operation, including signed bytes once they exist. `publicOperation` strips them, which is what `dispatch` returns.

| Area | Exports |
| --- | --- |
| Services and layers | `Network`, `networkLayer`, `Store`, `storeLayer`, `Signer`, `signerLayer`, `Wallets`, `walletsLayer`, `Socket`, `socketLayer` |
| Contracts | `resolveContract`, `readContract`, `encodeCall`, `decode`, `codeIdentity`, `resolveName`, `simulation`, `capabilities` |
| Execution | `prepare`, `execute`, `status`, `waitForOperation`, `cancel`, `prepareReplacement`, `attachTransaction` |
| Assets | `transfer`, `approve`, `allowance`, `wrap`, `units`, `vault`, `lending` |
| Policies and workflows | `savePolicy`, `revokePolicy`, `policies`, `createWorkflow`, `runWorkflow`, `workflowStatus`, `cancelWorkflow`, `verifyCondition` |
| Socket | `prepareBridge`, `runBridge`, `bridgeStatus`, `waitBridge` |
| Wallet features | `typedSignature`, `walletCapabilities`, `prepareBatch`, `runBatch`, `batchStatus` |
| Data and monitoring | `indexedData`, `aero`, `watchBlocks`, `readWatch`, `createMonitor`, `pollMonitor`, `acknowledgeMonitor`, `pauseMonitor` |

`watchBlocks` and `readWatch` return Effect streams. Run them with the `Stream` module to consume samples as they arrive.

## Safe and passkeys

`@beegreat/evm/safe` exports the Safe workflows behind the `safe-*` commands, such as `safeInfo`, `safePredict`, `safeDeploy`, `safePropose`, `safeApprovals`, `safeApprove`, `safeExecute`, `safeChangeOwner`, `safeBatchPropose`, `safeBudgetPropose`, `safeRoleGrant`, `safePasskeyAddress`, `safeExecuteSignatures` and `safeSponsoredPropose`, plus their input schemas and `safeTransactionHash`.

In a browser, `createSafePasskey(name, rpId)` registers a WebAuthn P-256 passkey and returns its public data. `signSafeWithPasskey(provider, passkey, transaction)` checks the chain and Safe transaction hash, asks for an assertion, and returns signatures for `safe-execute-signatures`. See [Safe wallets](/docs/evm/safe#passkey-owners).
