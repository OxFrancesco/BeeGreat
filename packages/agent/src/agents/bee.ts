import { type AgentRouteHandler, defineAgent } from '@flue/runtime'
import { resolveChatGptCredential } from '../providers/chatgpt-credentials.ts'
import {
  codexProviderIdForUser,
  registerFlueCodexProvider,
} from '../providers/pi-chatgpt.ts'
import { goalsSubagent } from '../shared/goals-subagent.ts'
import { loadPowerups } from '../shared/powerups/index.ts'
import instructions from './bee.md' with { type: 'markdown' }

interface Env {
  CONVEX_URL: string
  CONVEX_SITE_URL?: string
  AGENT_CREDENTIAL_BROKER_SECRET?: string
  BRIDGE_SECRET?: string
  OPENAI_CODEX_ACCESS_TOKEN?: string
}

export const description =
  'BeeGreat voice-first personal focus agent: goals, tasks, and generated UI.'

// app.ts verifies the Clerk JWT and rejects agent ids owned by another user
// before requests reach this Flue route.
export const route: AgentRouteHandler = async (_c, next) => next()

// Bee is an orchestrator: it owns the conversation and the voice/beeui contract,
// and delegates domain work via its built-in `task` capability to specialist
// subagents — `goals` (always on) plus one subagent per enabled power-up.
export default defineAgent<Env>(async ({ id, env }) => {
  // Conversation ids are `<userId>` or `<userId>~<session>` once the user has
  // restarted the chat; specialists always key data by the bare user id.
  const userId = id.split('~')[0]
  // Opt-in power-ups: one specialist subagent each, loaded per user per message.
  const powerups = await loadPowerups(userId, env.CONVEX_URL, {
    convexSiteUrl: env.CONVEX_SITE_URL,
    credentialBrokerSecret:
      env.AGENT_CREDENTIAL_BROKER_SECRET ?? env.BRIDGE_SECRET,
  })
  const durableCredential = env.OPENAI_CODEX_ACCESS_TOKEN
    ? null
    : await resolveChatGptCredential(userId, env)
  const codexAccessToken =
    env.OPENAI_CODEX_ACCESS_TOKEN ??
    (durableCredential?.status === 'connected'
      ? durableCredential.accessToken
      : undefined)
  let model = 'openrouter/openai/gpt-5.5'
  if (codexAccessToken) {
    const providerId = await codexProviderIdForUser(userId)
    registerFlueCodexProvider(providerId, codexAccessToken)
    model = `${providerId}/gpt-5.5`
  }
  return {
    model,
    thinkingLevel: 'low',
    instructions,
    subagents: [goalsSubagent(userId, env.CONVEX_URL), ...powerups],
  }
})
