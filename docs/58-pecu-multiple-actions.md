# Pecu requests with multiple actions

Pecu completes all actions in an explicit request or an accepted concrete plan. With YOLO on, it can persist and execute up to 16 sequential transaction proposals in one message. It waits for a verified successful receipt before preparing the next proposal. A pending receipt, revert, missing decision, linked-wallet signature or mandatory generic-contract confirmation stops the sequence.

Accepting a clarification no longer disables YOLO for that turn. Accepting a plan authorizes the actions and choices it states. A funding-token preference alone still leaves the amount undecided. Regenerated answers remain preview-only, and enabling YOLO never executes old previews.

Each proposal keeps its own saved calls, confirmation code, receipt checks and recovery behavior. Later proposals use the existing numbered source-event format. Repeated tool requests for the same action and parameters return its saved result instead of submitting again. Replayed incoming events return the saved reply.

Web history and Android's shared web reply contract show the latest proposal, with every completed transaction link in the response text. X Chat receives the same response text and confirmation or recovery codes. Scheduled automations retain their separately approved spending allowance and per-run checks. BeeGreat's web, Expo, CLI and iMessage clients use a different agent and are unaffected. OpenRouter and ChatGPT both use the shared OpenCode runtime and Pecu action handlers.

The reported thread was `898d6ae1`. The accepted consolidation was forced into a preview by the clarification handler, then the user's repeated request executed only the unstake because the regular-message runtime permitted one proposal. The agent instructions repeated that limit. This change removes both causes without executing the remaining steps of that historical conversation.

Verification: `bun scripts/verify-agent-actions.ts` drives the actual message, clarification, intent persistence, execution and replay paths with fixture wallet and receipt services. It checks several actions, YOLO off, pending/reverted receipts, regeneration and duplicate suppression. These fixtures do not prove a live signed consolidation. No user funds move during verification.
