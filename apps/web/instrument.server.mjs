import {
  sanitizeSentryBreadcrumb,
  sanitizeSentryEvent,
} from '@beegreat/observability'
import * as Sentry from '@sentry/tanstackstart-react'

const dsn = process.env.SENTRY_DSN?.trim()

Sentry.init({
  dsn,
  enabled: Boolean(dsn),
  environment: process.env.SENTRY_ENVIRONMENT || 'production',
  release: process.env.SENTRY_RELEASE,
  sendDefaultPii: false,
  beforeSend: sanitizeSentryEvent,
  beforeBreadcrumb: sanitizeSentryBreadcrumb,
  initialScope: { tags: { service: 'web-app' } },
  tracesSampleRate:
    process.env.NODE_ENV === 'development' ? 1 : 0.2,
})
