import { v } from 'convex/values'
import { encryptedSecretValidator } from './chatgptAuthValidators'

export { encryptedSecretValidator }

export const beennectorProviderValidator = v.union(
  v.literal('github'),
  v.literal('linear'),
  v.literal('notion'),
  v.literal('google'),
)

export const googleWorkspaceServiceValidator = v.union(
  v.literal('mail'),
  v.literal('calendar'),
  v.literal('drive'),
  v.literal('contacts'),
  v.literal('tasks'),
  v.literal('forms'),
)

export const beennectorSessionStatusValidator = v.union(
  v.literal('pending'),
  v.literal('connected'),
  v.literal('failed'),
  v.literal('expired'),
  v.literal('cancelled'),
)

export const beennectorCredentialStatusValidator = v.union(
  v.literal('connected'),
  v.literal('needs_reauth'),
)

export const beennectorConnectionStateValidator = v.union(
  v.literal('disconnected'),
  v.literal('pending'),
  v.literal('connected'),
  v.literal('needs_reauth'),
  v.literal('failed'),
)

export const beennectorConnectionValidator = v.object({
  provider: beennectorProviderValidator,
  name: v.string(),
  description: v.string(),
  state: beennectorConnectionStateValidator,
  accountName: v.optional(v.string()),
  workspaceName: v.optional(v.string()),
  message: v.optional(v.string()),
})

export const beennectorCredentialClaimValidator = v.union(
  v.object({ status: v.literal('missing') }),
  v.object({ status: v.literal('reauth') }),
  v.object({ status: v.literal('busy'), retryAfterMs: v.number() }),
  v.object({
    status: v.literal('ready'),
    encryptedAccess: encryptedSecretValidator,
  }),
  v.object({
    status: v.literal('refresh'),
    encryptedRefresh: encryptedSecretValidator,
    leaseId: v.string(),
  }),
)

export const beennectorDeliveryClaimValidator = v.union(
  v.object({ status: v.literal('accepted'), userId: v.string() }),
  v.object({ status: v.literal('duplicate') }),
  v.object({ status: v.literal('unmapped') }),
  v.object({ status: v.literal('ambiguous') }),
)

export type BeennectorProvider = 'github' | 'linear' | 'notion' | 'google'
export type GoogleWorkspaceService =
  | 'mail'
  | 'calendar'
  | 'drive'
  | 'contacts'
  | 'tasks'
  | 'forms'
