import { toError } from '@beegreat/observability'
import * as Sentry from '@sentry/bun'

export function captureBridgeFailure(
  cause: unknown,
  operation: string,
  userId?: string,
) {
  Sentry.withScope((scope) => {
    scope.setTag('service', 'imessage-bridge')
    scope.setTag('operation', operation)
    scope.setTag('handled', 'true')
    if (userId) scope.setUser({ id: userId })
    Sentry.captureException(toError(cause))
  })
}
