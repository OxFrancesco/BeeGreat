# iMessage Web3 session audit

- Date: 2026-08-13
- Session inspected: Francesco Oddo's latest canonical Flue turn in the iMessage conversation, 2026-08-12 22:17–22:21 UTC
- Scope: read-only research; no production code or external state changed
- Evidence: current repository source plus read-only Convex `data` queries against the configured development deployment

## Verdict

The core authorization boundary is sound, but the end-to-end iMessage experience is not yet smooth enough for multi-step Web3 work.

The latest inspected turn was “Claim them pls!”. The emissions claim succeeded on-chain, but the overall request did not finish: claiming LP fees required a user choice about unstaking and restaking, and iMessage silently dropped that question. The user instead received three conflicting text stages accumulated in one assistant message, ending with a generic “Web3 action complete” line containing a raw pool contract address. No later Web3 action was created for the fees.

This is primarily a channel-projection defect, compounded by an orchestration lifecycle that lets one assistant envelope accumulate tool work, settlement continuation, a completion audit, and multiple text blocks. The only blocking user decision was generated correctly by Bee but disappeared at the iMessage boundary.

The first fix is full BeeUI `question` parity in iMessage, including selectable numbered options and reply parsing. Then the bridge should project only the latest coherent user-facing stage from an accumulated Flue envelope, scrub raw pool/token addresses from ordinary copy, and deliver terminal settlement through a durable channel outbox. Power-up loading should also preserve the last known-good enabled definitions during transient Convex failures.

## How the latest session was located

The iMessage sender is not represented by a handle in the transcript. The bridge normalizes the inbound phone/email address, resolves it through the protected identity broker, and obtains a Clerk user id ([bridge identity client](../../apps/imessage-bridge/src/identity.ts#L30-L85), [Convex address resolution](../../packages/backend/convex/imessage.ts#L81-L93)). Convex stores normalized sender-to-user links in `imessageConnections`; link-session tokens are short-lived and only their hashes are stored ([schema](../../packages/backend/convex/schema.ts#L622-L649)).

For this audit, a read-only `publicProfiles` query identified the configured profile as `Francesco Oddo` / `francesco-oddo`. The profile table owns the handle/display-name fields ([schema](../../packages/backend/convex/schema.ts#L327-L345)). A read-only `chatThreads` query selected the newest row for that user with `source: "imessage"`: thread `1785741510310`, titled “How much funds do I have?”. The source marker and source-time index are part of the thread contract ([schema](../../packages/backend/convex/schema.ts#L214-L233)).

The Convex message mirror initially made the August 3 pool-creation sequence appear to be the latest session. That was wrong. Canonical Flue history for conversation `user_…~1785741510310` contained a newer August 12 turn that had not reached the Convex mirror. This is direct observed evidence that `chatThreads.updatedAt` and `chatMessages` cannot currently identify the latest iMessage activity reliably. The durable action for the newer turn was then verified in `web3Actions`: it was YOLO-confirmed and executed, with a Base transaction result bound to the same conversation.

The cause is visible in source: the bridge itself does not mirror Flue history into Convex after a turn. Web and mobile enqueue their observed Flue messages into `chat.syncMessages` ([web sync](../../apps/web/src/features/bee/use-convex-chat.ts#L53-L84), [mobile sync](../../apps/mobile/src/hooks/use-convex-chat.ts#L52-L89)), and Convex then validates and upserts those envelopes ([sync mutation](../../packages/backend/convex/chat.ts#L528-L590)). An iMessage-only turn that no signed-in app later observes is therefore not guaranteed to be present in `chatMessages`. Flue history is the primary complete record today; Convex is an opportunistic mirror for this channel.

Recommended audit retrieval order:

1. Resolve the requested public handle to `userId` through a narrowly scoped internal/admin query.
2. Select the latest `chatThreads` row for `userId + source=imessage`.
3. Fetch canonical Flue history from `<userId>~<threadId>`; the bridge uses exactly that conversation-id convention ([bridge client](../../apps/imessage-bridge/src/index.ts#L97-L115)).
4. Join every referenced Web3 action to `web3Actions` for authoritative status and results.
5. Use `chatMessages` as the cross-device mirror, not as proof that the Flue transcript is complete.

A small read-only audit command should encapsulate this path. Direct table dumps are cumbersome, easy to overexpose, and do not reconcile Flue and Convex automatically.

## What happened in the latest session

| UTC          | Observed outcome                                                                                                               | Elapsed from request |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------ | -------------------: |
| 22:17:43     | User: “Claim them pls!”                                                                                                        |                    — |
| 22:17:47     | First assistant entry starts; the eventual envelope accumulates three `task` calls, one `question` call, and three text blocks |                  4 s |
| 22:19:05     | Emissions-claim action is created and YOLO-confirmed                                                                           |             1 m 22 s |
| 22:19:10.956 | Executed settlement signal enters the same Flue conversation                                                                   |             1 m 28 s |
| 22:21:21.742 | Completion-audit signal arrives after the multi-tool response still has unfinished fee work                                    |             3 m 39 s |

The canonical envelope contained these materially different stages:

1. Emissions claim “started automatically,” with LP-fee work promised as a follow-up.
2. Emissions “claimed successfully,” followed by the discovery that fees require unstaking.
3. A structured question asking the user to choose “unstake, claim, restake” or “leave staked.”
4. A later canonical “Web3 action complete” projection containing the raw pool address.

Replaying the current iMessage projector reproduced stages 1, 2, and 4, but not stage 3. This left the delivered result contradictory—both promising the fee follow-up and explaining it could not continue—while omitting the only input that could unblock it. A read-only action query confirmed that no fee-claim action exists after the emissions claim.

The direct observations above establish the missing question and unfinished fee work. The later “completion gate” is expected from policy whenever there are multiple task calls or a Web3 settlement ([completion audit](../../packages/agent/src/shared/completion-policy.ts#L69-L91)); whether its late arrival is itself harmful is an inference. The concrete defect is that the question it triggered never survived channel rendering.

## Supporting historical session

The same conversation's older August 3 pool-creation sequence showed two additional efficiency problems: failed Aerodrome attempts held the iMessage turn open for 4 m 38 s and 1 m 39 s, while a later successful swap/deposit returned “in progress” before terminal settlement replies appeared internally. It also showed an unexplained reported ETH balance discontinuity after a failed action. These older observations support the asynchronous/outbox and post-failure balance recommendations below, but they are not the latest session.

## Current execution and approval flow

The intended safety model is two-phase:

1. Bee delegates all money movement to the Web3 specialist, which prepares an action id and exact summary. Bee may not execute from free-form chat ([Bee policy](../../packages/agent/src/agents/bee.md#L201-L211), [specialist policy](../../packages/agent/src/shared/powerups/web3.ts#L79-L103)).
2. Convex stores the exact payload with a ten-minute TTL. Smart-wallet actions await app/iMessage confirmation; linked-EOA actions remain app-only. YOLO may auto-confirm smart-wallet actions but never EOA actions ([action creation](../../packages/backend/convex/web3Actions.ts#L142-L218)).
3. iMessage extracts the latest rendered confirmation from Flue history, re-reads the canonical action, and only treats an exact yes/no reply as a decision ([history lookup](../../apps/imessage-bridge/src/index.ts#L189-L204), [decision path](../../apps/imessage-bridge/src/index.ts#L545-L579)).
4. Convex verifies user ownership, exact summary, entitlement, expiry, and pending status before scheduling execution; it explicitly rejects linked-EOA plans from this path ([confirmation gate](../../packages/backend/convex/web3Actions.ts#L259-L292)).
5. Sugar smart-wallet execution rebuilds the semantic intent, atomically batches approvals with the action, persists the Crossmint operation, and reconciles it after worker restarts ([execution](../../packages/backend/convex/web3.ts#L992-L1053), [durable step state](../../packages/backend/convex/web3Actions.ts#L557-L635), [reconciliation](../../packages/backend/convex/web3.ts#L1171-L1238)).
6. Socket actions transition through `confirmed → in_progress → executed/failed/refunded`, with scheduler-driven destination polling ([Socket lifecycle](../../packages/backend/convex/web3Actions.ts#L671-L755)). Terminal actions emit a best-effort signal to the originating Flue conversation ([notification](../../packages/backend/convex/web3Notify.ts#L45-L114), [agent dispatch](../../packages/agent/src/app.ts#L376-L451)).

This is a good security foundation: action ids are scoped, summaries are bound, stale confirmations expire, ordinary model text cannot authorize spending, and EOA keys/signatures remain client-side.

## Findings and recommendations

### P0 — iMessage drops the blocking `question` component

The latest session's decisive defect is fully reproducible in source. Bee's question tool returns a structured `question` component and instructs the coordinator to render it, then stop ([question tool](../../packages/agent/src/shared/question-tool.ts#L53-L68)). Web and CLI both parse/render that component ([web question card](../../apps/web/src/features/bee/generated-ui.tsx#L108-L210), [CLI parser](../../apps/cli/src/reply.ts#L50-L91)).

iMessage's `BeeComponent` union has no `question` variant, `parseComponent` has no question branch, and `renderComponent` has no question case ([component contract](../../apps/imessage-bridge/src/bee-response.ts#L32-L60), [parser terminal branches](../../apps/imessage-bridge/src/bee-response.ts#L235-L267), [renderer](../../apps/imessage-bridge/src/bee-response.ts#L287-L388)). Worse, parsing is all-or-nothing for a BeeUI block: if any component is unrecognized, the entire block becomes empty. In the inspected turn this silently discarded “unstake, claim, restake” versus “leave staked,” so no fee action could follow.

Add the same bounded question schema used by CLI, render numbered options plus “or type your own answer,” persist the pending question in bridge state/history, and turn a numeric reply into the canonical natural-language answer. Add a cross-channel fixture test that projects every BeeUI component through web, mobile, CLI, and iMessage; unsupported components must degrade visibly, never disappear.

### P0 — accumulated assistant stages produce a contradictory final reply

Flue deliberately accumulates every agent step into one assistant message ([CLI handling note](../../apps/cli/src/session.ts#L211-L219)). The latest envelope accumulated the initial plan, emissions settlement, fee-path investigation, Sol escalation, the blocking question, completion audit, and three text blocks. iMessage's extractor concatenates every text part from the latest assistant envelope ([latest projection](../../apps/imessage-bridge/src/bee-response.ts#L485-L496)); it has no concept of superseded stages or a final blocking component.

Project the latest coherent stage, not all historical text blocks. A structured response reducer should prefer, in order: blocking question; current pending/terminal Web3 state; final text. Earlier “started” copy should not remain beside later completion/failure copy. The reducer should operate on canonical parts rather than regexing the final concatenated Markdown.

The final canonical Web3 summary also exposed a raw pool address. `scrubIdentifiers` removes internal record ids but intentionally has no EVM-address rule ([scrubber](../../packages/tool-presentation/src/scrub-identifiers.ts#L1-L28)). Wallet and pool addresses are sometimes useful, so do not delete them globally; channel copy should replace them with a human label (“your Aerodrome ETH/USDC pool”) and attach an explorer link only when the address is material.

### P0 — settlement does not reach iMessage proactively

Convex's terminal notification is explicitly best-effort and targets the agent conversation, not Spectrum/iMessage ([notification contract](../../packages/backend/convex/web3Notify.ts#L6-L14)). The bridge only calls `space.send` while iterating inbound messages ([inbound loop](../../apps/imessage-bridge/src/index.ts#L420-L450), [reply send/finalize](../../apps/imessage-bridge/src/index.ts#L621-L628)). In the older August 3 sequence, “in progress” was delivered, then final success existed only internally. The latest turn happened to remain open long enough to absorb settlement, but that also contributed to its multi-minute, multi-stage envelope; it is not a reliable delivery mechanism.

Add a Convex-backed channel outbox keyed by `(channel, actionId, terminalStatus)` and bound to the originating channel/thread. On terminal transition, enqueue one user-safe message; the bridge claims, sends, and records delivery idempotently. Retry transient Spectrum errors. Store no phone number in the action row—resolve the current linked address at delivery time. The outbox should cover failed/refunded/expired outcomes too.

### P0 — linked-wallet actions settle at submission, not receipt

The WalletConnect loop calls `onSubmitted` immediately after `eth_sendTransaction`, before waiting for a successful receipt ([wallet loop](../../packages/wallet-connect/src/index.ts#L183-L200)). `recordEoaSubmission` marks the final action `executed` and emits settlement at that callback ([submission mutation](../../packages/backend/convex/web3Actions.ts#L351-L399)). If receipt polling then sees a revert, `reportEoaFailure` ignores the row because it is already terminal ([failure guard](../../packages/backend/convex/web3Actions.ts#L403-L423)). A continuation can therefore advance against stale balances.

Introduce `submitted`/`in_progress` state for the hash, record receipt success separately, and emit settlement only after a successful receipt. This applies to web and mobile linked-wallet execution, not just iMessage, but it can corrupt any later cross-channel status explanation.

### P1 — make multi-step execution asynchronous and deterministic

The policies already say to prepare one step, bind the remainder in a private continuation, end the turn, and resume from the settled event using actual balances ([Bee policy](../../packages/agent/src/agents/bee.md#L212-L236), [liquidity playbook](../../packages/agent/src/shared/powerups/web3-skills.ts#L59-L64)). The inspected turns instead kept the user waiting while a specialist attempted multiple stages, including almost five minutes on the first failure.

For “swap half, then deposit”:

- Validate wallet, amount, gas reserve, token pair, pool type, and price impact once.
- Prepare/auto-confirm the swap and immediately return a deterministic stage message with an ETA.
- On settled success, re-read exact USDC/ETH balances and prepare the deposit from the private continuation.
- Deliver each material stage and the terminal result through the channel outbox.
- On failure, re-read balances before saying funds are unchanged.

This removes long held-open iMessage turns and makes retries/restarts natural.

### P1 — stop asking for impossible or redundant confirmation

iMessage's pending projection ignores `action.kind` and always renders “Reply yes” ([projection](../../apps/imessage-bridge/src/bee-response.ts#L442-L453)), even though Convex rejects `execute_eoa_plan` from iMessage. It should instead say “Open BeeGreat to connect this wallet and sign,” include a deep link, and not arm yes/no.

For smart-wallet actions, an exact iMessage `yes` currently performs history read → action read → confirmation → a second full Bee turn that merely checks newly scheduled status ([decision path](../../apps/imessage-bridge/src/index.ts#L551-L579)). Return a deterministic “Authorized; execution started” acknowledgement from the broker result, then use terminal delivery. YOLO actions should never ask for confirmation; the bridge already re-reads canonical state before rendering ([send projection](../../apps/imessage-bridge/src/index.ts#L319-L339)).

### P1 — share one status-aware text renderer

Web and mobile subscribe to canonical action status, distinguish YOLO from EOA, show live progress/error/refund, and expose the final explorer link ([web card](../../apps/web/src/features/bee/generated-ui.tsx#L444-L506), [mobile card](../../apps/mobile/src/components/agent/generated-ui.tsx#L816-L1015)). Convex already exposes kind, timing, result, Socket progress, and errors ([public action view](../../packages/backend/convex/web3Actions.ts#L61-L90)).

iMessage drops timing, Socket detail, and explorer links; CLI blindly renders every confirm as “reply yes/no” ([iMessage projection](../../apps/imessage-bridge/src/bee-response.ts#L456-L482), [CLI projection](../../apps/cli/src/reply.ts#L163-L178)). Move a canonical plain-text Web3 projector into `packages/tool-presentation` and use it in iMessage and CLI. Render explicit stages: prepared, auto-approved, submitted, origin confirmed/destination pending, completed with link, failed with short safe reason, refunded, cancelled, expired, and “app signature required.”

### P1 — preserve enabled power-ups across transient load failures

Canonical history also showed Web3 availability flapping inside the same continuing work: Bee said it could not access the wallet specialist, then a later system update restored it. That is observed conversation behavior. A plausible source-level cause—not proven from the transcript alone—is the fail-open loader: any Convex query error returns an empty power-up array ([loader](../../packages/agent/src/shared/powerups/index.ts#L45-L70)), and `warmSnapshot` unconditionally overwrites the user's snapshot with that result ([snapshot write](../../packages/agent/src/agents/bee.ts#L208-L274)). The next render then builds specialists from the overwritten list ([specialist binding](../../packages/agent/src/agents/bee.ts#L432-L450)).

Return a tagged load result (`success` versus `unavailable`) rather than conflating failure with “the user disabled everything.” On transient failure, keep the last known-good power-up definitions for a short TTL and re-check entitlement at each tool call as today. Only a successful empty response should remove Web3. Record snapshot generation/source in observability so future flaps can be attributed rather than inferred.

### P2 — reduce progress-message noise

The bridge sends both start and finish copy for each tool and allows up to six progress messages, plus heartbeats at four and eighteen seconds ([progress projector](../../apps/imessage-bridge/src/progress.ts#L4-L84)). Coalesce tool pairs that finish within roughly two seconds, prefer one high-level stage per specialist, and retain heartbeats only when no material stage has been sent. For Web3, status transitions matter more than low-level tool lifecycle.

### P2 — make Socket submission as durable as Sugar

Socket currently sends approval and route transactions separately before recording submission ([Socket execution](../../packages/backend/convex/web3.ts#L1109-L1153)). Sugar already atomically batches approvals plus the final action and persists the operation before approval. Reuse the durable batch/reconciliation path for Socket where Crossmint supports it; otherwise persist each prepared operation before submission and reconcile it after restart.

## Surface decisions

| Surface  | Current behavior                                                               | Required decision                                                                                            |
| -------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| iMessage | Exact yes/no for smart wallet; plain text; no proactive final delivery         | Durable outbound settlement, EOA deep link, status/ETA/tx-link text                                          |
| Web      | Reactive canonical card with buttons, YOLO/EOA distinction, progress and links | Fix EOA receipt settlement; otherwise preserve                                                               |
| Mobile   | Same reactive lifecycle plus WalletConnect signing                             | Fix EOA receipt settlement; otherwise preserve                                                               |
| CLI      | Plain text and pending confirmation state, but generic yes/no rendering        | Reuse shared projector; reconcile canonical status; define whether CLI confirmation is supported or app-only |
| Voice    | Uses the same Bee contract but cannot safely sign an EOA                       | Speak the exact summary/status; route authorization/signature to app, and announce terminal result once      |

The wire contract remains `web3Actions`; do not fork action shapes per client. Channel presentation should be adapted from the canonical view, with machine ids kept out of user-visible copy.

## Suggested implementation order

1. Add iMessage `question` parsing/rendering/reply handling and a parity fixture covering every BeeUI component.
2. Replace concatenated text projection with a structured latest-stage reducer; humanize pool/token addresses.
3. Preserve last known-good power-ups on transient load failure and instrument snapshot generations.
4. Fix EOA receipt settlement and add regression tests for a submitted transaction that later reverts.
5. Add the durable terminal-delivery outbox and iMessage sender, including dedupe/retry tests.
6. Replace the post-yes LLM turn with deterministic acknowledgement and continuation-driven stages.
7. Build the shared text-channel Web3 projector and adopt it in iMessage and CLI.
8. Mirror iMessage Flue transcripts into Convex server-side so auditing and cross-device history do not depend on opening web/mobile.
9. Batch or durably reconcile Socket approval + route submission.
10. Add observability for per-stage latency, action state duration, delivery lag, retries, power-up load outcome, post-failure balance delta, and final user-visible status.

Success criteria: a user can request a multi-step pool/claim operation in iMessage, receive any required choice instead of losing it, get one coherent current-stage response, leave the chat, and later receive exactly one terminal success/failure message with a safe explanation and transaction link. The same canonical state appears on web, mobile, CLI, and voice; transient configuration reads do not remove an enabled specialist; and no continuation advances before receipt-confirmed settlement.
