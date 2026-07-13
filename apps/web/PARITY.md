# Web/mobile feature parity

Audited against `apps/mobile/src` on 2026-07-13. The web twin exposes every
user-facing mobile workflow and calls the same authenticated Convex and Flue
services; it does not maintain a second product backend.

| Mobile capability                                  | Web evidence                                                 | Shared service/state                                                         |
| -------------------------------------------------- | ------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| Clerk sign-in and protected app                    | `/`, `routes/_app.tsx`                                       | Same Clerk session and Convex auth token                                     |
| Optional ChatGPT device auth                       | `features/auth/chatgpt-auth.tsx`                             | `chatgptAuth.status/start/skip/disconnect`                                   |
| Bee streaming conversation                         | `/bee`, `features/bee/use-bee-agent.ts`                      | Flue agent `bee`, Clerk bearer token                                         |
| Cross-device threads and history                   | Bee conversation rail, `features/bee/use-convex-chat.ts`     | Same `userId~threadId` conversation ID and `chat.*` functions                |
| Typed fallback and agent commands                  | Bee composer                                                 | Same `sendText`; `/new` and `/clear` create a shared thread                  |
| Talk, transcription, and spoken replies            | Persistent Talk control, `features/bee/use-browser-voice.ts` | Same `/voice/transcribe` and `/voice/speak` agent routes                     |
| Generated UI and confirmation                      | `features/bee/generated-ui.tsx`                              | Same `beeui` vocabulary and server mutations                                 |
| First-focus preview and completion                 | Bee preview and Hive Highlight                               | Same atomic `firstFocus.confirmPlan/completeHighlight` calls and request IDs |
| Goal list and management                           | `/goals`                                                     | Same `goals.*` queries/mutations and three-slot client guidance              |
| Goal and Project management                        | `/goals/:goalId`                                             | Same `goals.*` and `projects.*` operations                                   |
| Tasks, Subtasks, due dates, Project targets        | `/projects/:projectId`                                       | Same `tasks.*` and `projects.setDue` operations                              |
| Hive balances and Honey vessel                     | `/hive`                                                      | Same `firstFocus.getCurrent` state                                           |
| Highlight rewards, GolieBee, Achievements          | `/hive`                                                      | Same idempotent completion and economy state                                 |
| Profile and spoken-reply preference                | `/settings`                                                  | Same Clerk identity; local device preference, as on mobile                   |
| Power-ups and Google Health                        | `/settings`                                                  | Same registry, enablement, OAuth action, status, and disconnect mutation     |
| Loading, failure, empty, and missing-entity states | All product routes                                           | Reactive Convex state with retry/rollback where the mobile flow has it       |
| Responsive and dark presentation                   | Shared app shell and CSS                                     | Mobile bottom navigation, desktop Hive spine, OS color preference            |

## Platform adaptations

Native haptics and ActivityKit have no browser API. Their functional equivalents
are visible pressed/success/error states and the persistent in-app voice island.
Expo's native auth sheet maps to a constrained browser popup. Audio capture uses
`MediaRecorder` in place of Expo Audio, while preserving the same authenticated
transcription, text-command, and speech paths.

The unused mobile attachment presentation component is not included because it
is not connected to any mobile screen or agent workflow.

## Audit invariants

- The unique `api.<module>.<function>` call sets in `apps/mobile/src` and
  `apps/web/src` are identical.
- Both clients use Flue agent name `bee` and conversation IDs derived from the
  authenticated Clerk user plus the active Convex thread.
- Confirmations and Highlight completion are executed client-side once, with
  stable request IDs; Bee only receives a verified app-event acknowledgement.
- Web unit tests cover transcript reconciliation, generated-UI validation,
  tool labeling, focus utilities, and stable GolieBee presentation.
