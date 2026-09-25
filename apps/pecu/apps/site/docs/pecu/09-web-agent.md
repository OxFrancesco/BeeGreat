---
title: Web agent
description: Use Pecu in the browser at pecu.app/agent, with threads, transaction cards, your wallet P&L and the ChatGPT connection.
group: Use
---

pecu.app/agent runs the same agent as X Chat. Replies stream in a paragraph at a time, previews become cards with buttons, and analytics come with charts.

## Signing in

Press Sign in and pick one of two ways.

| Sign in with | Wallet you get |
| --- | --- |
| The X account you use with Pecu | The same wallet as on X. If you have never messaged Pecu, send one message to @BeeGreatAI on X first, then reload. |
| Google, or another method without X | A separate web wallet, created with your first message. |

Pecu picks the wallet from your sign-in. With one verified X account linked, you get that account's wallet. With none, you get the web wallet. Two verified X accounts on one sign-in are not supported, and Pecu asks you to sign in with the X account you use with Pecu.

> [!NOTE]
> Linking or unlinking X on your sign-in account switches which wallet Pecu uses. Check the address in the top bar before you send funds to it.

## Threads

Each thread is its own conversation, with its own previews and its own YOLO setting.

- New thread starts a fresh conversation. Opening pecu.app/agent takes you to your most recent thread.
- The chat panel in Aero Stocks is the thread called First conversation.
- Your X chat is a separate conversation. A confirmation code from X does not work here, and a code from one thread does not work in another.
- Deleting a thread removes its history from the web app. Pecu refuses while a sent transaction in that thread is still being checked. Transactions you already confirmed stay on Base.
- Earlier messages, Later messages and Latest move through long histories. Messages and threads load 40 at a time.
- Cmd+Shift+S shows or hides the thread sidebar on a Mac. On a narrow screen, use the Threads button.

## Sending messages

- Type `/` to open command completion. Arrow keys move through the list, Enter or Tab picks a command and Escape closes it.
- A message can be up to 4,000 characters.
- On an empty thread, suggestions such as "What's my balance?" send with one press.
- While Pecu works, it shows "Pecu is working on it" and then the reply as it is written. The saved reply replaces the streamed text when it is ready, and can differ from it when the answer ends in a question, a preview or an error.
- Closing the tab does not stop a reply. Unanswered messages refresh on their own when you come back.

## Retry and resume

- If the connection drops, Pecu keeps an unsent message visible beside the error. The error's Retry button reuses the same request ID, so a completed request returns its saved reply instead of running again.
- Retry, the circular arrow under the latest reply, asks Pecu to answer your last message again. The new answer replaces the old one, and your message is not repeated.
- Retry is only offered on the latest answer. Commands and replies that created a transaction preview cannot be retried. They keep their own controls.
- A transaction from a retried answer always needs your confirmation, even with YOLO on.
- Resume response appears when a reply never arrived and nothing is running in your browser. It resends the same request, so it cannot create a second transaction.
- If a send fails, the error under the message box offers Retry for that request.

## Transaction cards

A preview shows as a card with the amounts first, full addresses you can copy, and confirm and cancel buttons. The buttons send `/confirm ABC123` and `/cancel ABC123` for you, and the card updates in place. After you confirm, the main button reads Check transaction until the receipt is verified. [Confirmations](/docs/pecu/confirmations#confirming-on-the-web) lists every card status.

While YOLO is on, the top bar shows "YOLO on · turn off". Pressing it sends `/yolo off`.

## Wallet and P&L

Once you have a wallet, it appears in the top bar.

- The copy button copies the full address. Hover over it to see a QR code of the address.
- Hover over the short address for a 30-day P&L preview on Base, with the total, realized and unrealized amounts, and the three tokens with the largest gains or losses.
- Click the address to open the full P&L page. Choose 7 days, 30 days, 90 days or 1 year to see totals, a chart of the largest results and a table by token. A Basescan link opens your wallet.

P&L data comes from Nansen and covers your own wallet on Base only. A result is reused for up to 10 minutes. Tokens Nansen has no price for are left out of the totals, and the page says how many. These reads never add messages to your chat. In X Chat, `/nansen pnl` returns the same data as text.

## Profile

Press your avatar in the top bar to open the account menu, then pick Profile, or go to pecu.app/profile. It shows your name, your Pecu wallet with its balances, and your organizations and Safes. Manage account in the same menu opens your sign-in settings. See [Safes](/docs/pecu/safes).

## ChatGPT connection

Open ChatGPT connection from the account menu, or go to pecu.app/agent#chatgpt. [AI models](/docs/pecu/models) explains what the connection does and what happens without one.

## Pecu cards

A signed-in account with a verified X connection receives one randomly assigned Pecu card, from 30 designs. Open My cards from the account menu to see it. You can drag to rotate, pinch or scroll to zoom, and turn the card over.

- The first-connection drop is limited to 3,000 recipients.
- Each sign-in account and each X account can receive it once.
- The card stays in your collection if you later disconnect X.
- Without a connected X account, My cards offers to connect one in your account settings.
