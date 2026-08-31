import { toError } from '@beegreat/observability'
import * as Sentry from '@sentry/tanstackstart-react'

/** Identifying context values attached to a handled failure report. */
type FailureContext = Record<string, string>

/** Reports an operational failure that the web UI handled locally. */
export function captureWebFailure(
  cause: unknown,
  operation: string,
  extra?: FailureContext,
) {
  const normalized = toError(cause)
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
