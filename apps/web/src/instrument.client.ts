import {
  sanitizeSentryBreadcrumb,
  sanitizeSentryEvent,
} from '@beegreat/observability'
import * as Sentry from '@sentry/tanstackstart-react'

const dsn = import.meta.env.VITE_SENTRY_DSN?.trim()

Sentry.init({
  dsn,
  enabled: Boolean(dsn),
  environment:
    import.meta.env.VITE_SENTRY_ENVIRONMENT?.trim() ||
    (import.meta.env.DEV ? 'development' : 'production'),
  release: import.meta.env.VITE_SENTRY_RELEASE?.trim(),
  sendDefaultPii: false,
  beforeSend: sanitizeSentryEvent,
  beforeBreadcrumb: sanitizeSentryBreadcrumb,
  initialScope: { tags: { service: 'web-app' } },
  integrations: [
    Sentry.replayIntegration({
      maskAllText: true,
      maskAllInputs: true,
      blockAllMedia: true,
    }),
  ],
  tracesSampleRate: import.meta.env.DEV ? 1 : 0.2,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 1,
  maxBreadcrumbs: 75,
})
