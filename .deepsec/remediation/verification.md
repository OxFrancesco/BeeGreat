# Local verification

The source fixes cover all 163 exported scanner findings. This record applies to the working tree, not deployed services. Per-finding evidence is in checklist.json. Evidence logs and review notes are copied into evidence/ with a SHA-256 manifest. Early candidate review notes may describe a defect subsequently corrected; use the final checklist and final validation logs for the resulting disposition.

## Completed gates

| Gate | Result | Command or evidence |
| --- | --- | --- |
| Backend tests | 392 pass | `bun run --cwd packages/backend test:run` |
| Sugar tests | 333 pass | `bun run --cwd packages/sugar test` |
| Agent tests | 79 pass | Agent test suite with `test/preload.ts` |
| Web tests | 49 pass | `bun run --cwd apps/web test` |
| CLI tests | 66 pass | `bun run --cwd apps/cli test` |
| Codex adapter tests | 5 pass | `bun run --cwd apps/codex-adapter test` |
| Sites tests | 5 pass | `bun run --cwd apps/sites test` |
| Shared and client library tests | 131 pass | Mobile libraries, iMessage, chat-sync, tool-presentation, walletconnect and observability |
| Type checks | Pass | Backend, agent, web, mobile, Sugar, CLI, bridge and sites |
| Lint | Pass | `bun run lint` in web, mobile and Sugar |
| Web build | Pass | `bun run --cwd apps/web build`, Nitro production output |
| Agent build | Pass | `bun run --cwd packages/agent build` |
| Codex adapter build | Pass | `bun run --cwd apps/codex-adapter build` |
| Sugar CLI build | Pass | `bun run --cwd packages/sugar build` |
| Mobile JavaScript exports | Pass | `bunx expo export --platform ios --platform android --output-dir /tmp/deepsec-mobile-export` in apps/mobile |
| Astro executable boundary | Pass locally | Actual Docker image, unprivileged build, no network, attempted writes to starter and sibling/runtime paths denied |
| Broker delivery route | Pass | Actual Hono middleware and route registration with controlled dispatch, wrong-secret rejection and saved-key receipt |
| Approval review rendering | Pass | Actual React components with controlled backend results, exact destination/body, saved mutation args, uncertain and cancelled states |
| Final diff whitespace | Pass | `git diff --check` |
| Preexisting changes | Preserved | evidence/baseline-preservation.json and baseline-diffs/ |

The regular suites total 1,060 passing tests. Focused route, component, runtime, review and container checks are additional evidence and are not included in that total. Tests that require module mocks run in separate processes to avoid leaking one fixture into another.

## Diagnostics and limits

Expo Doctor reports 16 of 21 checks passing. The five remaining checks concern a missing direct expo-asset peer, duplicate native installations, a Hermes version regression advisory, React Native Directory metadata and SDK package-version alignment. The mobile package declarations are identical to the pre-task baseline. These findings require a separate dependency and native release pass. No warning suppression or dependency exclusion was added.

The local web build skips its Vercel-specific artifact gate outside a Vercel build. Nitro output and startup are tested; deployment-specific output still needs the provider build.

Production services were not deployed. No financial transaction, provider comment, account deletion, credential rotation or historical-data migration was performed as a verification shortcut. Actual OAuth consent and signed-in browser approval, provider billing behavior, Cloudflare VM isolation, native audio/NFC, and installed-device interactions remain rollout checks.

The browser screenshot confirms the review page's signed-out authentication gate. It does not prove approval by a signed-in user. CAP reported captureReady=false because macOS screen-recording permission is denied, so no video recording is claimed.
