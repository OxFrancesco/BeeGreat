import type { ToolDefinition } from '@flue/runtime'
import { ConvexHttpClient } from 'convex/browser'
import { anyApi } from 'convex/server'
import type { PowerupDefinition } from './types.ts'
import { webtree } from './webtree.ts'

export type { PowerupDefinition } from './types.ts'

/** Every power-up the agent knows how to load, keyed by catalog id. */
const REGISTRY: Record<string, PowerupDefinition> = {
  [webtree.id]: webtree,
}

export interface LoadedPowerups {
  tools: ToolDefinition[]
  /** One instruction block per enabled power-up, ready to append to the base prompt. */
  instructions: string[]
}

/**
 * Resolves which power-ups the user enabled (Convex `powerups` table) and
 * assembles their tool bundles + instruction blocks. Runs on every harness
 * initialization, so toggling a power-up applies to new sessions immediately.
 *
 * Fails open to the base agent: if Convex is unreachable the user keeps
 * goals/tasks and simply misses power-up tools for that session. Convex
 * re-checks entitlements on every power-up call, so this is never a
 * security boundary.
 */
export async function loadPowerups(userId: string, convexUrl: string): Promise<LoadedPowerups> {
  const loaded: LoadedPowerups = { tools: [], instructions: [] }
  let enabledIds: string[]
  try {
    const convex = new ConvexHttpClient(convexUrl)
    enabledIds = await convex.query(anyApi.powerups.getEnabledIds, { userId })
  } catch (error) {
    console.error('powerups: failed to load enabled ids, continuing without', error)
    return loaded
  }

  for (const id of enabledIds) {
    const powerup = REGISTRY[id]
    if (!powerup) continue
    loaded.tools.push(...powerup.tools(userId, convexUrl))
    if (powerup.instructions) loaded.instructions.push(powerup.instructions)
  }
  return loaded
}
