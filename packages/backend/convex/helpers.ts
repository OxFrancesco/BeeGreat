import type { MutationCtx, QueryCtx } from './_generated/server'

/**
 * Resolves the signed-in user's stable id, or null when unauthenticated.
 * `tokenIdentifier` is the canonical identifier for auth-linked lookups.
 */
export async function getUserId(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity()
  return identity?.tokenIdentifier ?? null
}

/** Like {@link getUserId} but throws for functions that require auth. */
export async function requireUserId(ctx: QueryCtx | MutationCtx) {
  const userId = await getUserId(ctx)
  if (!userId) {
    throw new Error('Not signed in')
  }
  return userId
}
