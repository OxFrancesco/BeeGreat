# 05 – Voice Agent & Memory

## Concept

The agent **is** the home screen. Voice input first; the UI is spawned by the agent in response to what you ask.

### Interaction flow

1. App opens on the agent (mic-first)
2. User speaks: e.g. "How much time did I spend on my iPhone, Mac, and iPad today?"
3. Agent collapses into a **Dynamic Island**-style pill at the top
4. Below it, generated content streams in: a chart of screen time across the three devices, auto-labeled (Linear = work, YouTube/Instagram = doomscrolling), plus text commentary
5. A **Highlight view** is always available: super concise, information-dense snapshot of today's highlights

### Generative UI

- Agent responses are structured (JSON UI spec), rendered natively by each client (Expo + TanStack web from a shared component vocabulary)
- Component vocabulary (initial): text block, metric card, bar/pie chart, task list, goal/highlight card, journal entry, confirmation prompt
- Agent can also **act**: create tasks, log journal entries, adjust goals (with confirmation for destructive actions)

## The agent knows the user

Requirement from braindump: the agent "needs to know everything about the user and what their final goal is and how to help him with the goal."

- User profile: goals (and the *final* goal behind them), habits, schedule, integrations
- Context includes time-tracking data, task state, honey/score history, journal

## Memory layer (decided: SuperMemory)

- **All threads stored** — every question and answer persisted (Convex)
- Long-term semantic memory: **SuperMemory** (starting choice; swap only if it underdelivers on per-user isolation, latency, or cost)
- Memory writes: after each session, distill facts/preferences/goal updates into memory
- Memory reads: retrieved at session start + on-demand during tool calls
- Flue sessions/durable streams give thread continuity; SuperMemory covers cross-session knowledge

## Pipeline (decided)

```
mic → ElevenLabs STT
    → Flue agent (defineAgent) on Cloudflare Workers (Durable Object per user)
    → tools: Convex queries/mutations, integrations, SuperMemory, FAL (bee avatars)
    → LLM via OpenRouter (GPT 5.5 low for simple, Fable 5 for orchestration)
    → response: text + ElevenLabs TTS + UI spec → client renders
```

## Cost & guardrails

- Voice minutes (ElevenLabs) and LLM calls are the main variable cost → meter per user from day one; launch is free-only, RevenueCat tiers come later
- Rate limiting per user/session
- Zod-validate every tool call input/output
- Fallback to text input everywhere (accessibility + noisy environments)
