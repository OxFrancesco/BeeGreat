import { toError } from '@beegreat/observability'
import * as Sentry from '@sentry/tanstackstart-react'

/** Reports an operational failure that the web UI handled locally. */
export function captureWebFailure(
  error: unknown,
  operation: string,
  extra?: Record<string, unknown>,
) {
  const normalized = toError(error)
  if (
    normalized.name === 'AbortError' ||
    /(?:cancelled|canceled|dismissed) by (?:the )?user/i.test(
      normalized.message,
    )
  ) {
    return
  }

  Sentry.withScope((scope) => {
    scope.setTag('service', 'web-app')
    scope.setTag('operation', operation)
    scope.setTag('handled', 'true')
    if (extra) scope.setExtras(extra)
    Sentry.captureException(normalized)
  })
}
