import type { AgentProfile } from '@flue/runtime'
import { ConvexHttpClient } from 'convex/browser'
import { anyApi } from 'convex/server'
import type { PowerupDefinition, PowerupRuntime } from './types.ts'
import { googleHealth } from './google-health.ts'
import { webtree } from './webtree.ts'

export type { PowerupDefinition } from './types.ts'

/** Every power-up the agent knows how to load, keyed by catalog id. */
const REGISTRY: Record<string, PowerupDefinition> = {
  [webtree.id]: webtree,
  [googleHealth.id]: googleHealth,
}

/**
 * Resolves which power-ups the user enabled (Convex `powerups` table) and
 * assembles their subagent profiles for Bee's `subagents` list. Runs on every
 * harness initialization (Flue re-runs the agent initializer per submission),
 * so toggling a power-up applies to the very next message.
 *
 * Fails open to the base agent: if Convex is unreachable the user keeps the
 * goals specialist and simply misses power-up subagents for that message.
 * Convex re-checks entitlements on every power-up call, so this is never a
 * security boundary.
 */
export async function loadPowerups(
  userId: string,
  convexUrl: string,
  runtime: PowerupRuntime = {},
): Promise<AgentProfile[]> {
  let enabledIds: string[]
  try {
    const convex = new ConvexHttpClient(convexUrl)
    enabledIds = await convex.query(anyApi.powerups.getEnabledIds, { userId })
  } catch (error) {
    console.error(
      'powerups: failed to load enabled ids, continuing without',
      error,
    )
    return []
  }

  return enabledIds
    .map((id) => REGISTRY[id])
    .filter((powerup): powerup is PowerupDefinition => powerup !== undefined)
    .map((powerup) => powerup.profile(userId, convexUrl, runtime))
}
