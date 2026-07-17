function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : ''
}

export const PRO_SUBSCRIPTION_RECOVERY_MESSAGE =
  'BeeGreat Pro is required. Subscribe or restore in the signed-in BeeGreat iOS app, then try again.'

function subscriptionRequired(error: unknown) {
  const status =
    error && typeof error === 'object' && 'status' in error
      ? error.status
      : undefined
  return (
    status === 402 ||
    /\b402\b|SUBSCRIPTION_REQUIRED|BeeGreat Pro is required/i.test(
      errorMessage(error),
    )
  )
}

export function isAuthHiccup(error: unknown) {
  return /401|sign in|session expired/i.test(errorMessage(error))
}

export function friendlyBeeErrorMessage(error: unknown) {
  if (!(error instanceof Error)) return undefined
  if (subscriptionRequired(error)) return PRO_SUBSCRIPTION_RECOVERY_MESSAGE
  if (isAuthHiccup(error)) return 'Reconnecting to Bee…'
  if (/Flue API error|HTTP Error \d+/i.test(error.message)) {
    return 'Bee couldn’t reach the hive. Check your connection and try again.'
  }
  return error.message
}

export function beeSendFailureMessage(error: unknown) {
  return subscriptionRequired(error)
    ? PRO_SUBSCRIPTION_RECOVERY_MESSAGE
    : 'Your message wasn’t sent. Check your connection and try again.'
}
