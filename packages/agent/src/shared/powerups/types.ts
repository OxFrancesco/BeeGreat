import type { ToolDefinition } from '@flue/runtime'

/**
 * A power-up is an opt-in capability pack: extra tools (and optional extra
 * instructions) that are only loaded into Bee when the user has switched the
 * power-up on from their profile. The toggle lives in Convex (`powerups`
 * table); the id here must match an id in the backend's POWERUP_CATALOG.
 *
 * Loading the tools is UX-level gating only — the Convex functions each
 * power-up calls re-check the entitlement server-side, so a stale session
 * can never act on a power-up the user has since disabled.
 */
export interface PowerupDefinition {
  id: string
  /** Appended to the agent's base instructions when the power-up is enabled. */
  instructions?: string
  tools: (userId: string, convexUrl: string) => ToolDefinition[]
}
