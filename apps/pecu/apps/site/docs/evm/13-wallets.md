---
title: Wallets
description: Connect a browser wallet, WalletConnect or a Crossmint smart wallet, or give an unattended agent a key bound to a policy.
group: CLI
---

## Signer sources

| Source | How you set it up | Who approves each transaction |
| --- | --- | --- |
| Browser wallet | `evm wallet connect --browser` in an interactive terminal | You, in the wallet extension |
| WalletConnect | `evm wallet connect` in an interactive terminal | You, in the mobile wallet |
| Crossmint smart wallet | `evm wallet connect --smart` in an interactive terminal | You, with the wallet passkey on the hosted page |
| Local key | `EVM_PRIVATE_KEY` in the environment | The toolkit, after `--approve` or `--yolo` |
| SDK signer | A viem `LocalAccount` or an external signer passed to `runtimeLayer` | Your code |

A local key or SDK signer is used before any connected wallet. Keys are never accepted as command arguments and are never written to the journal. Interactive wallets stay interactive under `--yolo`, so a browser wallet or passkey still asks its owner.

## Connect a wallet

```sh
evm wallet connect --browser --chain 8453 --name main
evm wallet connect --chain 8453 --name mobile
evm wallet connect --smart --chain 8453 --name smart
```

With neither `--browser` nor `--smart`, the connection uses WalletConnect. `--chain` defaults to `8453` and `--name` to `main`. The JSON form is `wallet-connect`:

```sh
evm wallet-connect --input '{"kind":"browser","chainId":8453,"name":"main"}'
```

`kind` is `browser`, `walletconnect` or `crossmint`. Connecting needs an interactive terminal. In agent mode, including MCP, the toolkit never opens a browser and fails with `SignerInteractionRequired`. Each name must be new. The wallet you connect becomes the selected wallet.

### Browser wallets

The command opens a local page on `127.0.0.1` at a random port. The page discovers injected wallets with EIP-6963 and lists Rabby first. Pick a wallet and account. The page switches the wallet to the requested chain and checks that the switch happened.

Keep the tab open while you work. The TUI keeps the connection open between commands. A separate CLI process opens the page again when it needs a signature, and the reconnection must use the same account.

### WalletConnect

The command prints a QR code and pairing URI to standard error. The TUI shows them in place. The session must allow `eth_sendTransaction` on the chain you asked for. It can also allow `eth_signTypedData_v4`, `wallet_getCapabilities`, `wallet_sendCalls` and `wallet_getCallsStatus` on chains 1, 8453, 42161, 10, 137 and 56.

Before each request, the toolkit checks that the session is unexpired and authorizes the account, chain and method. If not, reconnect. The toolkit ships with a public WalletConnect project ID. Set `WALLETCONNECT_PROJECT_ID` to use your own.

### Smart wallets

`--smart` opens the hosted page set by `EVM_SMART_WALLET_URL`, which defaults to `https://beegreat.app/evm-wallet`. You sign in there, and the page connects a Crossmint smart wallet that approves with a passkey. The page must use HTTPS. Plain HTTP is allowed only on `localhost` and `127.0.0.1` for development. Your browser may ask for permission to reach the local network, because the page talks to the loopback bridge.

A smart wallet connection is bound to the chain you connected it on. Connect a separately named wallet for each network. Supported chains are 1, 8453, 84532, 11155111, 42161, 10 and 137.

Execution works differently from an EOA:

1. Crossmint prepares an unsigned transaction.
2. The toolkit checks that it is exactly the plan's single call, then stores the Crossmint transaction ID and UserOperation hash.
3. The page shows the recipient, value, calldata and fee payer, and you approve with the passkey.
4. The operation is confirmed only when the canonical receipt contains a matching `UserOperationEvent` from EntryPoint v0.6, v0.7 or v0.8, and that event reports inner success.

Local policies cannot bound account-abstraction or sponsorship fees, so a plan with a policy fails with `CapabilityUnavailable` on a smart wallet. Live login, passkey enrollment and recovery depend on the hosted page's configuration and are not covered by the automated tests.

## Manage connections

```sh
evm wallet status
evm wallet select --name main
evm wallet disconnect --name main
evm wallet
evm wallet-capabilities --input '{"chainId":8453}'
```

| Command | Result |
| --- | --- |
| `wallet status` | `active` name and the list of connections with name, address, kind, peer and chains |
| `wallet select` | Selects a connection by name |
| `wallet disconnect` | Removes the local record and ends a WalletConnect session. The wallet and its assets are untouched. |
| `wallet` | The address that will sign, and a `source` of `sdk-or-environment`, `connected-wallet` or `none` |
| `wallet-capabilities` | EIP-5792 capabilities reported by the connected wallet, or `available: false` |

## Sign typed data

`sign-typed-data` returns a preview first and signs only with an exact approval or `--yolo`. Put the request in a file:

```json
{"chainId":8453,"account":"0xYOUR_ADDRESS","key":"permit-001","domain":{"name":"Example","version":"1","chainId":8453,"verifyingContract":"0xTOKEN"},"types":{"Message":[{"name":"amount","type":"uint256"}]},"primaryType":"Message","message":{"amount":"123"}}
```

```sh
evm sign-typed-data --file typed.json
evm sign-typed-data --file typed.json --approve 0xFINGERPRINT
```

The preview returns the EIP-712 digest as `fingerprint` with `signature: null`. With approval, the local key or connected wallet signs, and the toolkit verifies the signature against the account on chain before storing it under `key`. Running the same request again returns the stored signature. `domain.chainId` must equal `chainId`.

Typed-data signatures can grant off-chain spending authority, such as permits. When `EVM_POLICY` is set, `sign-typed-data` refuses with `PolicyDenied`.

## Unattended agents

For unattended execution, set `EVM_PRIVATE_KEY` to a `0x`-prefixed 32-byte hex key in the agent's environment. Create a policy for it and set `EVM_POLICY` to that policy's name:

```sh
export EVM_PRIVATE_KEY=0x...
export EVM_POLICY=agent-session
evm execute --input '{"id":"PLAN_ID"}' --yolo
```

With `EVM_POLICY` set, every new plan gets that policy, a plan naming a different policy is refused, and signing checks the plan against the policy. The CLI does not require `EVM_POLICY`. Without it, the key signs any plan you approve. See [Policies and workflows](/docs/evm/policies-and-workflows#policies).

The toolkit never delegates your smart wallet to an agent, and the TUI does not provision scoped agent signers. For on-chain limits that hold regardless of the signer, use [Safe budgets and roles](/docs/evm/safe).

## Bridge security

The browser and smart-wallet flows talk to the terminal through a local bridge:

- It listens only on `127.0.0.1` at a random port.
- It accepts only `GET` requests for its own host, and only the local page's origin, or the hosted page's origin, can open its WebSocket.
- A 32-byte random token travels in the URL fragment and is compared in constant time. The page removes it from the address bar.
- It binds one chain and one account. An account change in the wallet closes the connection.
- It relays only `eth_sendTransaction`, `eth_signTypedData_v4`, `wallet_getCapabilities`, `wallet_sendCalls` and `wallet_getCallsStatus`, one request at a time.
- Pairing expires after two minutes for browser wallets and ten minutes for smart-wallet login. Each signing request expires after five minutes. When a request times out, the bridge closes and the submission is treated as possibly sent.
- It carries requests and results only, never login tokens or private keys.

Connection records live in `wallets/accounts.json` next to the journal, with mode `0600` inside a `0700` directory. WalletConnect session storage lives in the same directory.
