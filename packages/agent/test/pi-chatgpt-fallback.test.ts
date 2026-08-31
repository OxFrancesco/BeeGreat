import { describe, expect, test } from 'bun:test'
import {
  createAssistantMessageEventStream,
  type Api,
  type AssistantMessage,
  type Context,
  type Model,
  type ProviderStreams,
  type StreamOptions,
} from '@earendil-works/pi-ai'
import {
  withOpenRouterFallback,
  type OpenRouterReroute,
} from '../src/providers/pi-chatgpt.ts'

const context: Context = {
  messages: [{ role: 'user', content: 'hi', timestamp: Date.now() }],
}

function model(provider: string, id: string): Model<Api> {
  return {
    id,
    name: id,
    api: 'openai-codex-responses',
    provider,
    baseUrl: 'https://example.test',
    reasoning: false,
    input: ['text'],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 0,
    maxTokens: 0,
  }
}

function assistantMessage(
  overrides: Partial<AssistantMessage>,
): AssistantMessage {
  return {
    role: 'assistant',
    content: [],
    api: 'openai-codex-responses',
    provider: 'openai-codex-test',
    model: 'gpt-5.6-terra',
    usage: {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
      totalTokens: 0,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
    },
    stopReason: 'stop',
    timestamp: Date.now(),
    ...overrides,
  }
}

function streamsEndingWith(
  terminal: (model: Model<Api>) => AssistantMessage,
  onCall?: (options?: StreamOptions) => void,
): ProviderStreams {
  const respond = (
    requestModel: Model<Api>,
    _: Context,
    options?: StreamOptions,
  ) => {
    onCall?.(options)
    const stream = createAssistantMessageEventStream()
    const message = terminal(requestModel)
    if (message.stopReason === 'error') {
      stream.push({ type: 'error', reason: 'error', error: message })
    } else if (message.stopReason === 'aborted') {
      stream.push({ type: 'error', reason: 'aborted', error: message })
    } else {
      stream.push({ type: 'start', partial: message })
      stream.push({ type: 'done', reason: 'stop', message })
    }
    stream.end(message)
    return stream
  }
  return { stream: respond, streamSimple: respond }
}

const codexError = streamsEndingWith(() =>
  assistantMessage({ stopReason: 'error', errorMessage: 'usage limit reached' }),
)

function openRouterReroute(
  overrides: Partial<OpenRouterReroute> = {},
  onCall?: (options?: StreamOptions) => void,
): OpenRouterReroute {
  return {
    api: streamsEndingWith(
      (requestModel) =>
        assistantMessage({
          provider: 'openrouter',
          model: requestModel.id,
          content: [{ type: 'text', text: 'rerouted' }],
        }),
      onCall,
    ),
    models: () => [model('openrouter', 'openai/gpt-5.6-terra')],
    apiKey: () => 'or-test-key',
    ...overrides,
  }
}

describe('Codex → OpenRouter inference fallback', () => {
  test('reroutes a Codex provider error to the OpenRouter twin model', async () => {
    let reroutedOptions: StreamOptions | undefined
    const api = withOpenRouterFallback(
      codexError,
      openRouterReroute({}, (options) => {
        reroutedOptions = options
      }),
    )
    const result = await api
      .stream(model('openai-codex-test', 'gpt-5.6-terra'), context, {
        headers: { 'x-flue-codex-adapter-secret': 'secret' },
      })
      .result()

    expect(result.stopReason).toBe('stop')
    expect(result.provider).toBe('openrouter')
    expect(result.model).toBe('openai/gpt-5.6-terra')
    expect(reroutedOptions?.apiKey).toBe('or-test-key')
    // The adapter secret must never be replayed against OpenRouter.
    expect(reroutedOptions?.headers).toBeUndefined()
  })

  test('keeps the Codex error when no OpenRouter key is configured', async () => {
    const api = withOpenRouterFallback(
      codexError,
      openRouterReroute({ apiKey: () => undefined }),
    )
    const result = await api
      .stream(model('openai-codex-test', 'gpt-5.6-terra'), context)
      .result()
    expect(result.stopReason).toBe('error')
    expect(result.errorMessage).toBe('usage limit reached')
  })

  test('keeps the Codex error when OpenRouter has no twin model', async () => {
    const api = withOpenRouterFallback(
      codexError,
      openRouterReroute({ models: () => [] }),
    )
    const result = await api
      .stream(model('openai-codex-test', 'gpt-5.6-terra'), context)
      .result()
    expect(result.stopReason).toBe('error')
  })

  test('never reroutes an aborted request', async () => {
    const aborted = streamsEndingWith(() =>
      assistantMessage({ stopReason: 'aborted' }),
    )
    const api = withOpenRouterFallback(aborted, openRouterReroute())
    const result = await api
      .streamSimple(model('openai-codex-test', 'gpt-5.6-terra'), context)
      .result()
    expect(result.stopReason).toBe('aborted')
  })

  test('passes successful Codex responses through untouched', async () => {
    const success = streamsEndingWith(() =>
      assistantMessage({ content: [{ type: 'text', text: 'from codex' }] }),
    )
    const api = withOpenRouterFallback(success, openRouterReroute())
    const result = await api
      .stream(model('openai-codex-test', 'gpt-5.6-terra'), context)
      .result()
    expect(result.provider).toBe('openai-codex-test')
    expect(result.stopReason).toBe('stop')
  })
})
