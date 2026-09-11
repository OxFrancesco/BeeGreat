# Aero browser wallets

Open `aero tui`, choose Wallet, then Connect browser wallet. Aero opens a local
page that lists installed EIP-6963 wallet extensions, with Rabby first. Select
Rabby, approve the connection, and keep the tab open. Review actions in the TUI
and approve each transaction in Rabby.

The CLI equivalent is `aero wallet connect --browser`. It saves the public
address and wallet name. Each later CLI process opens a fresh browser connection
when it needs a signature and requires that same address. Use `--chain` to choose
a network. Base is the default. No wallet keys enter Aero.

Disconnect from the browser page, the TUI Wallet screen, or `aero wallet
disconnect`. Escape cancels TUI pairing. Closing the browser tab ends its live
connection and preserves the selected address for the next connection. Account
changes and wallet disconnect events clear the selection. Reconnecting does not
replay an interrupted transaction. Check wallet activity if a request timed out
or the tab closed while an approval was pending.

## Implementation

`packages/sugar/src/browser-wallet.ts` owns a loopback-only HTTP and WebSocket
server. The page is embedded in both source and bundled CLI builds. There are no
CDN scripts or new package dependencies. A random 256-bit token is passed in the
URL fragment and removed from the address bar after loading. The server requires
that token, an exact Host and Origin, and one authenticated tab per connection.
Pairing expires after two minutes; transaction approval expires after five.

`browser-wallet-client.ts` discovers providers through EIP-6963. It requests
account access, switches to the selected chain, and checks account and chain
again before sending. The transaction carries its reviewed chain ID, which Rabby
also validates. Only `eth_sendTransaction` is exposed by the bridge. Requests are
serialized and correlated by ID. A lost connection rejects the pending request
and closes the listener.

`external-wallet-signer.ts` supplies the same signer to CLI and TUI actions,
including swaps, liquidity, stocks, and index rebalancing. The selected browser
identity lives in a mode-0600 `browser-wallet.json` file in the existing wallet
directory. It contains only the version, public address, and wallet name.

## Applicable clients and deployment

The change applies to Aero's CLI and TUI and their shared signing contract.
Bee's web and mobile clients already have their own wallet connection UI.
iMessage and voice use backend-managed Web3 confirmation flows and cannot host
a local browser extension connection. Neither provider path, OpenRouter nor
Codex, changes. There are no backend schema, agent-worker, or Railway changes.
Unattended ALM execution continues to require the explicit local signer.

## Verification

Sugar's 323 tests, TypeScript checks, lint, and CLI build pass. Eighteen added
tests cover loopback authentication, origin and Host rejection, duplicate tabs,
sender and chain checks, exact transaction data, wallet rejection, cancellation,
timeouts, disconnects, identity storage, changes from another CLI process, and
shared signer selection.

The running TUI opened the browser page, discovered Rabby and Phantom, displayed
a Rabby connection rejection, and returned to the Wallet screen on Escape.
Francesco tested the new flow and confirmed it works in his setup. Agent-run
checks did not broadcast a transaction.
