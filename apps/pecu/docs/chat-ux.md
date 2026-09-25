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

The 25 September 2026 streaming release passed 467 Pecu tests and 69 Stocks/frontend tests, both TypeScript checks, scoped lint, the Worker build and the Stocks production build. Regression coverage reproduces model completion before the final text event, delayed RPC delivery, old-client streaming, partial Markdown, thread switching and browser disconnects.

Production checks in the signed-in Pecu thread observed 14 visible updates on desktop. All four paragraphs arrived before completion and the final streamed text matched the saved answer. A 390px responsive browser view showed 16 visible updates, bold text and list formatting without horizontal overflow. This was a browser layout check, not a physical-device test. No transaction was prepared or executed.

The release is deployed to the Pecu Worker and shared Agent/Stocks frontend. These few live samples verify incremental delivery and final-text integrity; they are not a production latency benchmark. Provider wait, tool execution and deterministic one-piece command replies remain separate from text rendering.
