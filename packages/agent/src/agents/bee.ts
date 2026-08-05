'use agent'
import {
  useAgentStart,
  useModel,
  useSubagent,
  useTool,
  type AgentProps,
  type SubagentDefinition,
} from '@flue/runtime'
import {
  extend,
  getCloudflareContext,
  type CloudflareAgentLike,
} from '@flue/runtime/cloudflare'
import * as Sentry from '@sentry/cloudflare'
import {
  codexProviderIdForUser,
  registerFlueCodexProvider,
} from '../providers/pi-chatgpt.ts'
import { resolveChatGptCredential } from '../providers/chatgpt-credentials.ts'
import { goalsSubagent } from '../shared/goals-subagent.ts'
import { callFocusService } from '../shared/focus-client.ts'
import { createMindTools } from '../shared/mind-tools.ts'
import { loadBeennectorSubagent } from '../shared/beennectors/index.ts'
import { imagineSubagent } from '../shared/imagine-subagent.ts'
import {
  astroCreatorSubagent,
  type BeeSitesBucket,
} from '../shared/bee-sites/astro-creator.ts'
import {
  BEE_ORCHESTRATOR_THINKING_LEVEL,
  resolveBeeEscalationModel,
  resolveBeeOrchestratorModel,
  resolveBeeSiteCreatorModel,
} from '../shared/bee-models.ts'
import { loadPowerups } from '../shared/powerups/index.ts'
import { solEscalationSubagent } from '../shared/sol-escalation-subagent.ts'
import { createTtlCache } from '../shared/ttl-cache.ts'
import instructions from './bee.md'

export {
  BEE_ESCALATION_MODEL_ID,
  BEE_ESCALATION_THINKING_LEVEL,
  BEE_ORCHESTRATOR_MODEL_ID,
  BEE_ORCHESTRATOR_THINKING_LEVEL,
  BEE_SITE_CREATOR_MODEL_ID,
  BEE_SITE_CREATOR_THINKING_LEVEL,
  resolveBeeEscalationModel,
  resolveBeeOrchestratorModel,
  resolveBeeSiteCreatorModel,
} from '../shared/bee-models.ts'

interface Env {
  CONVEX_URL: string
  CONVEX_SITE_URL?: string
  AGENT_CREDENTIAL_BROKER_SECRET?: string
  BRIDGE_SECRET?: string
  OPENAI_CODEX_ACCESS_TOKEN?: string
  CODEX_ADAPTER_URL?: string
  CODEX_ADAPTER_SECRET?: string
  Sandbox?: unknown
  BEE_SITES_BUCKET?: BeeSitesBucket
}

/** Worker env for the current request; process.env under `flue run` and tests. */
function workerEnv(): Env {
  try {
    return getCloudflareContext().env as unknown as Env
  } catch {
    return (
      (
        globalThis as unknown as {
          process?: { env?: Env }
        }
      ).process?.env ?? ({} as Env)
    )
  }
}

type AgentWithStorage = CloudflareAgentLike & {
  ctx: { storage: { deleteAll(): Promise<void> } }
}

// The Worker calls this RPC method through the generated namespace after a
// signed-in user deletes their account. `deleteAll()` is the only Cloudflare
// operation that clears the entire Durable Object, including Flue's SQLite
// conversation stream, attachments, execution state, and alarms.
export const cloudflare = extend<AgentWithStorage>({
  base: (Base) =>
    class extends Base {
      async deleteAccountData() {
        await this.ctx.storage.deleteAll()
      }
    },
})

// Latency caches for per-message init lookups. Both are safe to reuse across
// messages: a user's IANA timezone changes rarely, and the ChatGPT credential
// carries its own expiry. Entitlement-style lookups (power-ups, Beennectors)
// refresh on every delivered message so toggles apply to the next reply.
const TIME_ZONE_TTL_MS = 10 * 60 * 1000
const timeZoneCache = createTtlCache<string>()
const chatGptCredentialCache = createTtlCache<{ accessToken: string }>()

/**
 * Per-user async init results, warmed by `useAgentStart` before each model
 * call and read synchronously by the render. Flue 2.0 renders are synchronous,
 * so the very first render of a cold isolate falls back to the defaults
 * (OpenRouter model, UTC, core subagents only); the snapshot is in place for
 * every later turn and message.
 */
type BeeSnapshot = {
  timeZone: string
  powerups: SubagentDefinition[]
  beennectors: SubagentDefinition[]
  providerId?: string
  sandboxSdk: typeof import('@cloudflare/sandbox') | null
}
const snapshots = new Map<string, BeeSnapshot>()

async function loadTimeZone(
  userId: string,
  convexUrl: string,
  focusOptions: { convexSiteUrl?: string; brokerSecret?: string },
): Promise<string> {
  const cached = timeZoneCache.get(userId)
  if (cached) return cached
  try {
    const context = await callFocusService<{
      timeZone: string
      currentTime: number
    }>(userId, convexUrl, focusOptions, 'get_context')
    timeZoneCache.set(userId, context.timeZone, TIME_ZONE_TTL_MS)
    return context.timeZone
  } catch (error) {
    Sentry.captureException(error, {
      tags: {
        service: 'agent-worker',
        operation: 'focus.get_context',
        handled: 'true',
      },
    })
    return 'UTC'
  }
}

/** Registers the user's Codex provider and returns its id, if connected. */
async function registerCodexProvider(
  userId: string,
  env: Env,
): Promise<string | undefined> {
  const localCodexAccessToken = env.OPENAI_CODEX_ACCESS_TOKEN?.trim()
  if (localCodexAccessToken) {
    const providerId = await codexProviderIdForUser(userId)
    registerFlueCodexProvider(providerId, localCodexAccessToken)
    return providerId
  }
  if (!env.CODEX_ADAPTER_URL || !env.CODEX_ADAPTER_SECRET) return undefined
  let credential = chatGptCredentialCache.get(userId)
  if (!credential) {
    const resolved = await resolveChatGptCredential(userId, env)
    if (resolved.status !== 'connected') return undefined
    credential = { accessToken: resolved.accessToken }
    // Reuse the token until shortly before its own expiry, capped at 10 min.
    const ttl = Math.min(
      Math.max(resolved.expiresAt - Date.now() - 60_000, 0),
      10 * 60 * 1000,
    )
    if (ttl > 0) chatGptCredentialCache.set(userId, credential, ttl)
  }
  const providerId = await codexProviderIdForUser(userId)
  registerFlueCodexProvider(providerId, credential.accessToken, {
    baseUrl: env.CODEX_ADAPTER_URL,
    adapterSecret: env.CODEX_ADAPTER_SECRET,
  })
  return providerId
}

/** One warm pass per delivered message; every loader fails open on its own. */
async function warmSnapshot(userId: string, env: Env): Promise<void> {
  const focusOptions = {
    convexSiteUrl: env.CONVEX_SITE_URL,
    brokerSecret: env.AGENT_CREDENTIAL_BROKER_SECRET ?? env.BRIDGE_SECRET,
  }
  // The lookups are independent; run them concurrently so warming costs one
  // round trip instead of four.
  const [timeZone, powerups, beennectors, providerId, sandboxSdk] =
    await Promise.all([
      loadTimeZone(userId, env.CONVEX_URL, focusOptions),
      // Opt-in power-ups: one specialist subagent each, loaded per user per message.
      loadPowerups(userId, env.CONVEX_URL, {
        convexSiteUrl: env.CONVEX_SITE_URL,
        credentialBrokerSecret:
          env.AGENT_CREDENTIAL_BROKER_SECRET ?? env.BRIDGE_SECRET,
      }),
      loadBeennectorSubagent(userId, env.CONVEX_URL, focusOptions),
      registerCodexProvider(userId, env).catch((error) => {
        Sentry.captureException(error, {
          tags: {
            service: 'agent-worker',
            operation: 'codex.register_provider',
            handled: 'true',
          },
        })
        return undefined
      }),
      // Keep the Cloudflare-only Sandbox module out of Bun's Node test runtime.
      env.Sandbox && env.BEE_SITES_BUCKET
        ? import('@cloudflare/sandbox')
        : Promise.resolve(null),
    ])
  snapshots.set(userId, {
    timeZone,
    powerups,
    beennectors,
    providerId,
    sandboxSdk,
  })
}

// Bee is an orchestrator: it owns the conversation and the voice/beeui contract,
// and delegates domain work via its built-in `task` capability to specialist
// subagents — goals and Imagine are always on, Beennectors are loaded when
// connected, and optional power-ups are loaded when enabled.
export function Bee({ id }: AgentProps) {
  // Conversation ids are `<userId>` or `<userId>~<session>` once the user has
  // restarted the chat; specialists always key data by the bare user id.
  const userId = id.split('~')[0]
  const env = workerEnv()
  const snapshot = snapshots.get(userId)
  const providerId = snapshot?.providerId

  useModel(resolveBeeOrchestratorModel(providerId), {
    thinkingLevel: BEE_ORCHESTRATOR_THINKING_LEVEL,
  })
  useAgentStart(async () => {
    await warmSnapshot(userId, env)
  })

  const focusOptions = {
    convexSiteUrl: env.CONVEX_SITE_URL,
    brokerSecret: env.AGENT_CREDENTIAL_BROKER_SECRET ?? env.BRIDGE_SECRET,
  }
  const mindTools = createMindTools(userId, env.CONVEX_URL, focusOptions)
  for (const tool of mindTools) useTool(tool)

  const sitesSubagents =
    snapshot?.sandboxSdk && env.Sandbox && env.BEE_SITES_BUCKET
      ? [
          astroCreatorSubagent({
            userId,
            model: resolveBeeSiteCreatorModel(providerId),
            convexUrl: env.CONVEX_URL,
            brokerSecret:
              env.AGENT_CREDENTIAL_BROKER_SECRET ?? env.BRIDGE_SECRET,
            sandbox: snapshot.sandboxSdk.getSandbox(
              env.Sandbox as Parameters<
                typeof snapshot.sandboxSdk.getSandbox
              >[0],
              `bee-sites-${userId}`,
            ),
            bucket: env.BEE_SITES_BUCKET,
          }),
        ]
      : []
  const domainSubagents = [
    goalsSubagent(userId, env.CONVEX_URL, focusOptions),
    imagineSubagent(env.CONVEX_URL, focusOptions),
    ...sitesSubagents,
    ...(snapshot?.beennectors ?? []),
    ...(snapshot?.powerups ?? []),
  ]
  for (const subagent of domainSubagents) useSubagent(subagent)
  useSubagent(
    solEscalationSubagent({
      model: resolveBeeEscalationModel(providerId),
      tools: mindTools,
      subagents: domainSubagents,
    }),
  )

  const timeZone = snapshot?.timeZone ?? 'UTC'
  return `${instructions}\n\n## User time context\nThe user's IANA timezone is ${timeZone}. The current time is ${new Date().toISOString()}. Use that timezone and an explicit UTC offset when delegating due dates or recurrence start times.`
}
Bee.agentName = 'bee'
