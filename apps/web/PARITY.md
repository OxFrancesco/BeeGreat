# Web/mobile feature parity

Audited against `apps/mobile/src` on 2026-08-05. The web twin exposes every
user-facing mobile workflow and calls the same authenticated Convex and Flue
services; it does not maintain a second product backend.

| Mobile capability                                  | Web evidence                                                 | Shared service/state                                                         |
| -------------------------------------------------- | ------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| Clerk sign-in and protected app                    | `/`, `routes/_app.tsx`                                       | Same Clerk session and Convex auth token                                     |
| Optional ChatGPT device auth                       | `features/auth/chatgpt-auth.tsx`                             | `chatgptAuth.status/start/skip/disconnect`                                   |
| Bee streaming conversation                         | `/bee`, `features/bee/use-bee-agent.ts`                      | Flue agent `bee`, Clerk bearer token                                         |
| Cross-device threads, history, and archiving       | Bee conversation rail, `features/bee/use-convex-chat.ts`     | Same `userId~threadId` conversation ID and `chat.*` functions                |
| Reply retry and message/tool copy                  | Bee message actions, `features/bee/retry-turn.ts`             | Same durable tombstones through `chat.hideMessages`; browser clipboard       |
| Typed fallback and agent commands                  | Bee composer                                                 | Same `sendText`; `/new` and `/clear` create a shared thread                  |
| Voice notes, transcription, and spoken replies     | Persistent Talk control, `features/bee/use-browser-voice.ts` | Same `/voice/transcribe` and `/voice/speak` agent routes                     |
| Live Grok voice conversation                       | `/voice`, `features/bee/use-realtime-voice.ts`                | Same ephemeral `/voice/realtime-token` route and xAI realtime model          |
| Generated UI and confirmation                      | `features/bee/generated-ui.tsx`                              | Same `beeui` vocabulary and server mutations                                 |
| First-focus preview and completion                 | Bee preview and Hive Highlight                               | Same atomic `firstFocus.confirmPlan/completeHighlight` calls and request IDs |
| Goal list and management                           | `/goals`                                                     | Same `goals.*` queries/mutations and three-slot client guidance              |
| Goal and Project management                        | `/goals/:goalId`                                             | Same `goals.*` and `projects.*` operations                                   |
| Tasks, Subtasks, due dates, Project targets        | `/projects/:projectId`                                       | Same `tasks.*` and `projects.setDue` operations                              |
| Hive balances and Honey vessel                     | `/hive`                                                      | Same `firstFocus.getCurrent` state                                           |
| Highlight rewards, GolieBee, Achievements          | `/hive`                                                      | Same idempotent completion and economy state                                 |
| Mind library: honeycomb, cards, and list views     | `/mind`, `features/mind/mind-page.tsx`                       | Same reactive `bookmarks.list/search/labels` queries                         |
| Mind capture, detail, editing, retry, and delete   | `/mind` add dialog and detail panel                          | Same `bookmarks.add/get/update/retry/remove` mutations                       |
| Bee Healthy daily summary                          | Goals Bee Healthy card, `/health`                            | Same local-day key and `healthJournal.getByDate` state                       |
| Mood check-in and seven-day pulse                  | `/health`                                                    | Same `healthJournal.getByDate/listRecent/setMood` operations                 |
| Hydration tracking and undo                        | `/health/water`                                              | Same limits and `healthJournal.adjustHydration` mutation                     |
| Journal timeline, search, and calendar             | `/health/journal`                                            | Same `journalEntries.listRecent/listDay/listMonth/search/importLegacy` calls |
| Journal editing, tags, photos, sharing, and delete | `/health/journal/:entryId`                                   | Same entry and Convex storage operations; Web Share/clipboard adapter        |
| Configurable NFC tap actions                       | `/health/tap-actions`                                        | Same `nfcActions.list/create/update/remove` operations and stable tag URLs   |
| Tap execution, duplicate protection, and undo      | `/tap/:publicId`                                             | Same authenticated `nfcActions.execute/undo` operations                      |
| Profile and spoken-reply preference                | `/settings`                                                  | Same Clerk identity; local device preference, as on mobile                   |
| Power-ups and Google Health                        | `/settings`                                                  | Same registry, enablement, OAuth action, status, and disconnect mutation     |
| Smart-wallet QR and YOLO consent                   | `/settings`, `features/settings/wallet-settings.tsx`          | Same wallet address and `web3Prefs.get/setYolo` operations                   |
| Account deletion and recovery                      | `/settings`                                                  | Same prepare/revoke/delete/activate/cancel lifecycle with durable resume     |
| Legal, support, and subscription management        | `/settings`                                                  | Same BeeDocs pages; Apple subscription management opens Apple                |
| Loading, failure, empty, and missing-entity states | All product routes                                           | Reactive Convex state with retry/rollback where the mobile flow has it       |
| Responsive and dark presentation                   | Shared app shell and CSS                                     | Mobile bottom navigation, desktop Hive spine, OS color preference            |

## Platform adaptations

Native haptics and ActivityKit have no browser API. Their functional equivalents
are visible pressed/success/error states and the persistent in-app voice island.
Expo's native auth sheet maps to a constrained browser popup. Voice notes use
`MediaRecorder`; live voice uses Web Audio PCM capture/playback, while preserving
the same authenticated token, transcription, text-command, and speech paths.
NFC-capable browsers write the
same private URL with Web NFC; other browsers copy the URL for writing from the
mobile app. Apple purchases remain managed by Apple rather than duplicated with
a second web billing system.

The unused mobile attachment presentation component is not included because it
is not connected to any mobile screen or agent workflow.

## Audit invariants

- Every authenticated `api.<module>.<function>` operation called by mobile is
  also called by web. Web additionally owns `beeSites.*`, which has no native
  editing surface.
- Both clients use Flue agent name `bee` and conversation IDs derived from the
  authenticated Clerk user plus the active Convex thread.
- Confirmations and Highlight completion are executed client-side once, with
  stable request IDs; Bee only receives a verified app-event acknowledgement.
- Web unit tests cover transcript reconciliation, generated-UI validation,
  retry tombstones, realtime PCM conversion, tool labeling, focus utilities,
  health calendar utilities, and stable GolieBee presentation.
