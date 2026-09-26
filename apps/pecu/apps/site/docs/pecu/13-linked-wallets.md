---
title: Linked wallets
description: Link wallets you hold yourself to your Pecu account, then pick one to sign in a chat thread or add it as a Safe owner.
group: Use
---

Your Pecu wallet is a smart wallet that Pecu's server signs for. A linked wallet is one you hold yourself, such as Rabby, MetaMask or a phone wallet over WalletConnect. Pecu keeps its public address. Keys and wallet sessions stay in your wallet.

## Link a wallet

1. Open pecu.app/profile and press Link a wallet under Your wallets.
2. Pick a browser wallet, or WalletConnect to scan a QR code with a phone wallet.
3. Sign the message your wallet shows. It is a Sign-In with Ethereum message for the pecu.app domain and Base, it expires after five minutes, and signing it is free and sends nothing.

Repeat for each wallet. You can link up to 10. A wallet that is already connected shows Link to your account in the wallet menu in the top bar.

Pecu only links accounts that sign with their own key. Smart contract wallets, including Safes, cannot be linked.

## Name, switch and unlink

- The pencil names a wallet. The name appears in chat and in Safe forms.
- The wallet menu in the top bar shows which wallet is connected in this browser and lets you disconnect it. Disconnecting keeps the link.
- The bin unlinks a wallet. Pecu refuses while a transaction from that wallet is still being checked. Transactions it already sent stay on Base, and it stays an owner of any Safe until the owners remove it.

## Use a linked wallet in chat

When you have a linked wallet, the message box on pecu.app/agent shows a wallet picker. The choice belongs to the thread, like YOLO.

With a linked wallet picked, balance, token and position reads use that wallet, and Pecu builds transaction previews for it. The card lists the wallet and says it pays the Base network fee.

1. Connect the same wallet. If another one is connected, the confirm button asks you to connect the right one.
2. Press the confirm button. Your wallet shows each transaction in order, with any approvals first.
3. Approve it in the wallet. Pecu waits for Base to confirm each transaction before it asks for the next.

The card turns to Executed and verified on Base only after Pecu reads every transaction on Base and finds the exact call from your wallet with a successful receipt.

> [!WARNING]
> Transactions from a linked wallet are signed by you and cannot be recalled once your wallet sends them. Read the card and your wallet's own screen before you approve.

- YOLO never applies to a linked wallet. Every transaction needs your approval in the wallet.
- `/confirm ABC123` does not work for these previews, and they cannot be confirmed in X Chat. Use the card. `/cancel ABC123` still cancels a pending one.
- If you decline in the wallet before anything is sent, the card goes back to waiting for you. If a later transaction is declined, earlier ones stay on Base and you can confirm again before the preview expires.
- If your wallet was asked to send a transaction but Pecu never got its hash, for example because the tab closed, the card asks you to check your wallet's activity before sending it again.

Pick Pecu wallet in the same picker to go back. X Chat always uses your Pecu wallet.

## Use a linked wallet with Safes

Linked wallets are listed and checked as owners when you create a Safe, and their names label owners and approvals. To sign a Safe transaction with one, connect it and press Sign with your wallet. See [Safes](/docs/pecu/safes#owners-and-approvals).
