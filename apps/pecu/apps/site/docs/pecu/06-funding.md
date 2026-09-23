---
title: Funding
description: Add ETH or USDC to your Pecu wallet on Base, or deposit by bank transfer or crypto through Whop.
group: Use
---

## Your wallet address

Send `/wallet` or ask "What's my wallet address?". In the web app, your wallet sits in the top bar. The copy button copies the full address, and hovering over it shows a QR code.

## Send ETH or USDC on Base

The quickest way to fund the wallet is to send ETH or USDC to its address on the Base network, from an exchange or another wallet.

> [!WARNING]
> Use the Base network only. Pecu reads and moves funds only on Base, chain ID `8453`. Tokens sent on another network do not show up in Pecu, and Pecu has no command to move them.

- Keep some ETH in the wallet for network fees. Previews do not estimate the fee yet.
- Send `/balance` to see ETH, USDC and AERO, or `/token 0xTOKEN` for anything else.

## Deposit through Whop

Whop handles bank transfers and crypto sent from other networks. When Whop confirms your deposit, Pecu sends the same dollar amount in USDC to your wallet on Base.

> [!NOTE]
> Live Whop deposits have not been tested end to end yet. Only the checks, holds and relay logic have been tested. Start with a small deposit and check `/deposit status`.

### Set up your funding account

The first `/deposit` asks for an email. Whop uses it for deposit receipts.

```text
/deposit
/deposit setup you@example.com
```

Pecu creates your Whop funding account and replies with your deposit details. Later requests reuse the same account. Asking "Add funds to my wallet" works too.

### Get deposit details

```text
/deposit
/deposit 50
```

The amount is optional. It is in USD, from `10` to `100000`, with up to two decimals. The reply can include:

- A link to your Whop funding page.
- Bank transfer details, when Whop has enabled them for your account. Bank rails may ask you to verify your identity with Whop.
- Crypto deposit addresses on other networks. Base is left out, because you can send to your wallet directly.

Pecu repeats these details exactly as Whop returns them. Crypto deposits need at least $10.

### After you pay

Once Whop confirms the deposit, Pecu sends USDC from its treasury wallet to yours. This relay is automatic and has no confirmation code, so `/confirm` and `/cancel` do not apply to it.

- Automatic relays cover up to $500 per deposit. A larger deposit waits for a manual review.
- Pecu also caps the total it relays for all users in 24 hours. A deposit over that cap waits and is retried later.
- Deposits in USD, USDC and USDT are relayed. Other currencies are held.

Pecu sends deposit updates to the X conversation where you last asked for deposit details. If you last asked in the web app, check `/deposit status` instead.

### Check status

```text
/deposit status
```

You see your five most recent deposits, each with its date, amount, currency and state.

| State | Meaning |
| --- | --- |
| received, sending USDC… | Whop confirmed it and the relay is starting. |
| sending USDC… | The USDC transfer is in progress. |
| sent 50 USDC | Done. A Basescan link follows when one is available. |
| on hold | Waiting. The reason follows in brackets. |
| failed; the team has been notified | The relay failed. Nothing more is needed from you. |

| Hold reason | What happens next |
| --- | --- |
| waiting for Whop to release the funds | Retried automatically once Whop releases them. |
| above the automatic limit | Waits for a manual review. |
| daily limit reached, retrying tomorrow | Retried automatically. |
| waiting for treasury funds | Retried automatically. |
| transactions are paused | Retried automatically. |
| under review at Whop | Not retried automatically. |
| currency not supported | Not retried automatically. |
| no matching wallet | Not retried automatically. |
