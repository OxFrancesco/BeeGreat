import { createProvider, type Model } from '@earendil-works/pi-ai'
import { openAICompletionsApi } from '@earendil-works/pi-ai/api/openai-completions.lazy'
import { openrouterProvider } from '@earendil-works/pi-ai/providers/openrouter'
import { setProvider } from '@flue/runtime'

export const PRIVATE_OPENROUTER_PROVIDER_ID = 'openrouter-private'

const PRIVATE_ROUTING = {
  data_collection: 'deny',
  zdr: true,
} as const

export function privateOpenRouterModels(): Model<'openai-completions'>[] {
  return openrouterProvider().getModels().map((model) => ({
    ...model,
    provider: PRIVATE_OPENROUTER_PROVIDER_ID,
    compat: {
      ...model.compat,
      openRouterRouting: {
        ...model.compat?.openRouterRouting,
        ...PRIVATE_ROUTING,
      },
    },
  }))
}

/**
 * Google Workspace results may contain restricted user data. This provider
 * makes no-collection and zero-retention routing part of every request body,
 * so an account-level setting cannot accidentally weaken the guarantee.
 */
export function registerPrivateOpenRouterProvider(): void {
  const source = openrouterProvider()
  setProvider(
    createProvider({
      id: PRIVATE_OPENROUTER_PROVIDER_ID,
      name: 'OpenRouter (private)',
      baseUrl: source.baseUrl,
      auth: source.auth,
      models: privateOpenRouterModels(),
      api: openAICompletionsApi(),
    }),
  )
}
