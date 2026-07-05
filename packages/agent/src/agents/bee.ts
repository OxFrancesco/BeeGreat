import { type AgentRouteHandler, defineAgent } from '@flue/runtime'
import { createBeeTools } from '../shared/bee-tools.ts'
import instructions from './bee.md' with { type: 'markdown' }

interface Env {
  CONVEX_URL: string
}

export const description =
  'BeeGreat voice-first personal focus agent: goals, tasks, and generated UI.'

// TODO(auth): verify the Clerk JWT and match it against :id before Clerk ships.
export const route: AgentRouteHandler = async (_c, next) => next()

export default defineAgent<Env>(({ id, env }) => ({
  model: 'openrouter/openai/gpt-5.5',
  thinkingLevel: 'low',
  instructions,
  // Conversation ids are `<userId>` or `<userId>~<session>` once the user has
  // restarted the chat; tools always key data by the bare user id.
  tools: createBeeTools(id.split('~')[0], env.CONVEX_URL),
}))
