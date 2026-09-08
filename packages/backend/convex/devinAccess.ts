import { env } from './_generated/server'

export function hasDevinOrganizationAccess(userId: string) {
  return (env.DEVIN_ALLOWED_USER_IDS ?? '').split(/[\s,]+/).filter(Boolean).includes(userId)
}

export function requireDevinOrganizationAccess(userId: string) {
  if (!hasDevinOrganizationAccess(userId)) throw new Error('Devin requires organization access granted by a BeeGreat administrator.')
}
