# Pecu linked wallets

Pecu accounts can link wallets they hold themselves (EOAs) next to the Pecu
Crossmint wallet. A linked wallet can be picked per web chat thread, signs that
thread's transaction previews in the browser, and appears as an owner choice
when creating a Safe. X Chat, deposits and profile Safe actions keep using the
Pecu wallet.

## Linking

The web app connects a wallet through EIP-6963 browser extensions or
WalletConnect. WalletConnect uses `@walletconnect/ethereum-provider` 2.25.0 with
Reown project `cebb813303780775ef7c4a93f1daadee` (override with
`VITE_REOWN_PROJECT_ID`). The provider loads only in the browser, on demand, so
the Worker bundle and first paint do not include it. The Reown dashboard must
allow every origin that serves the app, including `pecu.app`.

Linking is a signed challenge:

1. `challenge` stores a Sign-In with Ethereum message for the sender, the page
   origin (taken by the web server from the request URL), chain 8453 and a
   random nonce. It lives five minutes and replaces the sender's older
   challenges.
2. The wallet signs it with `personal_sign`.
3. `link` loads the stored text, deletes the challenge whatever the outcome,
   recovers the signer with `recoverMessageAddress` and requires it to equal
   the challenged address.

Only ecrecover signatures link, so contract wallets (Safes, smart accounts) are
refused. A sender can link up to 10 wallets. Rename, unlink and the per-thread
choice are the reverse and follow-up states. Unlinking refuses while one of the
wallet's plans is executing and clears every thread that had it selected.

Storage lives in the Durable Object: `basedbot_linked_wallets`,
`basedbot_wallet_link_challenges` and `basedbot_chat_signers`, all keyed by the
verified sender. `src/linked-wallets.ts` owns them.

## Chat plans signed by a linked wallet

The Agent's top bar wallet chip shows the thread's wallet and a switch icon that
sets the choice, links another wallet or disconnects the browser wallet. The
chip, its P&L and the Portfolio page read that wallet: `/portfolio` and `/pnl`
accept an optional `wallet`, and the server serves only the Pecu wallet or a
wallet linked to the signed-in account.

A thread's choice (`use`) is read at call time. Balance, token, allowance,
position, Nansen and plan-building calls then use the linked address. The plan
is persisted with `signer` in `basedbot_intent_signers`, and its preview adds a
`Wallet:` row and the fee note.

A plan with a `signer` never runs through Crossmint:

- YOLO does not execute it.
- `/confirm CODE`, typed or from X Chat, answers with a pointer to the web card.
- Boot recovery skips it.

The web card drives `src/linked-execution.ts` through three operations:

| Operation | Effect |
| --- | --- |
| `step` | Verifies submitted steps from Base, then hands out the next exact persisted call and marks it `prepared`. A `prepared` step without a hash returns `unreported` unless the client resends. |
| `submitted` | Records the wallet's hash for the current step, refusing a hash whose on-chain transaction differs from the call. |
| `declined` | Returns a handed-out step to `planned`. With nothing sent, the intent goes back to `pending`. |

A step succeeds only when the server's Base RPC shows the exact `from`, `to`,
`input` and `value`, and a successful receipt in a canonical block. A revert
or a mismatched transaction fails the intent. Expiry before an unsent step
expires a pending intent, or fails an executing one with earlier steps left on
Base. Steps wait for each receipt before the next is handed out, so allowance
state is current.

Nobody has to keep the tab open. A sweep at Durable Object start and on every
alarm verifies sent steps from Base and closes plans that expired before their
next step. An `unreported` step stays open until the person checks their wallet
and resends; after expiry, a resend closes the plan instead of sending.

## Safes

The profile's Safe form lists linked wallets as owner choices, and linked names
label owners, approvals and spending-limit delegates. Signing or executing a
Safe transaction still uses the connected browser wallet and the existing
signature recovery in `src/safe-profile.ts`. Delegate spending from a linked
wallet's limit is not offered yet.

## Surfaces

Pecu web (chat and profile) is the only client. X Chat keeps the Pecu wallet
and gets a clear refusal for linked previews. BeeGreat's own linked EOA
(`packages/backend/convex/wallets.ts`) is a separate feature and is unchanged.

## Verification

- `bun run --cwd apps/pecu test` includes `tests/linked-wallets.test.ts`
  (SIWE link rules, thread choice, agent plans, step ordering, declines,
  reverts, mismatches, expiry, unlink guard and recovery).
- `bun run --cwd apps/pecu/apps/stocks test` covers the wallet helpers,
  the linked preview card and owner labels.
- `tests/browser/linked.ts` adds `?linked` to the agent and profile fixtures
  (`bunx vite --config tests/browser/vite.config.ts`), with a simulated Rabby
  wallet. `?linked=none` starts unlinked and `&disconnected` starts with no
  connected wallet.
- A linked-wallet transaction from a real wallet over WalletConnect, settled
  from its Base receipt, has not been run in production yet.
