# Transactions

## Sub-features

Swaps, sends, approvals, revokes, generic calls, code/button confirmations, YOLO boundaries, duplicates, cancellation and expiration.

## How to get to it (user POV)

Use the chat composer. The resulting card has a named Confirm button, Cancel and Confirmation code disclosure.

## Driving it with T3

Use the exact authorized transaction checklist. Compare card amounts, symbols, destination/spender and minimum received to the request. Confirm only when the operating agent is permitted to execute that action. Otherwise record unsigned-preview coverage and leave execution blocked for the user. After execution, independently verify Base receipt success and state, then repeat the same confirmation to prove no second submission. Cancel a fresh preview and verify its code cannot execute. Leave another preview beyond its TTL and verify expiry. Generic contract calls must retain confirmation with YOLO on.

## Gotchas

Each code is scoped to sender and thread. Retry after a network failure must keep the same request ID. A warning or insufficient balance is not a successful lifecycle. Do not erase warnings from the report.
