import { type AgentRouteHandler, defineAgent } from '@flue/runtime'
import * as Sentry from '@sentry/cloudflare'
import {
  codexProviderIdForUser,
  registerFlueCodexProvider,
} from '../providers/pi-chatgpt.ts'
import { resolveChatGptCredential } from '../providers/chatgpt-credentials.ts'
import { goalsSubagent } from '../shared/goals-subagent.ts'
import { callFocusService } from '../shared/focus-client.ts'
import { createMindTools } from '../shared/mind-tools.ts'
import { loadPowerups } from '../shared/powerups/index.ts'
import instructions from './bee.md' with { type: 'markdown' }

interface Env {
  CONVEX_URL: string
  CONVEX_SITE_URL?: string
  AGENT_CREDENTIAL_BROKER_SECRET?: string
  BRIDGE_SECRET?: string
  OPENAI_CODEX_ACCESS_TOKEN?: string
  CODEX_ADAPTER_URL?: string
  CODEX_ADAPTER_SECRET?: string
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
  const focusOptions = {
    convexSiteUrl: env.CONVEX_SITE_URL,
    brokerSecret:
      env.AGENT_CREDENTIAL_BROKER_SECRET ?? env.BRIDGE_SECRET,
  }
  const focusContext = await callFocusService<{
    timeZone: string
    currentTime: number
  }>(userId, env.CONVEX_URL, focusOptions, 'get_context').catch((error) => {
    Sentry.captureException(error, {
      tags: {
        service: 'agent-worker',
        operation: 'focus.get_context',
        handled: 'true',
      },
    })
    return {
      timeZone: 'UTC',
      currentTime: Date.now(),
    }
  })
  // Opt-in power-ups: one specialist subagent each, loaded per user per message.
  const powerups = await loadPowerups(userId, env.CONVEX_URL, {
    convexSiteUrl: env.CONVEX_SITE_URL,
    credentialBrokerSecret:
      env.AGENT_CREDENTIAL_BROKER_SECRET ?? env.BRIDGE_SECRET,
  })
  let model = 'openrouter/openai/gpt-5.6-sol'
  const localCodexAccessToken = env.OPENAI_CODEX_ACCESS_TOKEN?.trim()
  if (localCodexAccessToken) {
    const providerId = await codexProviderIdForUser(userId)
    registerFlueCodexProvider(providerId, localCodexAccessToken)
    model = `${providerId}/gpt-5.6-sol`
  } else if (env.CODEX_ADAPTER_URL && env.CODEX_ADAPTER_SECRET) {
    const credential = await resolveChatGptCredential(userId, env)
    if (credential.status === 'connected') {
      const providerId = await codexProviderIdForUser(userId)
      registerFlueCodexProvider(providerId, credential.accessToken, {
        baseUrl: env.CODEX_ADAPTER_URL,
        adapterSecret: env.CODEX_ADAPTER_SECRET,
      })
      model = `${providerId}/gpt-5.6-sol`
    }
  }
  return {
    model,
    thinkingLevel: 'low',
    instructions: `${instructions}\n\n## User time context\nThe user's IANA timezone is ${focusContext.timeZone}. The current time is ${new Date(focusContext.currentTime).toISOString()}. Use that timezone and an explicit UTC offset when delegating due dates or recurrence start times.`,
    tools: createMindTools(userId, env.CONVEX_URL, focusOptions),
    subagents: [
      goalsSubagent(userId, env.CONVEX_URL, focusOptions),
      ...powerups,
    ],
  }
})
