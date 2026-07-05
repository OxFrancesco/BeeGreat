# @beegreat/mobile

Expo (SDK 57) app for BeeGreat. The home screen **is** the voice agent: a Skia-drawn
honey orb you talk to, which collapses into a Dynamic Island-style pill while the agent
thinks, calls tools, and streams generated UI cards.

## Run it

From the repo root:

```bash
bun run agent    # Flue voice agent worker on :3583
bun run mobile   # convex dev + iOS simulator
```

Set `EXPO_PUBLIC_AGENT_URL` in `.env` (LAN IP instead of localhost for physical devices).

## Layout

- `src/app/` — expo-router screens (`index.tsx` is the voice agent home)
- `src/components/agent/` — agent UI kit (ai-elements ports for RN: conversation,
  message, attachments, reasoning, tool, suggestion, shimmer + voice orb, agent pill,
  generated-ui renderer)
- `src/hooks/use-voice-agent.ts` — record → transcribe → agent → speak orchestration
- `src/lib/` — Flue client, `beeui` spec schema, voice API helpers
