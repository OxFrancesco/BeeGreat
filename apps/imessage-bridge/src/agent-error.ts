const PRO_SUBSCRIPTION_RECOVERY_MESSAGE =
  'BeeGreat Pro is required. Subscribe or restore in the signed-in BeeGreat iOS app, then try again.'

export function promptFailureReply(cause: unknown) {
  const status =
    cause instanceof Object && 'status' in cause ? cause.status : undefined
  const message = cause instanceof Error ? cause.message : ''
  return status === 402 ||
    /\b402\b|SUBSCRIPTION_REQUIRED|BeeGreat Pro is required/i.test(message)
    ? PRO_SUBSCRIPTION_RECOVERY_MESSAGE
    : 'Something went wrong reaching Bee. Try again in a moment.'
}
