import { type AgentRouteHandler, defineAgent } from '@flue/runtime'
import { goalsSubagent } from '../shared/goals-subagent.ts'
import { loadPowerups } from '../shared/powerups/index.ts'
import instructions from './bee.md' with { type: 'markdown' }

interface Env {
  CONVEX_URL: string
}

export const description =
  'BeeGreat voice-first personal focus agent: goals, tasks, and generated UI.'

// TODO(auth): verify the Clerk JWT and match it against :id before Clerk ships.
export const route: AgentRouteHandler = async (_c, next) => next()

// Bee is an orchestrator: it owns the conversation and the voice/beeui contract,
// and delegates domain work via its built-in `task` capability to specialist
// subagents — `goals` (always on) plus one subagent per enabled power-up.
export default defineAgent<Env>(async ({ id, env }) => {
  // Conversation ids are `<userId>` or `<userId>~<session>` once the user has
  // restarted the chat; specialists always key data by the bare user id.
  const userId = id.split('~')[0]
  // Opt-in power-ups: one specialist subagent each, loaded per user per message.
  const powerups = await loadPowerups(userId, env.CONVEX_URL)
  return {
    model: 'openrouter/openai/gpt-5.5',
    thinkingLevel: 'low',
    instructions,
    subagents: [goalsSubagent(userId, env.CONVEX_URL), ...powerups],
  }
})
