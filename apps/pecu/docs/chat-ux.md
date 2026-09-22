# Pecu chat UX

Normal replies show human token amounts and useful controls. Swap previews include expected output, minimum received, fee availability, and confirm/cancel commands. Wallet and balance replies omit repeated account metadata. Help omits framework names. Service JSON errors no longer spill into normal replies.

`b/verbose` or `/verbose` returns the latest stored technical result for the verified sender and conversation. `b/verbose 2` reads the next page. It does not rerun tools or enable JSON on future replies. Details survive SQLite and Durable Object restarts.

## Web confirmation flow

The web preview card's confirm and cancel buttons send the same `/confirm CODE` and `/cancel CODE` turns the X chat uses. The web hides those command bubbles and shows the outcome in the card: status, receipt links, and failure detail all live on the original preview. Replies that carry information the card does not, like an unknown code or a duplicate confirmation, stay visible. X chat is unchanged.

## Web streaming

Model replies on `/agent` and `/stocks` arrive paragraph by paragraph. The turn request sends `Accept: text/event-stream`; the Durable Object answers with server-sent events (`paragraph`, then `complete` or `error`) and keeps the turn alive with `waitUntil`, so closing the tab does not abort the model or lock the thread. Inside the object, `OpenCodeHarness` follows OpenCode's live `session.text.delta` and `session.text.ended` events for the turn's session, splits text at blank lines (never inside a code fence), and forwards each finished paragraph through the `InferenceTools` RPC bridge. The client shows those paragraphs under the thinking mascot and replaces them with the stored reply once `/state` reloads, because the final text can differ from the model's words: an `ask_user` question, a preview card, or an error message wins.

Paragraphs, not tokens, so the provisional block is stable markdown and the swap to the stored reply does not flicker. Deterministic commands (`/balance`, `/wallet`, `/help`) never touch the model and still arrive in one piece. X chat is one message per reply and is unchanged. A backend or client from before this change still works: without the `Accept` header the object answers with JSON as before, and a client that receives JSON simply shows nothing until the reload.

## Validation

TypeScript, 145 tests, and all four Worker dry-run builds passed. Tests cover exact dust amounts, human token balances, private verbose output, pagination, no additional transaction execution, and persistence in Workerd.

Existing production passed live wallet, balance, natural-language quote, and unsigned swap-preview checks. The test wallet received 0.002 ETH. An unsigned 0.000001 ETH to USDC preview was created. No transaction was confirmed or broadcast by this test.

## Remaining work

The new chat UX is not deployed. Automatic approval review rejected creating the production EVM dependency because deployment was not specifically authorized by the UX request. The bot's current production version remains unchanged.

After approval, configure the private EVM service with a Base RPC endpoint, deploy it and the updated bot, then verify normal replies and `b/verbose` in X. The swap preview does not include a complete smart-wallet network-fee estimate. Funded execution and receipt/balance verification remain pending.
