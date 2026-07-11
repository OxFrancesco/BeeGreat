# 05 – Voice Agent & Memory

> **Memory decision update (2026-07-10):** FRA-423 selects Convex as the canonical
> memory store. The SuperMemory section below is retained as the historical
> 2026-07-04 decision rather than silently rewritten. See
> [09 – FRA-423 Memory Architecture](09-fra-423-memory-architecture.md).

## Concept

The agent **is** the home screen. Voice input first; the UI is spawned by the agent in response to what you ask.

### Selected MVP interaction (FRA-459)

1. A first-time user opens an empty Hive and speaks an intended outcome (text is always available).
2. Bee asks at most one clarifying question when the outcome is too vague.
3. Bee returns one editable preview containing a Goal, Project, Task, and time-boxed Highlight.
4. Explicit confirmation persists the complete plan atomically. Cancel creates nothing; retry never duplicates the plan.
5. The user completes the highlighted Task by voice or tap.
6. The Highlight clears and the GolieBee/Hive immediately react with Goal-attributed Honey and Honeycomb Score progress.

Cross-device time questions, charts, broad agent actions, and open-ended generated UI remain part of the longer-term concept but are not required to prove this loop.

### Generative UI

- Agent responses are structured (JSON UI spec), rendered natively by each client (Expo + TanStack web from a shared component vocabulary)
- The first vocabulary must support an editable plan preview, confirmation/cancel, Task completion, Highlight state, and Hive feedback. Existing text/metric/chart/task components remain useful evidence but are not the proof boundary.
- User-facing writes require explicit confirmation; the backend owns idempotency and atomicity.
- Malformed generated UI falls back to an accessible textual preview without losing or creating work.

## The agent knows the user

Requirement from braindump: the agent "needs to know everything about the user and what their final goal is and how to help him with the goal."

- User profile: goals (and the _final_ goal behind them), habits, schedule, integrations
- Context includes time-tracking data, task state, honey/score history, journal

## Memory layer (historical 2026-07-04 decision: SuperMemory)

- **All threads stored** — every question and answer persisted (Convex)
- Long-term semantic memory: **SuperMemory** (starting choice; swap only if it underdelivers on per-user isolation, latency, or cost)
- Memory writes: after each session, distill facts/preferences/goal updates into memory
- Memory reads: retrieved at session start + on-demand during tool calls
- Flue sessions/durable streams give thread continuity; SuperMemory covers cross-session knowledge

## Pipeline (decided)

```
mic → ElevenLabs STT
    → Flue agent (defineAgent) on Cloudflare Workers (Durable Object per user)
    → tools: Convex queries/mutations and canonical Convex memory
    → LLM via OpenRouter (GPT 5.5 low for simple, Fable 5 for orchestration)
    → response: text + ElevenLabs TTS + UI spec → client renders
```

## Cost & guardrails

- Voice minutes (ElevenLabs) and LLM calls are the main variable cost → meter per user from day one; launch is free-only, RevenueCat tiers come later
- Rate limiting per user/session
- Zod-validate every tool call input/output
- Fallback to text input everywhere (accessibility + noisy environments)
- Support microphone denial, failed transcription, lost connectivity, malformed UI, reduced motion, and screen-reader labels without losing or duplicating confirmed work
- Performance targets: useful spoken response starts within 4 seconds p95; complete preview within 8 seconds p95; confirmed state visible within 2 seconds p95

## Proof success bar

- At least **4 of 5** first-time users finish the loop unassisted within five minutes.
- At least **4 of 5** correctly explain the distinction between a Goal and a Highlight.
- After at least **25 users activate** by confirming a first plan and completing its highlighted Task, at least **40%** repeat the Highlight → Verified Progress loop on three distinct days in their first week.
