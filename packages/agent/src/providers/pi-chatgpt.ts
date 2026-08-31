import {
  createAssistantMessageEventStream,
  createProvider,
  type AssistantMessageEventStream,
  type Api,
  type Context,
  type Model,
  type ProviderStreams,
  type SimpleStreamOptions,
  type StreamOptions,
} from '@earendil-works/pi-ai'
import { openAICodexResponsesApi } from '@earendil-works/pi-ai/api/openai-codex-responses.lazy'
import { openAICompletionsApi } from '@earendil-works/pi-ai/api/openai-completions.lazy'
import { OPENAI_CODEX_MODELS } from '@earendil-works/pi-ai/providers/openai-codex.models'
import { openrouterProvider } from '@earendil-works/pi-ai/providers/openrouter'
import { setProvider } from '@flue/runtime'
import * as Sentry from '@sentry/cloudflare'
import { trustedCast } from '../shared/trusted-cast.ts'

const PROVIDER = 'openai-codex'
const BASE_URL = 'https://chatgpt.com/backend-api'

const codexApi = openAICodexResponsesApi()
// The Workers runtime cannot hold pi's default Codex websocket session open;
// pin every request to the SSE transport.
const codexSseApi: ProviderStreams = {
  stream: (model, context, options) =>
    codexApi.stream(model, context, { ...options, transport: 'sse' }),
  streamSimple: (model, context, options) =>
    codexApi.streamSimple(model, context, { ...options, transport: 'sse' }),
}

/** How a rerouted request reaches OpenRouter. Injectable for tests. */
export interface OpenRouterReroute {
  api: ProviderStreams
  models: () => readonly Model<Api>[]
  apiKey: () => string | undefined
}

function defaultOpenRouterReroute(): OpenRouterReroute {
  return {
    api: openAICompletionsApi(),
    models: () => openrouterProvider().getModels(),
    // Same env var flue's own openrouter provider auth resolves; available on
    // Workers through nodejs_compat's process.env.
    apiKey: () =>
      trustedCast<{ process?: { env?: Record<string, string | undefined> } }>(
        globalThis,
      ).process?.env?.OPENROUTER_API_KEY?.trim() || undefined,
  }
}

type StreamMethod = 'stream' | 'streamSimple'

/**
 * A ChatGPT/Codex subscription can fail mid-conversation for reasons the user
 * cannot see coming — exhausted credits, a 5xx from the Codex backend, an
 * adapter outage. Wrapping the Codex transport here reroutes the SAME request
 * to OpenRouter (`openai/<model-id>`, the app's default provider path) when
 * the Codex stream terminates with a provider error, so the turn completes
 * instead of surfacing a 500. Aborts never reroute.
 */
export function withOpenRouterFallback(
  primary: ProviderStreams,
  reroute: OpenRouterReroute = defaultOpenRouterReroute(),
): ProviderStreams {
  const run = (
    method: StreamMethod,
    model: Model<Api>,
    context: Context,
    options?: StreamOptions | SimpleStreamOptions,
  ): AssistantMessageEventStream => {
    const outer = createAssistantMessageEventStream()
    void (async () => {
      for await (const event of primary[method](model, context, options)) {
        if (event.type !== 'error' || event.reason !== 'error') {
          outer.push(event)
          continue
        }
        const fallbackModel = reroute
          .models()
          .find((candidate) => candidate.id === `openai/${model.id}`)
        const apiKey = reroute.apiKey()
        if (!fallbackModel || !apiKey) {
          outer.push(event)
          break
        }
        Sentry.captureMessage(
          `Codex request failed; rerouting to OpenRouter: ${event.error.errorMessage ?? 'unknown error'}`,
          {
            level: 'warning',
            tags: {
              service: 'agent-worker',
              operation: 'codex.openrouter_fallback',
              handled: 'true',
            },
          },
        )
        // The adapter-secret header must not reach OpenRouter.
        const rerouted = reroute.api[method](fallbackModel, context, {
          ...options,
          apiKey,
          headers: undefined,
        })
        for await (const retried of rerouted) outer.push(retried)
        break
      }
      outer.end()
    })()
    return outer
  }
  return {
    stream: (model, context, options) => run('stream', model, context, options),
    streamSimple: (model, context, options) =>
      run('streamSimple', model, context, options),
  }
}

/**
 * Flue 2.0 takes Pi providers directly. Registering Pi's own Codex transport
 * (catalog models + the native openai-codex-responses protocol) under a
 * per-user provider id lets Flue supply that user's refreshed access token.
 */
export function registerFlueCodexProvider(
  provider: string,
  accessToken: string,
  transport?: { baseUrl?: string; adapterSecret?: string },
): void {
  if (!accessToken.trim()) {
    throw new Error('OPENAI_CODEX_ACCESS_TOKEN is empty.')
  }
  if (!/^[a-z0-9-]+$/.test(provider)) {
    throw new Error('OpenAI Codex provider ids must contain only lowercase letters, numbers, and dashes.')
  }

  const baseUrl = transport?.baseUrl?.replace(/\/$/, '') ?? BASE_URL
  const headers = transport?.adapterSecret
    ? { 'x-flue-codex-adapter-secret': transport.adapterSecret }
    : undefined
  const models: Model<Api>[] = Object.values(OPENAI_CODEX_MODELS).map(
    (model) => {
      const entry: Model<Api> = { ...model, provider, baseUrl }
      if (headers) entry.headers = headers
      return entry
    },
  )
  setProvider(
    createProvider<Api>({
      id: provider,
      name: 'OpenAI Codex (ChatGPT)',
      baseUrl,
      auth: {
        apiKey: {
          name: 'ChatGPT access token',
          resolve: async () => ({ auth: { apiKey: accessToken, headers } }),
        },
      },
      models,
      api: withOpenRouterFallback(codexSseApi),
    }),
  )
}

export async function codexProviderIdForUser(userId: string) {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(userId),
  )
  const suffix = Array.from(new Uint8Array(digest).slice(0, 10), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('')
  return `${PROVIDER}-${suffix}`
}
