import {
  sanitizeSentryBreadcrumb,
  sanitizeSentryEvent,
} from '@beegreat/observability'
import * as Sentry from '@sentry/nextjs'

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN?.trim()

Sentry.init({
  dsn,
  enabled: Boolean(dsn),
  environment:
    process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT || 'production',
  release: process.env.NEXT_PUBLIC_SENTRY_RELEASE,
  sendDefaultPii: false,
  beforeSend: sanitizeSentryEvent,
  beforeBreadcrumb: sanitizeSentryBreadcrumb,
  initialScope: { tags: { service: 'codex-adapter' } },
  tracesSampleRate: process.env.NODE_ENV === 'development' ? 1 : 0.2,
})

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
