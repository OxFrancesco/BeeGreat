---
title: Wallets
description: Connect a browser extension or a WalletConnect wallet, or keep an encrypted local wallet, so aero can sign the plans it builds.
group: CLI
---

## Choose a wallet

| Wallet | Connect with | Who holds the key | Can run `aero serve --execute` |
| --- | --- | --- | --- |
| Browser extension, such as Rabby | `aero wallet connect --browser` | The extension | no |
| WalletConnect | `aero wallet connect` | Your wallet app | no |
| Local encrypted wallet | `aero wallet create` or `aero wallet restore` | Aero, sealed with your passphrase | yes |

Reads work without any wallet. Without a wallet, transaction commands print an unsigned plan for the address you pass with `--wallet`.

## Which wallet signs

Aero uses one active wallet, picked in this order:

1. A selected browser wallet.
2. A WalletConnect session.
3. The stored local wallet.

Connecting a browser wallet ends any WalletConnect session, and pairing over WalletConnect clears the browser selection. The local wallet stays stored in both cases and takes over again after `aero wallet disconnect`.

Transaction commands fill `--wallet` from the active wallet. If you pass a different address, Aero prints the unsigned plan for that address and does not sign.

## Browser wallet

### Connect

```sh
aero wallet connect --browser
aero wallet connect --browser --chain 10
```

Aero opens a local page in your default browser and prints its link. If your wallet lives in another browser, open the link there. The page lists every extension that announces itself through EIP-6963, with Rabby first. Pick one and approve the connection in the extension. Aero asks the extension to switch to `--chain`, Base by default, and refuses to continue if it stays on another network.

The CLI saves the public address and the wallet's name, then exits. In the TUI, choose Wallet, then Connect browser wallet, and keep the tab open.

### Signing from the CLI and the TUI

Each CLI transaction opens a fresh browser connection when it needs a signature, and requires the same account you selected. The TUI keeps its connection while the tab stays open and reuses it across actions. Closing the tab ends the live connection but keeps the selection, so the next signature opens a new one.

Every transaction is approved in the extension, even with `--yes`. Before each send the page checks that the extension's account and network still match the reviewed plan, and the request carries the plan's chain id.

Switching accounts in the extension, or disconnecting it, clears the selection. Disconnect is also available on the page, in the TUI Wallet screen and with `aero wallet disconnect`. In the TUI, Esc cancels a pending browser pairing.

### How the local page is protected

- The server listens on `127.0.0.1` only, on a free port.
- A random 256-bit token travels in the link's fragment. The page removes it from the address bar after loading, and the server rejects connections without it.
- Requests must carry the exact host, and the WebSocket must come from the page's own origin. Cross-site requests are refused.
- Only one authenticated tab is accepted per connection, and it must authenticate within 5 seconds.
- The only wallet method the page exposes is `eth_sendTransaction`, one request at a time.
- Pairing times out after 2 minutes. A transaction approval times out after 5 minutes.
- No keys reach Aero. The page loads no scripts from other hosts.

A lost connection or timeout never replays a request. If it happened while an approval was open in the extension, the transaction may already be submitted. Check the wallet's activity before retrying. [Transactions](/docs/aero/transactions#after-an-uncertain-or-lost-submission) explains how to reconcile it.

## WalletConnect

```sh
aero wallet connect
```

Aero prints a QR code and the `wc:` URI. Scan the code with your wallet app, or paste the URI into a wallet that accepts WalletConnect links. The pairing asks for `eth_sendTransaction` on the chain from `--chain`, Base by default, and offers the other supported chains as optional. `aero wallet status` lists the chains your wallet approved.

Every transaction is approved in the wallet app, including with `--yes`. A rejection in the app leaves the step unsent, so it can be retried. If the session expires, is deleted from the wallet, or the wallet changes account, Aero drops the local session and you pair again. The TUI can pair over WalletConnect from its Wallet screen, but Esc does not cancel that pairing.

Aero ships a public WalletConnect project id. Set `WALLETCONNECT_PROJECT_ID` to use your own.

## Local encrypted wallet

### Create

```sh
aero wallet create
```

Aero generates a BIP-39 recovery phrase and prints it once. Write it down. It is never stored in plaintext. Then choose a passphrase of at least 8 characters and type it twice, and confirm the address. The wallet uses the default Ethereum account of the phrase, with no BIP-39 passphrase.

If a local wallet already exists, Aero asks before overwriting it. There is one local wallet at a time.

### Restore

```sh
aero wallet restore
```

Type the recovery phrase at the hidden prompt. Aero checks the words and checksum, asks for a new passphrase, shows the derived address and asks you to confirm it.

### Storage

The phrase is sealed with scrypt (N 32768, r 8, p 1) and AES-256-GCM under your passphrase.

- On macOS the sealed record goes into the Keychain as a generic password, service `beegreat-sugar-cli`, account `local-wallet`.
- On other systems, or with `SUGAR_WALLET_NO_KEYCHAIN=1`, it goes into `wallet.enc` in the wallet directory with mode 0600.

### Signing

Every command that signs asks for the passphrase. Set `SUGAR_WALLET_PASSPHRASE` to sign without the prompt, for example in scripts or for `aero serve --execute`. With that variable set and `--yes`, a transaction command signs without asking anything. The local signer adds a 25% margin to the gas estimate and retries transaction preparation for about a minute. See [Transactions](/docs/aero/transactions#gas-and-preparation).

> [!WARNING]
> `aero wallet remove`, or overwriting the wallet with `create` or `restore`, deletes the only encrypted copy Aero has. Without the recovery phrase the funds in that wallet are lost. On macOS, `SUGAR_WALLET_DIR` does not move the Keychain entry, so a different wallet directory still reads and overwrites the same Keychain wallet unless `SUGAR_WALLET_NO_KEYCHAIN=1` is set.

## Status, disconnect and remove

```sh
aero wallet status
aero wallet disconnect
aero wallet remove
```

`status` prints the active address and its source. For WalletConnect it also shows the wallet name, the approved chains and any stored local wallet.

`disconnect` ends the browser selection and the WalletConnect session. It does not touch the local wallet.

`remove` deletes the local wallet from the Keychain and from `wallet.enc` after you confirm.

## Files

The wallet directory is `~/.config/sugar-ts` unless `SUGAR_WALLET_DIR` is set. Aero creates it with mode 0700.

| Path | Contents |
| --- | --- |
| `wallet.enc` | Sealed local wallet, when the Keychain is not used |
| `browser-wallet.json` | Selected browser wallet address and name |
| `walletconnect-session.json` | Active WalletConnect session address, topic and chains |
| `walletconnect/` | WalletConnect client storage |
| `executions/` | Execution journals and locks |
| `alm.json` | Default ALM config |
| `alm-state.json` | ALM cooldowns, caps and cycles |
| `dune.env` | Optional Dune API key for the TUI |

## Environment variables

| Variable | Effect |
| --- | --- |
| `WALLETCONNECT_PROJECT_ID` | WalletConnect project id instead of the built-in one |
| `REOWN_PROJECT_ID` | Used when `WALLETCONNECT_PROJECT_ID` is unset |
| `SUGAR_WALLET_PASSPHRASE` | Passphrase for creating, restoring and signing without a prompt |
| `SUGAR_WALLET_DIR` | Wallet directory instead of `~/.config/sugar-ts` |
| `SUGAR_WALLET_NO_KEYCHAIN` | Set to `1` to skip the macOS Keychain and use `wallet.enc` |
