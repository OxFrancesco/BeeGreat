# Pecu update

September 14, 2026.

## Confirming transactions

Reply to a specific transaction preview with `confirm` to proceed or `cancel` to cancel. `/confirm CODE` and `/cancel CODE` remain available. A bare `confirm` without a recognized preview asks you to select the preview.

`/yolo` shows your setting. `/yolo on` executes new transaction requests without another confirmation prompt. `/yolo off` restores confirmation prompts. YOLO defaults to off and applies only to your X account in that conversation. It does not execute existing previews.

## Wallet fixes

After user approval, the production Crossmint key ending `vkFy` was saved with `wallets:transactions.read` enabled. The key list showed six permissions after saving. Automatic approval review blocked an optional reopening of the editor, so no second editor readback was completed.

The handler explains missing permissions in plain text and preserves the prepared transaction ID. Retrying the same confirmation reads that transaction again instead of preparing another one. An expired preview cannot receive a new approval. Historical failed intents are not repaired automatically.

Live testing found that the wallet command closed its persistent shell. Each request now uses a separate session and confines cleanup to a subshell. The deployed fix returned `USDC: 0` for `/token USDC` in X Chat.

The reported swap was not retried or broadcast by this agent. Its live transaction status has not been reconciled. No ETH was spent by this agent.

## Aave and Polymarket

All five official Aave workflows are bundled. Reads use the official Aave service. Wallet plans support Base v3 supply, borrow, withdraw, and repay. Every plan discovers the market, checks the account and reserve, and simulates before preparing. Error warnings stop the plan. Other warnings appear in the preview. Approval-only plans are identified separately from the eventual action.

Polymarket research uses Exa with minimal effort. The API key is stored as a production secret. `/polymarket QUESTION` starts research and `/polymarket status` retrieves the same saved run. Duplicate events reuse the saved run ID. Live testing also found and fixed a Cloudflare fetch binding error before a paid research run began. The integration cannot place bets.

## Validation

TypeScript, 159 tests, and all four Worker dry-run builds passed. Tests cover reply ownership, conversation isolation, untrusted reply previews, cancellation, expiry, duplicate confirmation, YOLO settings, execution locking, permission recovery, the persistent-shell regression, Aave simulation and plan validation, and Exa run reuse.

A live unsigned Aave supply plan for 0.000001 ETH was prepared successfully. It was not signed or submitted. Live X Chat verified `/yolo` remains off and `/token USDC` succeeds. A transaction execution with a confirmed receipt has not been tested in this update.

The production bot is deployed as `ad080141-51a8-450f-8dc6-1e1b5030419e`. The EVM dependency is deployed as `6a7087a3-664a-4a8c-9aa6-ee2960e8b8b3`.

The live X Chat Aave account-position test remains pending. Automatic approval review rejected sending it because it would disclose the user's wallet/account context to the external Aave service. The message was not sent. Explicit approval for that disclosure is needed before this test can continue.

The authenticated Exa test completed in live X Chat at 12:39 Europe/Rome. `/polymarket` returned a public market URL, observed date, and market-implied odds in plain text. One minimal-effort research run was used. No bets or wallet transactions were created.
