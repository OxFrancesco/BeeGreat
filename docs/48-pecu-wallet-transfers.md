# Wallet transfers

The Send tokens button beside the Agent wallet address opens a form for transfers
between the account's Pecu wallet and its linked wallets on Base. Choose From,
To, Token and Amount. The destination list excludes the source. The token list
includes ETH, USDC and the source wallet's saved tokens. Other token accepts a
ticker or Base contract address and resolves it through the existing portfolio
read before allowing review.

Balances display at most six decimal places in the form, wallet hover card and
full portfolio. Display rounding uses decimal strings and bigint so large
integer amounts remain exact. Validation and transaction amounts retain their
original precision.

Review transfer creates a fresh web thread, selects its signer and sends the
existing deterministic `/send` command. The new thread starts with YOLO off.
The typed `reviewWallet` field requires the expected source and refuses a
non-transfer command or a thread with YOLO enabled before handling the turn.
Transport retries reuse the thread and request IDs. The existing preview owns
confirmation, cancellation, receipt checks and linked-wallet signing.

## Scope and verification

- Web Agent adds the form. X Chat retains `/send`, using its Pecu wallet.
- OpenRouter and Codex use the same command path; this form does not call a model.
- Bee mobile, Android, CLI, iMessage, voice and Hive have separate interfaces
  and do not mount Pecu's wallet controls. No shared SDK or wire format for those
  clients changes. Safes remain in their existing quorum-based transfer flow.
- Deploy the Pecu agent Worker for the review guard, the Stocks web Worker for
  the form and balance formatting, and the site Worker for docs and specimens.
- Tests cover precise balance comparisons, both transfer directions, retry
  identity, source mismatch, YOLO rejection and hover/full balance displays.
  The browser fixture mocks requests and cannot move funds.
