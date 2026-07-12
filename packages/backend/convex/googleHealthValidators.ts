import { v } from 'convex/values'
import { encryptedSecretValidator } from './chatgptAuthValidators'

export { encryptedSecretValidator }

export const googleHealthSessionStatusValidator = v.union(
  v.literal('pending'),
  v.literal('connected'),
  v.literal('failed'),
  v.literal('expired'),
  v.literal('cancelled'),
)

export const googleHealthCredentialStatusValidator = v.union(
  v.literal('connected'),
  v.literal('needs_reauth'),
)

export const googleHealthConnectionStatusValidator = v.object({
  state: v.union(
    v.literal('disconnected'),
    v.literal('pending'),
    v.literal('connected'),
    v.literal('needs_reauth'),
    v.literal('failed'),
  ),
  message: v.optional(v.string()),
})

export const googleHealthCredentialClaimValidator = v.union(
  v.object({ status: v.literal('missing') }),
  v.object({ status: v.literal('reauth') }),
  v.object({ status: v.literal('busy'), retryAfterMs: v.number() }),
  v.object({
    status: v.literal('ready'),
    encryptedAccess: encryptedSecretValidator,
    expiresAt: v.number(),
  }),
  v.object({
    status: v.literal('refresh'),
    encryptedRefresh: encryptedSecretValidator,
    leaseId: v.string(),
  }),
)
