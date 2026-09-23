---
title: Quickstart
description: Create your wallet, fund it, check your balance and preview your first swap.
group: Start
---

These steps use X Chat. The same messages work in the browser at pecu.app/agent.

## Send your first message

Send any message to @BeeGreatAI in X Chat. A greeting is enough. Pecu creates your Base smart wallet before it answers, even when the first message is a command.

```text
/help
```

If wallet creation fails, Pecu replies with an error and tries again on your next new message. Once it exists, the same wallet is used in every conversation with your X account.

To start in the browser instead, open pecu.app/agent and sign in. With Google, your web wallet is created with your first message there. With X, send one message to @BeeGreatAI on X first, then reload the page.

## Get your wallet address

```text
/wallet
```

Pecu replies with your address on Base.

```text
Your Base wallet:
0xYOUR_ADDRESS
```

Asking "What's my wallet address?" gives the same answer.

## Fund the wallet

Send ETH or USDC to that address on the Base network. Pecu only sees and moves funds on Base, so tokens sent on another network will not show up. Keep a little ETH in the wallet for network fees.

To pay by bank transfer, or with crypto on another network, send `/deposit`. See [Funding](/docs/pecu/funding).

## Check your balance

```text
/balance
```

The reply lists ETH, USDC and AERO. The amounts below are an example.

```text
ETH: 0.002
USDC: 0
AERO: 0
```

For any other token, send `/token` with a symbol or contract address, such as `/token 0xTOKEN`.

## Get a quote

A quote shows about how much you would receive. It does not create a transaction.

```text
/quote 0.001 ETH to USDC
```

Amounts are in normal token units, so `0.001 ETH` means 0.001 ETH.

## Preview a swap

```text
/swap 0.001 ETH to USDC
```

Pecu builds the swap, saves it and sends back a preview. Nothing has been sent yet. The amounts below are an example.

```text
Swap 0.001 ETH for about 2.5 USDC on Base.
Minimum received: 2.475 USDC
Network fee: not estimated yet.

Reply to this message with "confirm" to proceed or "cancel" to cancel.
You can also send /confirm ABC123 or /cancel ABC123.
Expires in 10 minutes.
```

The minimum received comes from the slippage limit, 1% for `/swap`. If the price moves further than that before the swap lands, it does not go through.

## Confirm or cancel

Reply to the preview with `confirm`, or send the code from your own preview.

```text
/confirm ABC123
```

Pecu signs and sends the swap, then checks the receipt on Base before it reports success.

```text
Aerodrome swap confirmed on Base mainnet.
https://basescan.org/tx/0x...
```

To drop the swap, reply `cancel` or send `/cancel ABC123`. A preview that is not confirmed before it expires can no longer be sent.

If the reply says the swap was submitted but is not verified yet, send the same `/confirm ABC123` again. Pecu checks it again and does not resubmit. Do not start a new swap to replace it.

[Confirmations](/docs/pecu/confirmations) covers codes, expiry, YOLO and what to do when something looks stuck.
