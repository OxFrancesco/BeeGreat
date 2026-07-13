# Sentry observability

BeeGreat reports unexpected failures from every deployable while keeping prompts, message text, health data, credentials, request bodies, and direct user details out of Sentry. Authenticated events use only the Clerk user ID so incidents can be correlated without sending names or email addresses.

## Project layout

Use one Sentry project named `beegreat` for every runtime. Choose React Native as the project platform during onboarding; the platform choice controls onboarding guidance, while every Sentry SDK can report to the same project DSN. The `service`, `operation`, environment, and release tags keep the runtimes independently searchable and alertable.

| BeeGreat runtime | `service` tag | DSN variable |
| --- | --- | --- |
| Expo iOS and Android | `mobile-app` | `EXPO_PUBLIC_SENTRY_DSN` |
| TanStack Start web app | `web-app` | `VITE_SENTRY_DSN` and `SENTRY_DSN` |
| Flue agent and voice APIs | `agent-worker` | `SENTRY_DSN` Wrangler secret |
| OpenAI-compatible Codex proxy | `codex-adapter` | `NEXT_PUBLIC_SENTRY_DSN` and `SENTRY_DSN` |
| Local iMessage bridge | `imessage-bridge` | `SENTRY_DSN` |
| Convex functions | `convex-backend` | `SENTRY_DSN` for handled Node action failures; optional native Convex integration on Pro |

All variables above receive the same `beegreat` project DSN. If event volume or team ownership later requires isolation, each runtime can move to its own project by changing only its DSN and build-time `SENTRY_PROJECT` value.

The checked-in `.env.example` files list runtime-specific variables. Never expose `SENTRY_AUTH_TOKEN`: it is a build/deploy secret used only to upload source maps.

## Sentry-side setup

1. Create one React Native project with slug `beegreat` in the BeeGreat Sentry organization.
2. Copy its DSN into every deployment environment using the runtime-specific variables above.
3. Create an organization auth token with release/source-map permissions and set `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, and `SENTRY_PROJECT=beegreat` only in CI/build environments.
4. Optional on Convex Pro: in the production deployment, open **Settings → Integrations → Sentry**, select `beegreat`, and enable exception reporting. BeeGreat currently skips this paid integration. `SENTRY_DSN` still covers deliberately handled authentication-workflow failures.
5. Set an explicit environment (`production`, `preview`, or `development`) and release identifier for every deploy. Use the git SHA for releases when the deployment platform does not provide one.

Native Convex exception reporting is intentionally disabled because it requires Convex Pro. The explicitly captured Node action failures still report to Sentry, while uncaught query, mutation, and other Convex runtime failures remain visible in Convex logs. Revisit the optional dashboard integration after upgrading to Pro.

## Environment setup

### Expo / EAS

Set `EXPO_PUBLIC_SENTRY_DSN`, `EXPO_PUBLIC_SENTRY_ENVIRONMENT`, `SENTRY_ORG`, `SENTRY_PROJECT=beegreat`, and the secret `SENTRY_AUTH_TOKEN` in the relevant EAS environment. The Expo config plugin and Sentry-aware Metro config upload native and JavaScript source maps during release builds.

### Web and Codex adapter

Set the public and server DSN variables to the same project DSN. Set `SENTRY_ORG`, the matching `SENTRY_PROJECT`, and `SENTRY_AUTH_TOKEN` in the build environment. Their build plugins upload source maps and remove them from public artifacts. Both apps tunnel browser events through a same-origin endpoint to reduce loss from client-side blockers.

### Agent worker

Store the DSN as a Worker secret:

```sh
bunx wrangler secret put SENTRY_DSN --config packages/agent/wrangler.jsonc
```

Set `SENTRY_ENVIRONMENT` and `SENTRY_RELEASE` as deployment variables. Wrangler source-map upload is enabled so Cloudflare can map Worker stack frames. Keep the source maps private.

### Convex

Set the DSN used for handled Node action failures. This works without the optional Convex Pro dashboard integration:

```sh
bunx convex env set SENTRY_DSN '<beegreat-dsn>'
bunx convex env set SENTRY_ENVIRONMENT production
bunx convex env set SENTRY_RELEASE '<git-sha>'
```

Run those commands from `packages/backend` against the intended deployment. Do not put the DSN or auth token in source control.

### iMessage bridge

Set `SENTRY_DSN`, `SENTRY_ENVIRONMENT`, and `SENTRY_RELEASE` in the bridge's local environment. Its Bun preload initializes Sentry before application imports, and fatal configuration failures flush events before exit.

## Alert policy

Configure these rules for the `production` environment in the `beegreat` project. Add a `service` condition whenever a rule applies to only one runtime:

- **New and regressed issues:** notify immediately when an issue is first seen or changes from resolved to unresolved. Route to the engineering notification channel and email the owner.
- **High-frequency failures:** notify when an error-level issue reaches 5 events in 5 minutes; escalate again at 25 events in 10 minutes.
- **Fatal mobile failures:** notify immediately for `fatal` events, native crashes, and app hangs. Alert when crash-free sessions fall below 99.5% over 24 hours.
- **Authentication and provider failures:** notify when `operation` begins with `chatgpt_auth`, `google_health`, `provider.credentials`, or `auth` and reaches 3 events in 10 minutes.
- **Voice and agent failures:** notify when `operation` begins with `voice` or `agent` and reaches 5 affected users in 15 minutes.

Add uptime monitors for the deployed agent `/health` endpoint and the Codex adapter health endpoint when one is exposed by the hosting platform. Synthetic requests must never contain real prompts, credentials, or user data.

Tags used for routing include `service`, `operation`, `handled`, environment, release, and the runtime-provided transaction/function tags. Assign an owner to the project so no alert depends on a single person's inbox.

## Privacy and sampling

- Default PII collection is disabled everywhere.
- Only a pseudonymous Clerk user ID is attached.
- Authorization/cookie headers, query strings, request bodies, environment data, prompts, messages, health fields, tokens, email addresses, phone numbers, and credentials are filtered.
- Mobile and browser session replay records only sessions containing errors. Text, images, and vector content are masked.
- Production traces are sampled at 20%; mobile profiles at 10%. Errors and native crashes are not sampled out.
- Console breadcrumb contents are redacted because provider SDKs can log sensitive response details.

## Release verification

After configuring a non-production project, verify each runtime with a temporary local throw or rejected provider response, then remove the trigger before merging. Confirm all of the following:

1. The event appears in the expected project and environment.
2. The stack trace points to TypeScript/TSX source rather than generated bundles.
3. `service` and `operation` tags are present for handled failures.
4. The event contains no prompt, message, health payload, token, cookie, request body, email, or phone number.
5. The issue alert reaches the configured notification destination.
6. Resolving the issue and sending it again triggers the regression alert.

Do not add a permanent public “throw an error” route. Use Sentry's project alert test and short-lived preview-only failures for ongoing drills.

References: [Sentry Expo setup](https://docs.sentry.io/platforms/react-native/manual-setup/expo/), [Sentry TanStack Start](https://docs.sentry.io/platforms/javascript/guides/tanstackstart/), [Sentry Cloudflare Workers](https://docs.sentry.io/platforms/javascript/guides/cloudflare/), [Convex exception reporting](https://docs.convex.dev/production/integrations/exception-reporting), and [Sentry alerts](https://docs.sentry.io/product/alerts/).
