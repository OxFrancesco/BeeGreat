import { registerApiProvider, registerProvider } from '@flue/runtime'
import {
  stream,
  streamSimple,
} from '@earendil-works/pi-ai/api/openai-codex-responses'

const PROVIDER = 'openai-codex'
const API = 'openai-codex-responses'
const BASE_URL = 'https://chatgpt.com/backend-api'
let apiRegistered = false

/**
 * Flue still uses pi-ai's compatibility registry, which does not load Pi's
 * OAuth credential store. Re-registering Pi's own Codex transport keeps the
 * native protocol while allowing Flue to supply Pi's refreshed access token.
 */
export function registerFlueCodexProvider(
  provider: string,
  accessToken: string,
): void {
  if (!accessToken.trim()) {
    throw new Error('OPENAI_CODEX_ACCESS_TOKEN is empty.')
  }
  if (!/^[a-z0-9-]+$/.test(provider)) {
    throw new Error('OpenAI Codex provider ids must contain only lowercase letters, numbers, and dashes.')
  }

  if (!apiRegistered) {
    registerApiProvider(
      { api: API, stream, streamSimple } as unknown as Parameters<
        typeof registerApiProvider
      >[0],
    )
    apiRegistered = true
  }
  registerProvider(provider, {
    api: API,
    baseUrl: BASE_URL,
    apiKey: accessToken,
  })
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
