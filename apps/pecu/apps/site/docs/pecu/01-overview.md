---
title: Overview
description: Pecu is an AI agent you message on X or use in the browser, with its own Base smart wallet for each account.
group: Start
---

You talk to Pecu in X Chat by messaging @BeeGreatAI, or in the browser at pecu.app/agent. Each verified account gets its own Base smart wallet, created the first time you write.

Ask in plain words, like "What's my balance?" or "Swap 0.001 ETH to USDC", or use short commands such as `/balance` and `/swap`. Reads answer right away. Anything that moves funds comes back as a preview first, and nothing is sent until you confirm it.

> [!WARNING]
> Transactions run on Base mainnet with real funds. A wrong amount, recipient or approval can lose money for good, and a sent transaction cannot be undone. Start with reads and small amounts, and check every preview before you confirm.

## Where Pecu runs

| Place | What you get |
| --- | --- |
| X Chat, @BeeGreatAI | Plain text replies. Your first message creates your wallet. |
| pecu.app/agent | The same agent in the browser, with threads, transaction cards, charts and a wallet P&L view. |
| pecu.app/stocks | Aero Stocks, a tokenized stock market with holdings, buy and sell previews, saved baskets and the agent in a side panel. |

Sign in to the web app with the X account you use with Pecu and you get the same wallet as on X. You can also sign in with Google, which gives you a separate web wallet. See [Web agent](/docs/pecu/web-agent). Shared Safe wallets with several owners live at pecu.app/profile. See [Safes](/docs/pecu/safes).

## What Pecu can do

- Create your Base wallet and show its address and balances.
- Quote swaps, and preview swaps, transfers and token approvals.
- Add and remove Aerodrome liquidity, stake, claim rewards and lock AERO.
- Buy, sell and rebalance tokenized stocks.
- Take deposits by bank transfer or crypto through Whop and turn them into USDC on Base.
- Supply, borrow, withdraw and repay on Aave v3 on Base.
- Answer read-only questions with Nansen on-chain data and public Polymarket markets.
- Read any Base token or contract, decode data and preview a contract call when you give it the address and function.

Start with [Quickstart](/docs/pecu/quickstart). The full list of short commands is in [Commands](/docs/pecu/commands).

## What Pecu will not do

- Send a transaction on any chain except Base mainnet, chain ID `8453`. Analytics and Polymarket reads can cover other chains, but they never sign.
- Ask for or accept a private key, seed phrase or password. Your wallet is tied to your verified account, so there is nothing to paste.
- Let the AI confirm its own previews or turn on YOLO. Only a message from you does that.
- Place Polymarket bets, sign orders or bridge funds.
- Guess network fees. Previews currently say `Network fee: not estimated yet.`
- Give financial advice. Analytics replies report what the data shows.

## How a transaction works

1. You ask for a swap, transfer or other action.
2. Pecu builds the exact transaction without signing it, checks it against what you asked for and saves it.
3. You get a preview with the amounts, a six-character code and an expiry, currently 10 minutes.
4. You confirm by replying `confirm` to the preview or by sending `/confirm ABC123`. Only you, in the same conversation, can confirm it.
5. Pecu sends it from your wallet and reports success only after it verifies the receipt on Base.

`/yolo on` skips step 4 for new requests in that chat. [Confirmations](/docs/pecu/confirmations) explains the rules, and [Security](/docs/pecu/security) explains what can and cannot move your funds.
