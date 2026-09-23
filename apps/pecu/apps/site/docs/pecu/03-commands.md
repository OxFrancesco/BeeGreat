---
title: Commands
description: Every short command Pecu understands, with the syntax it expects and the plain-words requests that do the same thing.
group: Use
---

Commands work the same in X Chat and in the web app. You can ask for everything in plain words instead, but a command always runs the same way and never goes through the AI.

## How commands are read

- Commands start with `/`. Every command also works with `b/` in place of `/`, so `b/balance` and `/balance` do the same thing. The verbose command is usually written `b/verbose`.
- Command names are not case sensitive. Confirmation codes are upper-cased for you.
- Pecu also reads most commands without a prefix, such as `balance` or `swap 0.001 ETH to USDC`. The YOLO commands always need the prefix. Add the `/` whenever you want to be sure a message is read as a command.
- A message that starts with `/` or `b/` but does not match a command gets an error with the right usage, such as `Usage: /send 10 USDC to 0x…`. It is not passed to the AI.
- Amounts are in normal token units with up to 18 decimal places. `0.001 ETH` means 0.001 ETH, not wei.
- `ETH`, `USDC` and `AERO` are recognized by name. For another token, use its full contract address in place of `0xTOKEN`.
- Replace `0xRECIPIENT` and `0xSPENDER` with complete addresses. The placeholders themselves are not valid.
- You never pass a wallet, chain, key or password. Transactions always use your own wallet on Base.

## Wallet and balances

| Command | What it does | Example |
| --- | --- | --- |
| `/wallet` | Creates your Base wallet if needed and shows its address. | `/wallet` |
| `/balance` | Shows your ETH, USDC and AERO balances. | `/balance` |
| `/token TOKEN` | Shows your balance of ETH, USDC, AERO or any token address. | `/token 0xTOKEN` |
| `/stocks` | Shows your tokenized stock holdings. The web app adds a chart. | `/stocks` |

## Quotes, swaps and transfers

| Command | What it does | Example |
| --- | --- | --- |
| `/quote AMOUNT TOKEN to TOKEN` | Shows about how much you would receive. Creates nothing. | `/quote 0.001 ETH to USDC` |
| `/swap AMOUNT TOKEN to TOKEN` | Builds a swap preview with a confirmation code. | `/swap 0.001 ETH to USDC` |
| `/send AMOUNT TOKEN to ADDRESS` | Builds a transfer preview. | `/send 1 USDC to 0xRECIPIENT` |

- `/quote` and `/swap` need two different tokens. Besides `ETH`, `USDC`, `AERO` and token addresses, they accept other symbols that Aerodrome recognizes. Use the address when you need to be exact.
- `/swap` uses a 1% slippage limit. For a lower limit, use `/aero swap` with `--slippage`. See [Aero commands](/docs/pecu/aero-commands).
- `/send` takes ETH, USDC, AERO or a token address. It checks your balance before it builds the preview and refuses a transfer to your own wallet.

## Allowances

An allowance lets another address spend a token from your wallet. Setting one does not move any tokens.

| Command | What it does | Example |
| --- | --- | --- |
| `/allowance TOKEN for ADDRESS` | Shows how much that address can spend. | `/allowance USDC for 0xSPENDER` |
| `/approve AMOUNT TOKEN for ADDRESS` | Previews setting the allowance to exactly this amount. | `/approve 1 USDC for 0xSPENDER` |
| `/revoke TOKEN for ADDRESS` | Previews setting the allowance to zero. | `/revoke USDC for 0xSPENDER` |

ETH has no allowances, so these commands take `USDC`, `AERO` or a token address.

## Deposits

| Command | What it does | Example |
| --- | --- | --- |
| `/deposit` | Shows your Whop funding page and deposit details. Asks for an email the first time. | `/deposit` |
| `/deposit AMOUNT` | The same, for a USD amount from 10 to 100,000. | `/deposit 50` |
| `/deposit setup EMAIL` | Creates your Whop funding account. Whop sends deposit receipts to this email. | `/deposit setup you@example.com` |
| `/deposit status` | Lists your five most recent deposits and whether the USDC was sent. | `/deposit status` |

[Funding](/docs/pecu/funding) covers limits, holds and sending funds directly on Base.

## Confirmations and YOLO

| Command | What it does | Example |
| --- | --- | --- |
| `confirm` as a reply | Confirms the preview you reply to. X Chat only. | reply `confirm` |
| `cancel` as a reply | Cancels the preview you reply to. X Chat only. | reply `cancel` |
| `/confirm CODE` | Sends the saved transaction, or checks one that was already sent. | `/confirm ABC123` |
| `/cancel CODE` | Cancels a pending preview so it can never be sent. | `/cancel ABC123` |
| `/yolo` | Shows whether YOLO is on for you in this chat. It starts off. | `/yolo` |
| `/yolo on` | New transaction requests run without a confirmation prompt. | `/yolo on` |
| `/yolo off` | New requests need your confirmation again. | `/yolo off` |

A code only works for the account and conversation that created it. `/cancel` cannot undo a transaction that was already sent. Read [Confirmations](/docs/pecu/confirmations) before you turn on YOLO.

## Analytics and markets

| Command | What it does | Example |
| --- | --- | --- |
| `/nansen` | Lists the Nansen commands. `/nansen help` does the same. | `/nansen` |
| `/nansen token TOKEN [chain] [timeframe]` | Token snapshot with price, market cap, liquidity, volume and holders. | `/nansen token 0xTOKEN base 7d` |
| `/nansen flows TOKEN [chain] [timeframe]` | Net inflows and outflows by holder group. | `/nansen flows 0xTOKEN` |
| `/nansen wallet [ADDRESS] [chain]` | Token balances. Defaults to your wallet on Base. | `/nansen wallet` |
| `/nansen pnl [ADDRESS] [chain]` | Realized and unrealized P&L by token over 30 days. | `/nansen pnl` |
| `/nansen portfolio [ADDRESS]` | Wallet tokens across chains and DeFi positions, kept separate. | `/nansen portfolio` |
| `/nansen markets [words]` | Polymarket markets ranked by 24-hour volume. | `/nansen markets fed rate cut` |
| `/polymarket QUESTION` | Searches public Polymarket markets. | `/polymarket fed rate cut` |
| `/polymarket help` | Lists the direct Polymarket reads. | `/polymarket help` |
| `/polymarket read ENDPOINT JSON` | Runs one direct Polymarket read. | `/polymarket read leaderboard {"limit":5}` |
| `/polymarket research QUESTION` | Starts optional deeper research. | `/polymarket research Compare Fed market probabilities` |
| `/polymarket status` | Shows your latest research result without starting a new run. | `/polymarket status` |
| `/aave help` | Shows examples for Aave rates, positions and previews. | `/aave help` |
| `/aero help` | Shows the advanced Aerodrome commands. | `/aero help` |

Nansen and Polymarket are read-only. Aave and Aerodrome previews follow the normal confirmation rules. See [Analytics and markets](/docs/pecu/analytics) and [Aero commands](/docs/pecu/aero-commands).

## Help and technical details

| Command | What it does | Example |
| --- | --- | --- |
| `/help` | Shows the short command list. `/start` does the same. | `/help` |
| `b/verbose` | Shows the technical data behind your latest result in this chat, as JSON. `/verbose` does the same. | `b/verbose` |
| `b/verbose PAGE` | Reads another page of a long result. Pages start at 1. | `b/verbose 2` |

`b/verbose` does not run anything again and does not switch later replies to JSON. It only shows data saved for your account in the current conversation. Normal replies summarize long results, so use it when you need every field or record.

## Plain-words shortcuts

Requests like these are answered right away without the AI, so they keep working when AI replies are unavailable. Other phrasings go to the agent, which can do the same things and more.

| You can say | Pecu runs |
| --- | --- |
| "What's my wallet address?", "Create my wallet" | `/wallet` |
| "What's my balance?", "How much ETH do I have?" | `/balance` |
| "Add funds", "Top up my wallet", "How do I deposit money?" | `/deposit` |
| "Show my stocks", "Which stocks do I own?", "What's in my stock portfolio?" | `/stocks` |
| "Show my portfolio", "What am I holding?" | `/nansen portfolio` |
| "Show my PnL", "Show my profit and loss" | `/nansen pnl` |
