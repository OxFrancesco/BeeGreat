import { z } from 'zod'

function errorMessage(cause: unknown) {
  return cause instanceof Error ? cause.message : ''
}

export const PRO_SUBSCRIPTION_RECOVERY_MESSAGE =
  'BeeGreat Pro is required. Subscribe or restore in the signed-in BeeGreat iOS app, then try again.'

/** Transport failures carry the HTTP status they were rejected with. */
const failureWithStatus = z.object({ status: z.number() })

function subscriptionRequired(cause: unknown) {
  const status = failureWithStatus.safeParse(cause).data?.status
  return (
    status === 402 ||
    /\b402\b|SUBSCRIPTION_REQUIRED|BeeGreat Pro is required/i.test(
      errorMessage(cause),
    )
  )
}

export function isAuthHiccup(cause: unknown) {
  return /401|sign in|session expired/i.test(errorMessage(cause))
}

export function friendlyBeeErrorMessage(cause: unknown) {
  if (!(cause instanceof Error)) return undefined
  if (subscriptionRequired(cause)) return PRO_SUBSCRIPTION_RECOVERY_MESSAGE
  if (isAuthHiccup(cause)) return 'Reconnecting to Bee…'
  if (/Flue API error|HTTP Error \d+/i.test(cause.message)) {
    return 'Bee couldn’t reach the hive. Check your connection and try again.'
  }
  return cause.message
}

export function beeSendFailureMessage(cause: unknown) {
  return subscriptionRequired(cause)
    ? PRO_SUBSCRIPTION_RECOVERY_MESSAGE
    : 'Your message wasn’t sent. Check your connection and try again.'
}
