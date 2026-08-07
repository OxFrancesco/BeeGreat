# Flue 2 upgrade plan

Status: research complete; implementation not started.

Reference: `resources/flue` was refreshed with codeview on 2026-08-05 and is
at Flue `v2.0.3` (`bf86b87`). BeeGreat currently pins the main Flue packages
to `1.0.0-beta.9` and the GitHub, Linear, and Notion connectors to
`1.0.0-beta.1`.

## Executive decision

This is an architectural migration, not a dependency-only upgrade. Do it as
one feature branch, but in independently verifiable phases:

1. migrate the build and explicit route map;
2. migrate the Bee agent, provider seam, subagents, and tools;
3. migrate SDK/React consumers;
4. build and test against a fresh local Flue store;
5. deploy under a new Durable Object identity after deciding how much beta
   conversation context to restore.

The public agent URL should remain `/agents/bee/:conversationId`, and local
development should keep port `3583`. Keeping these interfaces stable avoids
unnecessary mobile, web, bridge, and documentation churn even though the
implementation behind them changes.

The durable identity should change from the beta-era `bee` identity to an
explicit v2 identity such as `bee-v2`. The HTTP mount does not need to match
the durable identity. This gives Cloudflare a new SQLite Durable Object class
(`FlueBeeV2Agent`) instead of opening beta data with the v2 runtime.

## Why the durable identity must change

Flue 2.0.3 stores format version 8; `1.0.0-beta.9` stored schema version 5.
Flue explicitly supports reset only for this transition. A v2 runtime rejects
the beta database before application code runs.

BeeGreat currently has these migration entries:

- `FlueRegistry` and `FlueBeeAgent` as SQLite classes in `v1`;
- the application-owned `Sandbox` class in `v2`.

Never rewrite those deployed entries. Append new migrations that retire
`FlueRegistry` and `FlueBeeAgent`, then introduce `FlueBeeV2Agent`. Update the
account-deletion binding from `FLUE_BEE_AGENT` to `FLUE_BEE_V2_AGENT` while
preserving the existing `deleteAccountData()` Cloudflare extension.

BeeGreat already syncs user-visible chat projections to Convex, so the beta
Flue stream can probably be treated as disposable. That does not preserve the
model's hidden conversation/tool context. Before deployment, choose one:

- accept a one-time assistant-context reset while leaving Convex history
  visible in the UI; or
- add a one-time v2 bootstrap that loads a bounded summary of the existing
  Convex thread into a fresh Flue instance.

Do not attempt to point `FlueBeeV2Agent` at the old class or rename
`FlueBeeAgent` in place; the stored format is still incompatible.

## Breaking changes that affect BeeGreat

| Flue 1 beta surface in BeeGreat | Flue 2.0.3 surface | BeeGreat migration |
| --- | --- | --- |
| `flue dev` / `flue build` | Vite with `@flue/vite` | Add Vite configs and change package scripts. |
| `@flue/cli/config` | `@flue/runtime/config` | Change `flue.config.ts`; remove or override its fixed Cloudflare target for the Node subscription-dev config. |
| generated `.flue-vite` files committed | generated, ignored Vite inputs | Untrack `.flue-vite/` and `.flue-vite.wrangler.jsonc`; add both to `.gitignore`. |
| `app.route('/', flue())` | explicit routers | Mount Bee with `createAgentRouter(Bee)` and each connector with `channel.route()`. |
| default `defineAgent(async initializer)` | exported synchronous function in a `'use agent'` module | Rewrite `bee.ts` around hooks and an async `useAgentStart` intake seam. |
| `AgentProfile` / `defineAgentProfile` | `SubagentDefinition` / `defineSubagent` plus `useSubagent` | Convert 8 profile factories and their tests. |
| tool `run({ input })` | tool `run({ data })` | Update 46 tool handlers across 8 files. |
| bare object/array/number tool return | `{ output: value }` | Audit all 55 `defineTool` definitions; wrap every non-string result. |
| `registerProvider` / `registerApiProvider` | Pi `createProvider` plus Flue `setProvider` | Replace the per-user Codex provider adapter using Pi 0.83's provider contract. |
| `dispatch(..., { input })` | `dispatch(Agent, { message })` | Convert four sends to `kind: 'signal'` messages; use stable idempotency keys where available. |
| deployment-scoped SDK client | conversation-scoped SDK client | Build clients with the complete `/agents/bee/:id` URL. |
| `FlueProvider` | removed | Delete the mobile provider wrapper. |
| `useFlueAgent({ name, id, client })` | `useFlueAgent({ client })` or `{ url }` | Make the client identity follow the active conversation. |
| `AgentPromptImage` and `{ images }` | `DeliveredAttachment` and message `attachments` | Update the iMessage bridge. |
| SDK `wait()` returns the reply | `wait()` returns void; `read()` returns the reply | Use `client.read(admission, { onEvent })` in iMessage. |
| assistant steps project as multiple messages | one assistant message per response | Re-run Convex merge, generated UI, progress, and latest-reply tests. |
| `agents` is an app dependency | bundled fallback of `@flue/vite` since 2.0.3 | Remove BeeGreat's direct `agents` dependency unless an authored import appears later. |

BeeGreat has no Flue workflows, workflow hooks, run clients, or custom Flue
database adapter. Those Flue 2 removals need no migration here.

## Recommended Bee agent shape

The current async initializer performs four parallel per-delivery operations:

- focus/time-zone lookup;
- enabled power-up lookup;
- connected Beennector lookup;
- user-scoped ChatGPT/Codex credential resolution and provider registration.

A Flue 2 agent render must be synchronous, but `useAgentStart` is awaited before
the first model call and state writes cause the next render to see the loaded
values. Concentrate the migration in one deep custom hook, tentatively
`useBeeCapabilities(id)`, rather than leaking Flue lifecycle rules into every
profile factory.

The hook should:

1. derive the bare Clerk user id synchronously from the conversation id;
2. read a serializable capability snapshot from `usePersistentState`;
3. use one `useAgentStart` callback to refresh the four independent sources in
   parallel for every delivery;
4. persist only non-secret facts needed to render: time context, enabled
   power-up ids, connected-system labels, and the selected provider id;
5. register the per-user Codex provider in memory before the first model call,
   but never persist its access token;
6. synchronously construct and mount the current tools/subagents from the
   snapshot on rerender.

Keep the existing TTL behavior for time zone and Codex credentials. Power-up
and Beennector availability should still refresh for every delivered message,
so toggles take effect on the next response.

### Per-user Codex provider

Pi 0.83 exposes exactly the replacement Flue expects:

- clone the built-in `openaiCodexProvider()` model catalog;
- rewrite each cloned model's `provider` to BeeGreat's stable user-scoped id;
- create the provider with `createProvider()`;
- provide the current Codex Responses stream implementation as its `api`;
- resolve `apiKey`, optional adapter `baseUrl`, and adapter-secret header in
  the provider auth result;
- register it through `setProvider()` during `useAgentStart`.

The existing hashed provider ids remain valuable for Node development, where
multiple conversations share one process. Cloudflare gives each conversation
its own Durable Object isolate, but relying on that alone would make the Node
target unsafe and cause provider replacement races.

The initial synchronous render can select the OpenRouter fallback. No model
call occurs until `useAgentStart` completes; the post-intake render selects
the registered Codex provider when one was resolved. On Durable Object restart,
the provider id may already be in persistent state, but the intake callback
must still re-register the in-memory provider before the model call.

### Subagents

Convert each profile factory to a `SubagentDefinition` factory whose inner
agent function calls `useTool`, `useSkill`, and nested `useSubagent`, then
returns its instruction document. The affected modules are:

- `shared/goals-subagent.ts`;
- `shared/imagine-subagent.ts`;
- `shared/sol-escalation-subagent.ts`;
- `shared/beennectors/subagent.ts`;
- `shared/bee-sites/astro-creator.ts`;
- `shared/powerups/devin.ts`;
- `shared/powerups/google-health.ts`;
- `shared/powerups/web3.ts`.

The Astro Creator factory must keep its mutable `activeSite` state outside the
inner agent render so it survives the delegate's render-per-turn cycle during
one task. It remains task-local and must not move into root agent persistent
state.

Bee and its delegates do not currently depend on Flue's implicit beta sandbox
tools. Astro Creator uses an application-owned Cloudflare Sandbox through its
own guarded tools, so the root Bee agent does not need `useSandbox()` merely to
preserve current behavior.

### Tools

The mechanical changes are broad but simple:

- replace destructured `input` with `data` in 46 handlers;
- wrap object, array, number, boolean, and null results in `{ output: ... }`;
- keep string returns only when the string is intentionally the complete tool
  output;
- preserve `signal` plumbing;
- do not add `durable: true` indiscriminately.

Many Bee tools perform external side effects. Flue's durable tools are
exactly-once-recorded but still at-least-once-executed around a crash window.
Only opt a side-effecting tool into durable steps after its Convex or external
operation has a stable idempotency key. The v2 migration should preserve the
current behavior first, then harden selected operations separately.

## Build and deployment files

Update `packages/agent/package.json` to Flue `2.0.3` consistently across
runtime, CLI, Vite, SDK-facing connectors, and any added observability package.
Add compatible `vite`, `@flue/vite`, and `@cloudflare/vite-plugin` versions,
align direct `@earendil-works/pi-ai` with Flue's `^0.83.0`, and upgrade direct
`hono` far enough to avoid duplicate incompatible route types. Remove the
direct `agents` dependency.

Use two Vite entry configs or one clearly conditional config:

- Cloudflare build/dev: `flue()` first, then
  `cloudflare({ config: flueWorkerConfig() })`;
- local ChatGPT subscription mode: Flue's Node target without the Cloudflare
  plugin.

Keep `vite dev --port 3583` in both development scripts. Rewrite
`scripts/dev-with-pi-chatgpt.ts` so it launches the Node Vite config; the old
`--target node` Flue CLI flag no longer exists.

`src/app.ts` should preserve the current middleware order and custom routes,
then explicitly mount:

```ts
app.route('/agents/bee', createAgentRouter(Bee))
app.route('/channels/github', githubChannel.route())
app.route('/channels/linear', linearChannel.route())
app.route('/channels/notion', notionChannel.route())
```

Webhook bypass rules already match those paths. Keep route authentication in
`app.ts`; the old agent-module `route` export is removed. Keep the Bee module's
`cloudflare` extension because account deletion depends on its extra method.

Flue 2 emits Cloudflare traces by default, but BeeGreat's current outer
`Sentry.withSentry` wrapper does not by itself instrument generated agent
Durable Objects. Compose Sentry's
`instrumentDurableObjectWithSentry` into the Bee module's existing
`extend({ base, wrap })` descriptor, and preserve the outer Worker wrapper if
HTTP request instrumentation is still desired. Avoid creating two separate
`cloudflare` exports for the same agent module.

## Client migrations

### Mobile

- Change `createBeeFlueClient` to require a conversation id and construct
  `${AGENT_URL}/agents/bee/${encodeURIComponent(id)}`.
- Create/recreate the client when the active thread changes and on an auth
  reconnect.
- Remove the singleton deployment client and `FlueProvider` from `_layout.tsx`.
- Keep the current long-poll/SSE selection and Clerk header resolver.

### Web

- Include `conversationId` in `createClient` and its callback dependencies.
- Construct a conversation URL instead of passing `baseUrl`.
- Call `useFlueAgent({ client, live })`; remove `name` and `id`.
- Keep the auth-reconnect client replacement behavior.

### iMessage bridge

- Cache clients by conversation URL, not only by user id.
- Rename `AgentPromptImage` to `DeliveredAttachment`.
- Send `{ message: { kind: 'user', body, attachments } }`.
- Replace `client.agents.send/wait/history` with
  `conversation.send/read/history`.
- Pass the existing progress callback to `read(..., { onEvent })`.

After updating types, re-run every chat-history and projection test. Flue 2
folds all assistant model/tool steps in one submission into a single assistant
message, which can change assumptions based on `messages.at(-1)` or per-step
message counts even when the wire chunks remain compatible.

## Channel dispatch migrations

The three connector callbacks and `/internal/web3-settled` must replace opaque
`input` objects with delivered signal messages:

```ts
await dispatch(Bee, {
  id,
  idempotencyKey: deliveryId,
  message: {
    kind: 'signal',
    type: 'github.issue_comment.created',
    body: commentBody,
    attributes: { deliveryId, repository, sender },
  },
})
```

Signal attributes must be flat strings; JSON-stringify nested provider details
into `body` when necessary. Keep the existing Convex delivery claim. Adding
Flue's `idempotencyKey` provides a second, durable admission guard and is
especially useful for provider redeliveries.

## Expected implementation surface

Primary production files:

- root `package.json`, `bun.lock`, and local-development docs/env examples;
- `packages/agent/package.json`, `flue.config.ts`, new Vite config(s),
  `.gitignore`, `wrangler.jsonc`, and generated files removed from Git;
- `packages/agent/src/app.ts`, `agents/bee.ts`, `providers/pi-chatgpt.ts`, and
  `scripts/dev-with-pi-chatgpt.ts`;
- the 8 subagent/profile modules listed above;
- tool factories in `bee-tools.ts`, `mind-tools.ts`, and those profile modules;
- all 3 channel modules;
- mobile Flue client/hook/layout files;
- web Bee agent hook;
- iMessage bridge client/progress code;
- affected agent, chat merge, projection, transport, route, and account
  deletion tests.

## Verification gates

1. Typecheck the agent, mobile, web, and iMessage workspaces with the v2
   packages installed.
2. Run BeeGreat's scoped tests. Avoid `bun test packages/agent`, which also
   matches `resources/pi/packages/agent`; use the exact BeeGreat test directory
   or explicit files.
3. Run a production Cloudflare `vite build` and inspect:
   - generated `FlueBeeV2Agent` export;
   - generated `FLUE_BEE_V2_AGENT` binding;
   - merged Wrangler config and unchanged historical migrations;
   - Sentry wrapper on the generated Bee Durable Object;
   - no committed `.flue-vite` artifacts.
4. Run the Node Vite config with the Pi/ChatGPT launcher on port 3583 and test
   both local access-token and brokered-token paths.
5. Exercise direct mobile/web chat, iMessage text plus image, each webhook,
   Web3 settled wake-up, account deletion, voice routes, power-up toggles,
   Beennector toggles, and Astro Creator.
6. Verify a reconnect during streaming, abort semantics, thread switching,
   and a new conversation created out of band.
7. Deploy to a non-production Worker with a new Durable Object identity before
   any production migration.

## Recommended implementation order

1. Dependency/build skeleton and explicit mounts, without deployment.
2. Tool contract codemod and focused tool tests.
3. Subagent conversion and profile-test replacement.
4. Bee lifecycle/capability hook and Pi provider adapter.
5. Dispatch/channel conversion.
6. SDK/React/iMessage conversion.
7. Sentry Durable Object composition.
8. Fresh-store integration tests and production build inspection.
9. Conversation-continuity decision and Cloudflare migration append.
10. Staging canary, then production rollout.
