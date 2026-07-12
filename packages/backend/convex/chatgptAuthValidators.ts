import { v } from 'convex/values'

export const encryptedSecretValidator = v.object({
  version: v.literal(1),
  iv: v.string(),
  ciphertext: v.string(),
  tag: v.string(),
})

export const chatgptAuthSessionStatusValidator = v.union(
  v.literal('starting'),
  v.literal('pending'),
  v.literal('connected'),
  v.literal('failed'),
  v.literal('expired'),
  v.literal('cancelled'),
)

export const chatgptCredentialStatusValidator = v.union(
  v.literal('connected'),
  v.literal('needs_reauth'),
)

export const chatgptAuthStateValidator = v.union(
  v.literal('loading'),
  v.literal('starting'),
  v.literal('pending'),
  v.literal('connected'),
  v.literal('needs_reauth'),
  v.literal('failed'),
  v.literal('disconnected'),
)

export const chatgptAuthStatusValidator = v.object({
  state: chatgptAuthStateValidator,
  // True when the user chose to skip the connect gate. Skipped users run on
  // the default OpenRouter model until they connect ChatGPT from settings.
  skipped: v.optional(v.boolean()),
  sessionId: v.optional(v.id('chatgptAuthSessions')),
  userCode: v.optional(v.string()),
  verificationUri: v.optional(v.string()),
  expiresAt: v.optional(v.number()),
  message: v.optional(v.string()),
})

export const credentialResolutionValidator = v.union(
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

export const agentCredentialResultValidator = v.union(
  v.object({ status: v.literal('missing') }),
  v.object({ status: v.literal('reauth') }),
  v.object({ status: v.literal('busy'), retryAfterMs: v.number() }),
  v.object({ status: v.literal('unavailable'), retryAfterMs: v.number() }),
  v.object({
    status: v.literal('ok'),
    accessToken: v.string(),
    expiresAt: v.number(),
  }),
)
