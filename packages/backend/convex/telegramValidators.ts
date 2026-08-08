import { v } from 'convex/values'
import { encryptedSecretValidator } from './chatgptAuthValidators'

export { encryptedSecretValidator }

export const telegramSessionStatusValidator = v.union(
  v.literal('pending'),
  v.literal('connected'),
  v.literal('failed'),
  v.literal('expired'),
  v.literal('cancelled'),
)

export const telegramCredentialStatusValidator = v.union(
  v.literal('connected'),
  v.literal('needs_reauth'),
)

export const telegramConnectionStatusValidator = v.object({
  state: v.union(
    v.literal('disconnected'),
    v.literal('pending'),
    v.literal('connected'),
    v.literal('needs_reauth'),
    v.literal('failed'),
  ),
  displayName: v.optional(v.string()),
  username: v.optional(v.string()),
  photoUrl: v.optional(v.string()),
  message: v.optional(v.string()),
})
