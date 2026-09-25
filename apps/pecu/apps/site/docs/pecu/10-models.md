---
title: AI models
description: How Pecu uses your own ChatGPT subscription, what happens without one, and what the request classifier sees.
group: Reference
---

Pecu's AI replies run on OpenAI models. Commands and the plain-words shortcuts never use the AI, so your wallet keeps working when AI replies are unavailable.

## Models

| Model | Reasoning | Used for |
| --- | --- | --- |
| GPT-6 Sol | Medium | Every AI request when the classifier is off. With it on, requests it does not route, answers to Pecu's questions and web retries. |
| GPT-6 Luna | Low | Requests the classifier routes as an explanation or as a tool request. |

The [request classifier](#request-classifier) section explains the routing.

## Your ChatGPT connection

Each account connects its own ChatGPT subscription. X Chat and the web app share the connection for your X account. A web account signed in without X has its own.

1. Sign in at pecu.app/agent with the account you use with Pecu.
2. Open ChatGPT connection from the account menu, or go to pecu.app/agent#chatgpt.
3. Press Connect ChatGPT. Pecu shows a sign-in code with a copy button.
4. Press Continue with ChatGPT, sign in on OpenAI's page and enter the code.
5. The panel checks every five seconds and updates when sign-in finishes.

- If the code expires, the panel says `Sign-in expired. Connect ChatGPT to try again.` Press Connect ChatGPT again.
- Cancel sign-in stops a sign-in that is in progress.
- Disconnect ChatGPT asks you to confirm first. Your wallet, wallet commands and chat history stay.
- You sign in on OpenAI's own page. Your ChatGPT password never passes through Pecu, and the saved credential is never sent to your browser.

The panel shows whether you are connected and any active usage limit. It does not show your plan or remaining quota.

## Without a connection

What you see depends on whether Pecu's built-in model is available.

- Without it, AI requests get `Connect your ChatGPT subscription to use AI chat: https://pecu.app/agent#chatgpt. Wallet commands still work.` In the web app the connection panel opens. Once you finish connecting there, Pecu answers the message that asked for it, so you do not need to retype it.
- With it, Pecu answers with the same models through OpenRouter, paid for by Pecu. The reply looks the same, and the connection panel says `AI replies currently use Pecu's built-in model.`

Built-in model requests are pinned to OpenAI's own endpoint on OpenRouter, so they are not routed to other providers.

## Usage limits

When your ChatGPT plan reaches its usage limit, Pecu stops sending requests to ChatGPT until the reset time, for at most 24 hours. If ChatGPT gives no reset time, Pecu waits one minute before trying again.

- Without the built-in model, the reply says when the limit resets, for example `It resets in about 3 hours (14:00 UTC).`, and notes that `/balance`, `/stocks` and `/quote` still work.
- With the built-in model, replies use it until your limit resets.
- If your ChatGPT plan does not include Codex usage, AI replies are only available through the built-in model.
- If a ChatGPT request fails partway with a provider error, Pecu retries it once on the built-in model when that is available.

## What works without AI

- Every slash command, such as `/balance`, `/swap` and `/confirm`.
- The [plain-words shortcuts](/docs/pecu/commands#plain-words-shortcuts).
- Replying `confirm` or `cancel` to a preview.

## Request classifier

When classification is enabled, a message that is not a command or shortcut goes to a TypeSafe classifier before the AI. The classifier picks a route.

| Route | What happens |
| --- | --- |
| Wallet address, balance, stock holdings, Aerodrome positions, deposit status or help | Pecu runs the matching read without the AI. |
| General explanation | GPT-6 Luna answers without tools. It cannot read your account or build a transaction, but it can ask you a question. |
| Needs tools or live data | GPT-6 Luna answers with the normal tools, previews, confirmation rules and YOLO setting. |

- The classifier receives only the text of your current message. It does not get your account ID, wallet, credentials or earlier messages.
- A route is used only when the classifier is at least 90% confident. Low confidence, errors, a response slower than 2.5 seconds and messages over 8,000 characters go to GPT-6 Sol with tools.
- The routes that skip the AI are all reads, so the classifier cannot start a transaction.
- Answers to Pecu's questions and web retries skip the classifier.
- In the same request, the classifier can select wallet/Safe, DeFi/stocks, Polymarket, analytics or funding tools. Uncertain selections keep the full catalog. The agent can expand a selected catalog when it needs another capability; this never grants transaction approval.

## What the model receives

Each turn, the model gets your message, whether YOLO is on in this chat and the earlier conversation in the same chat. A retry starts a fresh session with the earlier visible messages and without the answer you discarded. Your wallet address comes from Pecu's tools, not from anything you type.

For a general explanation, Pecu gives the model only the ability to ask you a clarifying question. Account and transaction tools return when a later request needs them. This also applies when Pecu switches from ChatGPT to its built-in model during an explanation.
