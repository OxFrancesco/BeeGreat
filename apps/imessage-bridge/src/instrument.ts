import {
  sanitizeSentryBreadcrumb,
  sanitizeSentryEvent,
} from '@beegreat/observability'
import * as Sentry from '@sentry/bun'

const dsn = process.env.SENTRY_DSN?.trim()

Sentry.init({
  dsn,
  enabled: Boolean(dsn),
  environment: process.env.SENTRY_ENVIRONMENT || 'development',
  release: process.env.SENTRY_RELEASE,
  sendDefaultPii: false,
  beforeSend: sanitizeSentryEvent,
  beforeBreadcrumb: sanitizeSentryBreadcrumb,
  initialScope: { tags: { service: 'imessage-bridge' } },
  tracesSampleRate:
    process.env.SENTRY_ENVIRONMENT === 'production' ? 0.2 : 1,
})
