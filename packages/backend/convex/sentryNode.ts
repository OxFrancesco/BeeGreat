'use node'

import {
  sanitizeSentryBreadcrumb,
  sanitizeSentryEvent,
  toError,
} from '@beegreat/observability'
import * as Sentry from '@sentry/node'

let initializedDsn: string | undefined

function ensureSentry() {
  const dsn = process.env.SENTRY_DSN?.trim()
  if (!dsn) return false
  if (initializedDsn === dsn) return true

  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT || 'production',
    release: process.env.SENTRY_RELEASE,
    sendDefaultPii: false,
    beforeSend: sanitizeSentryEvent,
    beforeBreadcrumb: sanitizeSentryBreadcrumb,
    initialScope: { tags: { service: 'convex-backend' } },
    tracesSampleRate: 0,
  })
  initializedDsn = dsn
  return true
}

export async function captureHandledConvexException(
  error: unknown,
  operation: string,
  context: {
    userId?: string
    extra?: Record<string, unknown>
  } = {},
) {
  try {
    if (!ensureSentry()) return false

    Sentry.withScope((scope) => {
      scope.setTag('service', 'convex-backend')
      scope.setTag('operation', operation)
      scope.setTag('handled', 'true')
      if (context.userId) scope.setUser({ id: context.userId })
      if (context.extra) scope.setExtras(context.extra)
      Sentry.captureException(toError(error))
    })
    return await Sentry.flush(2_000)
  } catch {
    // Observability must never prevent the auth workflow from recording its
    // own failure state when Sentry is unavailable or misconfigured.
    console.error('sentry: handled exception capture failed')
    return false
  }
}
