# Pecu durable actions

Accepted web and Android chat requests are recorded in `pecu_turn_queue` before agent work starts. The server owns the work; the client observes it. The queue survives a Durable Object restart and is swept at startup and by the existing one-minute cron. Retries retain the request ID. OpenCode prompt admission uses a stable ID per event, session and provider path. A queued request reserves its thread until completion or a terminal recovery failure.

`runState` distinguishes running, recovering, completed and failed requests. Web and Android refresh unfinished work after reconnecting. Requests that never reached the server still require resuming the saved request. A disconnect is not a cancellation. Existing submitted transaction IDs and receipts are reconciled before further work; recovery does not submit an already recorded transaction again.

Automation occurrences keep a checkpoint containing their continuation number, intent sources, confirmation codes and cumulative spending. A preview leaves the occurrence awaiting approval. After confirmation, the next sweep continues that same occurrence with the completed steps in context. Failed, cancelled or expired steps stop it. Pausing blocks continuation; deleting prevents further steps. Up to 16 sequential proposals can belong to a run. Legacy interrupted runs without a checkpoint stop explicitly rather than guess which actions happened.

Web and native Android expose allowance scopes, amount and duration even when the model never requested an allowance. The user must approve. YOLO does not approve an allowance or an already waiting preview. X users can ask Pecu to request an allowance, then approve it with `/tasks allow`. Text channels retain confirmation codes and outcome summaries. Bee's Expo, CLI and iMessage clients do not host this standalone Pecu flow.

## Verification

- The workerd integration interrupts a real Durable Object with an accepted WebAgent request, disconnects the client, reconstructs the object and verifies completion with one recorded fixture effect. It also verifies duplicate delivery keeps one turn. The fixture has no signing or real funds.
- The automation integration uses the actual runner, agent and transaction store with a simulated wallet. It confirms a waiting step, reconstructs the runner and verifies the remaining allowance survives continuation without duplicate submissions.
- Web controls are exercised through a local component fixture in `apps/pecu/apps/stocks/durability-check`. Android Compose tests capture the native screen. These fixtures are UI evidence, not production transaction evidence.

Deployment targets are the main Pecu Worker, its web Worker and the public documentation Worker. The unchanged Codex proxy is deployed before the main Worker using the existing container image. Native Android ships as an updated APK; a web deployment cannot update an installed APK.
