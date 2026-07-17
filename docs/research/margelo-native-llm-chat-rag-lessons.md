# Margelo native AI chat + RAG: lessons for BeeGreat

Date: 2026-07-16
Source: [Building a ChatGPT-Style AI Chat App in React Native with RAG & Streaming](https://blog.margelo.com/building-native-llm-chat-app-with-rag)

## Executive verdict

BeeGreat can use several of the article's lessons, but it should adapt them to its existing Flue + Convex architecture instead of copying the demo stack.

The highest-value lesson is to remove work from the chat hot path: virtualize and paginate long conversations, keep keyboard/composer movement on the UI thread, and profile release builds on real devices. The most promising networking experiment is Flue's supported SSE mode, not a direct OpenAI WebSocket. Semantic RAG is a worthwhile later improvement behind BeeGreat's existing `search_mind` tool, with Convex remaining canonical and all provider credentials staying server-side.

The article is **not** an on-device LLM implementation. OpenAI performs generation and Pinecone performs retrieval. “Native” refers to the React Native UI and native networking/rendering modules.

## What the article demonstrates

The sample combines:

- Legend List v3 chat anchoring and keyboard-aware scrolling;
- `react-native-keyboard-controller` for a sticky, interactive composer;
- native Markdown, sheets, SF Symbols, Liquid Glass, Reanimated transitions, and Skia shimmer;
- the OpenAI Responses API over a direct WebSocket from the app;
- Pinecone integrated embeddings exposed as a model-callable retrieval tool.

The article explicitly treats its mobile OpenAI key as demo-only. The same production constraint applies to its Pinecone credential: secrets embedded in a mobile binary are extractable, so both services must be called from trusted server code. OpenAI's own guidance says not to deploy API keys in mobile apps: [API key safety](https://help.openai.com/en/articles/5112595-best-practices-for-api-key-safety).

The author reports smooth release-build results on an iPhone 16, but those numbers are evidence for that demo—not a performance prediction for BeeGreat. We need our own release measurements.

## Current BeeGreat fit

BeeGreat already has much of the article's visual/native foundation:

- Expo 57, React Native 0.86, Reanimated, Skia, `expo-symbols`, and `expo-glass-effect` are already dependencies (`apps/mobile/package.json`).
- It already renders reasoning, tools, generated native UI, and a quiet shimmer separately (`apps/mobile/src/app/(tabs)/index.tsx`, `apps/mobile/src/components/agent/`).
- It already uses native form sheets (`apps/mobile/src/app/_layout.tsx`).
- Its agent/provider path is authenticated and server-side through Flue (`apps/mobile/src/lib/flue.ts`, `packages/agent/src/app.ts`). That path also preserves provider choice, tools, subscription enforcement, durable execution, and web/mobile parity.
- It already has tool-driven RAG in spirit: `search_mind` performs owner-scoped Convex full-text search over saved bookmarks (`packages/agent/src/shared/mind-tools.ts`, `packages/backend/convex/agentMind.ts`).

The clearest gaps are in the end-to-end conversation path:

- `Conversation` mounts every message in a `ScrollView` and calls `scrollToEnd` after content-size changes (`apps/mobile/src/components/agent/conversation.tsx:21-63`).
- The chat screen maps the complete message array during streaming and wraps the whole screen in `KeyboardAvoidingView` (`apps/mobile/src/app/(tabs)/index.tsx:65-152`).
- Convex history is returned through an unbounded `.collect()` (`packages/backend/convex/chat.ts:184-205`).
- Every transcript update fingerprints and can resend the complete syncable transcript in chunks (`apps/mobile/src/hooks/use-convex-chat.ts:63-172`), while the mutation checks/upserts every submitted row (`packages/backend/convex/chat.ts:207-260`).

Virtualizing only the visible list would therefore address just one layer. The history query and synchronization path must become bounded too.

## Recommendations

| Priority | Article lesson | BeeGreat decision | Rationale |
|---|---|---|---|
| P0 | Measure native performance | **Adopt first** | Establish release-device baselines for first visible output, token gaps, JS/UI FPS, memory at long history sizes, keyboard latency, reconnects, and background resume. |
| P1 | Chat-specific virtualized list | **Adopt as an end-to-end spike** | Cursor-paginate Convex history, sync only changed/current envelopes, then replace the `ScrollView` with Legend List using stable message IDs. Test variable-height reasoning, tools, and `beeui` before enabling recycling. |
| P1 | UI-thread keyboard handling | **Adopt as a spike** | Replace the chat-level `KeyboardAvoidingView` with Keyboard Controller's sticky composer/inset primitives. Test iPhone, iPad floating/split keyboards, Android edge-to-edge, hardware keyboards, rotation, sheets, and Reduce Motion. |
| P1 | Faster live transport | **Adapt** | Canary Flue's supported SSE mode against the current forced long-poll mode. Measure first-delta latency, request count, battery, auth recovery, reconnect, and background/resume behavior before rollout. |
| P2 | Vector RAG tool | **Adapt later** | Evaluate today's lexical `search_mind` on real private queries first. If relevance is insufficient, add owner-filtered chunks and hybrid lexical/vector retrieval behind the same tool interface. |
| P2 | Liquid Glass | **Optional polish** | Use the already-installed Expo `GlassView` as an iOS 26 enhancement with a layout-identical fallback and capability checks. |
| — | Direct OpenAI/Pinecone mobile calls | **Skip** | They expose secrets and bypass Flue authentication, billing, tools, durable replay, provider choice, and cross-client consistency. |
| — | Nitro WebSocket/fetch solely for speed | **Skip for now** | Expo 57 already supplies streaming `expo/fetch`; Flue supports SSE. Add native networking dependencies only if profiling identifies a remaining transport bottleneck. |
| — | Nitro Symbols, another glass wrapper, True Sheet, pager navigation | **Skip** | BeeGreat already has equivalent primitives or a different product navigation model. |
| — | Rich Markdown as a default answer renderer | **Defer** | Bee's current spoken-output contract deliberately forbids Markdown and uses `beeui` for structured native output (`packages/agent/src/agents/bee.md:10-37`). Revisit only if the product contract changes. |
| — | More elaborate shimmer and long entrance animations | **Skip** | BeeGreat's motion system intentionally favors shorter, quieter, reduced-motion-compatible feedback. |

## Suggested implementation sequence

### 1. Baseline before changing dependencies

Create a release-build scenario matrix with short, 100-message, and 500-message conversations, including tool/reasoning/generated-UI rows. Record:

- admission-to-first-visible-delta and p95 inter-delta gap;
- JS and UI frame rate during streaming and keyboard interaction;
- memory and mount/render counts;
- reconnect, background/resume, and 401 recovery behavior;
- network request count for long-poll versus SSE.

This keeps article-inspired changes evidence-driven and provides a rollback threshold.

### 2. Bound the entire chat pipeline

Implement cursor pagination for `chatMessages`, load older pages on demand, and stop re-fingerprinting/re-uploading the whole transcript for every stream update. Preserve the current optimistic/local-versus-canonical merge behavior with tests.

Then spike Legend List v3. Its chat-oriented API includes `maintainScrollAtEnd`, `anchoredEndSpace`, and keyboard helpers: [Legend List overview](https://legendapp.com/open-source/list/v3/overview/), [Legend List API](https://legendapp.com/open-source/list/v3/api/). Begin with recycling disabled because several rows have transient local UI state; enable it only after that state is isolated and verified.

### 3. Move composer interaction off the JS hot path

Expo recommends `react-native-keyboard-controller` for advanced keyboard-driven interfaces: [Expo keyboard handling](https://docs.expo.dev/guides/keyboard-handling/). Integrate its provider and sticky composer in a development build, preserving the existing visual design and accessibility behavior.

### 4. Canary SSE within Flue

The mobile client currently forces `live: 'long-poll'` (`apps/mobile/src/hooks/use-voice-agent.ts:62-68`), while the installed Flue React client supports `sse` and uses it by default (`node_modules/@flue/react/README.md`). Expo 57's `expo/fetch` supports streaming and is installed as global fetch on iOS and Android: [Expo SDK 57 fetch](https://docs.expo.dev/versions/v57.0.0/sdk/expo/).

Put SSE behind a feature flag and validate it on physical devices. Do not replace Flue with the article's provider-specific socket. OpenAI says its WebSocket gains are most pronounced for long, agentic workflows with many tool calls, so its headline improvement is not a general chat guarantee: [OpenAI WebSocket mode](https://openai.com/index/speeding-up-agentic-workflows-with-websockets/).

### 5. Upgrade retrieval only after evaluation

The current `search_mind` path is already private and owner-scoped, but it searches one combined `searchText` field rather than chunks. Build a small evaluation set of real “what did I save about …?” queries and score source recall, answer groundedness, latency, and deletion/revision correctness.

If lexical retrieval is inadequate:

1. Create derived chunks with source ID, owner key, source revision/content hash, chunk position, embedding-model version, and provenance.
2. Run vector search in a server action and fuse its results with the existing full-text search.
3. Return source metadata through the existing tool rather than concatenating anonymous chunks.
4. Rebuild or purge derived embeddings on bookmark edits, deletion, account deletion, retention expiry, and embedding-model changes.

Convex supports vector indexes with filter fields and action-based search: [Convex vector search](https://docs.convex.dev/search/vector-search). This matches BeeGreat's existing memory architecture decision that semantic indexes remain deletable/rebuildable derivatives rather than authority (`docs/09-fra-423-memory-architecture.md`). Pinecone remains an option only as a server-side derived index if Convex no longer meets measured scale or relevance needs.

## Decision summary

Proceed with three bounded experiments, in order:

1. end-to-end paginated/virtualized chat;
2. UI-thread keyboard/composer integration;
3. feature-flagged Flue SSE.

Keep semantic hybrid retrieval as the next product-level RAG project, gated by relevance evaluation and current roadmap priority. Do not copy the article's client-side provider credentials or bypass BeeGreat's server architecture.

No application code was changed as part of this assessment.
