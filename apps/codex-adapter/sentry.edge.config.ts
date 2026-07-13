import {
  sanitizeSentryBreadcrumb,
  sanitizeSentryEvent,
} from '@beegreat/observability'
import * as Sentry from '@sentry/nextjs'

const dsn = process.env.SENTRY_DSN?.trim()

Sentry.init({
  dsn,
  enabled: Boolean(dsn),
  environment: process.env.SENTRY_ENVIRONMENT || 'production',
  release: process.env.SENTRY_RELEASE,
  sendDefaultPii: false,
  beforeSend: sanitizeSentryEvent,
  beforeBreadcrumb: sanitizeSentryBreadcrumb,
  initialScope: { tags: { service: 'codex-adapter' } },
  tracesSampleRate: process.env.NODE_ENV === 'development' ? 1 : 0.2,
})
