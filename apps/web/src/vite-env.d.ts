/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_AGENT_URL?: string
  readonly VITE_CONVEX_URL?: string
  readonly VITE_FLUE_LIVE_MODE?: string
  readonly VITE_REOWN_PROJECT_ID?: string
  readonly VITE_SENTRY_DSN?: string
  readonly VITE_SENTRY_ENVIRONMENT?: string
  readonly VITE_SENTRY_RELEASE?: string
}
