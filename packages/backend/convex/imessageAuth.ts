import { v } from 'convex/values'
import { internal } from './_generated/api'
import { action } from './_generated/server'
import { imessageAddressKindValidator } from './imessageValidators'

/** Tokens are hashed before lookup so the raw value never touches storage. */
export async function hashImessageToken(token: string) {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(token),
  )
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('')
}

const linkPreviewValidator = v.union(
  v.null(),
  v.object({
    maskedAddress: v.string(),
    addressKind: imessageAddressKindValidator,
    status: v.string(),
    expiresAt: v.number(),
  }),
)

/** Lets the web link page show which address a magic link binds before sign-in. */
export const previewLink = action({
  args: { token: v.string() },
  returns: linkPreviewValidator,
  handler: async (
    ctx,
    args,
  ): Promise<{
    maskedAddress: string
    addressKind: 'phone' | 'email'
    status: string
    expiresAt: number
  } | null> => {
    if (!args.token.trim()) return null
    return await ctx.runQuery(internal.imessage.getLinkSessionByTokenHash, {
      tokenHash: await hashImessageToken(args.token.trim()),
    })
  },
})

/** Binds the magic link's iMessage address to the signed-in user. */
export const completeLink = action({
  args: { token: v.string() },
  returns: v.object({
    status: v.union(
      v.literal('linked'),
      v.literal('invalid'),
      v.literal('expired'),
    ),
    maskedAddress: v.optional(v.string()),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{
    status: 'linked' | 'invalid' | 'expired'
    maskedAddress?: string
  }> => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error('Not signed in')
    if (!args.token.trim()) return { status: 'invalid' }
    return await ctx.runMutation(internal.imessage.completeLinkSession, {
      tokenHash: await hashImessageToken(args.token.trim()),
      userId: identity.subject,
    })
  },
})
