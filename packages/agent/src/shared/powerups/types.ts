import type { AgentProfile } from '@flue/runtime'

/**
 * A power-up is an opt-in capability pack, loaded as a named subagent that Bee
 * (the orchestrator) can delegate to via its built-in `task` capability. The
 * subagent only exists in a session when the user has switched the power-up on
 * from their profile. The toggle lives in Convex (`powerups` table); the id
 * here must match an id in the backend's POWERUP_CATALOG.
 *
 * The profile's `description` is what Bee sees as delegation guidance, and its
 * `instructions`/`tools` are fully isolated from Bee's own prompt and history.
 *
 * Loading the subagent is UX-level gating only — the Convex functions each
 * power-up calls re-check the entitlement server-side, so a stale session
 * can never act on a power-up the user has since disabled.
 */
export interface PowerupDefinition {
  id: string
  profile: (userId: string, convexUrl: string) => AgentProfile
}
