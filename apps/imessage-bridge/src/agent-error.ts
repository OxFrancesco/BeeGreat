const PRO_SUBSCRIPTION_RECOVERY_MESSAGE =
  'BeeGreat Pro is required. Subscribe or restore in the signed-in BeeGreat iOS app, then try again.'

export function promptFailureReply(error: unknown) {
  const status =
    error && typeof error === 'object' && 'status' in error
      ? error.status
      : undefined
  const message = error instanceof Error ? error.message : ''
  return status === 402 ||
    /\b402\b|SUBSCRIPTION_REQUIRED|BeeGreat Pro is required/i.test(message)
    ? PRO_SUBSCRIPTION_RECOVERY_MESSAGE
    : 'Something went wrong reaching Bee. Try again in a moment.'
}
