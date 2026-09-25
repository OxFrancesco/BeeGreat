# Reliability

## Sub-features

Slow commands, SSE keep-alives, incremental replies, failed submissions, stable-ID retries, page reloads, thread isolation, startup and inference memory.

## How to get to it (user POV)

Use `/agent` and the embedded Stocks chat. Open an existing long thread and a fresh thread.

## Driving it with T3

Record a slow request from submit through persisted reply. Verify keep-alive frames without invented paragraphs, and incremental assistant text when available. Simulate transport loss only in an isolated test, preserve the unsent text and retry with the original ID. Reload the live page to verify saved replies and no duplicate action. Run repeated allowance reads and representative successful natural requests; report sample count, route, cold/warm state and p50/p95 only for comparable successful production turns.

## Gotchas

Build, fixture, local provider probe and production UI are separate proof levels. One successful turn does not prove memory stability. Do not count failed data retrieval as a latency improvement. Capture sanitized errors only.
