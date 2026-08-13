import { v } from 'convex/values'

export const imessageAddressKindValidator = v.union(
  v.literal('phone'),
  v.literal('email'),
)

export const imessageSessionStatusValidator = v.union(
  v.literal('pending'),
  v.literal('completed'),
  v.literal('expired'),
  v.literal('cancelled'),
)

export const imessageConnectionValidator = v.object({
  address: v.string(),
  addressKind: imessageAddressKindValidator,
  connectedAt: v.number(),
})
