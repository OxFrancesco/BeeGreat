# Pecu chat UX

Normal replies show human token amounts and useful controls. Swap previews include expected output, minimum received, fee availability, and confirm/cancel commands. Wallet and balance replies omit repeated account metadata. Help omits framework names. Service JSON errors no longer spill into normal replies.

`b/verbose` or `/verbose` returns the latest stored technical result for the verified sender and conversation. `b/verbose 2` reads the next page. It does not rerun tools or enable JSON on future replies. Details survive SQLite and Durable Object restarts.

## Web confirmation flow

The web preview card's confirm and cancel buttons send the same `/confirm CODE` and `/cancel CODE` turns the X chat uses. The web hides those command bubbles and shows the outcome in the card: status, receipt links, and failure detail all live on the original preview. Replies that carry information the card does not, like an unknown code or a duplicate confirmation, stay visible. X chat is unchanged.

## Web streaming

Model replies on `/agent` and `/stocks` grow as text arrives. The first non-empty text fragment is sent immediately; subsequent updates are coalesced over 50 ms. One streaming Markdown block preserves paragraphs, lists, links, tables and code fences as they develop. Its entrance animation runs once, and reduced-motion preferences remain respected. There is no artificial typing delay.

The client opts in with `Accept: text/event-stream; mode=live`. The server sends whole-reply `paragraph` snapshots with `replace: true`, then `complete` or `error`. Without that opt-in it retains the original complete-paragraph protocol. Without an SSE Accept header it returns JSON. This allows the frontend and Worker to roll out independently and keeps already-open tabs working.

`OpenCodeHarness` follows `session.text.delta` and `session.text.ended` events. Model completion can precede delivery of the last event, so the final stored assistant message reconciles the stream before it closes. The per-user inference object drains pending RPC updates before returning. Timers and subscriptions stop when the turn ends. Closing the browser does not abort the turn; the Durable Object retains it with `waitUntil` and saves the final reply.

The final saved reply still takes precedence over draft text, including an `ask_user` question, transaction preview or error. Deterministic commands and natural-language requests routed to wallet, balance or similar commands return in one piece. X Chat remains one message per reply. Provider wait and tool execution can still delay the first text fragment; live rendering does not invent text while they run.

## Validation

TypeScript, 145 tests, and all four Worker dry-run builds passed. Tests cover exact dust amounts, human token balances, private verbose output, pagination, no additional transaction execution, and persistence in Workerd.

Existing production passed live wallet, balance, natural-language quote, and unsigned swap-preview checks. The test wallet received 0.002 ETH. An unsigned 0.000001 ETH to USDC preview was created. No transaction was confirmed or broadcast by this test.

## Remaining work

The new chat UX is not deployed. Automatic approval review rejected creating the production EVM dependency because deployment was not specifically authorized by the UX request. The bot's current production version remains unchanged.

After approval, configure the private EVM service with a Base RPC endpoint, deploy it and the updated bot, then verify normal replies and `b/verbose` in X. The swap preview does not include a complete smart-wallet network-fee estimate. Funded execution and receipt/balance verification remain pending.
