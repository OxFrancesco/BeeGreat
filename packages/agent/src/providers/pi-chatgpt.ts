import {
  createProvider,
  type Api,
  type Model,
  type ProviderStreams,
} from '@earendil-works/pi-ai'
import { openAICodexResponsesApi } from '@earendil-works/pi-ai/api/openai-codex-responses.lazy'
import { OPENAI_CODEX_MODELS } from '@earendil-works/pi-ai/providers/openai-codex.models'
import { setProvider } from '@flue/runtime'

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
    (model) => ({
      ...model,
      provider,
      baseUrl,
      ...(headers ? { headers } : {}),
    }),
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
      api: codexSseApi,
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
