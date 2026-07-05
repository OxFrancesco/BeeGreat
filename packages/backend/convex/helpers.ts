import type { MutationCtx, QueryCtx } from './_generated/server'

/**
 * Resolves the signed-in user's stable id, or null when unauthenticated.
 * `subject` is the Clerk user id (`user_...`), which is also the agent worker's
 * instance id — both surfaces must write rows under the same id so goals,
 * projects, and tasks stay in sync between the app and the agent.
 */
export async function getUserId(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity()
  return identity?.subject ?? null
}

/** Like {@link getUserId} but throws for functions that require auth. */
export async function requireUserId(ctx: QueryCtx | MutationCtx) {
  const userId = await getUserId(ctx)
  if (!userId) {
    throw new Error('Not signed in')
  }
  return userId
}
