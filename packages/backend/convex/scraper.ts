'use node'

import Innertube, { ClientType } from 'youtubei.js'
import { v } from 'convex/values'
import * as Effect from 'effect/Effect'
import { internal } from './_generated/api'
import type { Doc } from './_generated/dataModel'
import { env, internalAction } from './_generated/server'
import {
  abortableFetch,
  DEFAULT_NETWORK_POLICY,
  failureCode,
  failureMessage,
  ProviderChainFailure,
  ProviderFailure,
  providerAttempt,
  runScraperEffect,
  type Fetcher,
  type ProviderPolicy,
  type ProviderName,
  type ProviderStage,
  type ScraperEffectFailure,
  withProviderFallback,
} from './scraperEffect'
import { normalizeLabels, truncateContent } from './scraperShared'

const MODEL = 'gpt-5.6-luna'
const OPENROUTER_MODEL = 'openai/gpt-5.6-luna'
const MAX_MODEL_CONTENT_BYTES = 96 * 1024
const MAX_AUDIO_BYTES = 30 * 1024 * 1024
const MAX_AUDIO_DURATION_SECONDS = 60 * 60
const SUMMARY_POLICY = {
  attemptTimeoutMs: 90_000,
  baseDelayMs: 0,
  maxRetries: 0,
} satisfies ProviderPolicy
const REMOTE_WORKFLOW_TIMEOUT_MS = 8 * 60_000

type BookmarkMeta = NonNullable<Doc<'bookmarks'>['meta']>

export type ScrapedBookmark = {
  title?: string
  content: string
  meta?: BookmarkMeta
  transcriptSource?: 'captions' | 'scribe'
}

export type BookmarkSummary = {
  title?: string
  summary?: string
  labels: string[]
}

export class ScraperError extends Error {
  constructor(
    readonly code:
      | 'scrape-failed'
      | 'tweet-not-found'
      | 'transcript-unavailable'
      | 'audio-too-long'
      | 'transcription-failed'
      | 'summary-failed'
      | 'unknown',
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options)
    this.name = 'ScraperError'
  }
}

class HttpStatusError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly headers: Headers,
  ) {
    super(message)
    this.name = 'HttpStatusError'
  }
}

function isScraperEffectFailure(error: unknown): error is ScraperEffectFailure {
  return error instanceof ProviderFailure || error instanceof ProviderChainFailure
}

async function runAsScraperPromise<A>(
  program: Effect.Effect<A, ScraperEffectFailure>,
) {
  try {
    return await runScraperEffect(program)
  } catch (error) {
    if (isScraperEffectFailure(error)) {
      throw new ScraperError(failureCode(error), failureMessage(error), {
        cause: error,
      })
    }
    throw error
  }
}

function convexOperation<A>(options: {
  provider: Extract<ProviderName, 'convex' | 'credential-broker'>
  stage: Extract<ProviderStage, 'auth' | 'persistence'>
  task: () => PromiseLike<A>
}) {
  return Effect.tryPromise({
    try: options.task,
    catch: (cause) =>
      new ProviderFailure({
        cause,
        code: 'unknown',
        message:
          cause instanceof Error ? cause.message : 'Convex operation failed',
        provider: options.provider,
        retryAfterMs: 0,
        retryable: false,
        stage: options.stage,
      }),
  })
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined
}

function text(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function number(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) {
    return Number(value)
  }
  return undefined
}

function timestamp(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value < 10_000_000_000 ? value * 1_000 : value
  }
  if (typeof value !== 'string') return undefined
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

async function checkedJson(response: Response, stage: string) {
  const body = (await response.json().catch(() => null)) as unknown
  if (!response.ok) {
    const message = text(record(body)?.error) ?? `${stage} failed (HTTP ${response.status})`
    throw new HttpStatusError(message, response.status, response.headers)
  }
  return body
}

export async function scrapeWebsite(
  url: string,
  options: { apiKey?: string; fetch?: Fetcher } = {},
): Promise<ScrapedBookmark> {
  const apiKey = options.apiKey?.trim()
  if (!apiKey) {
    throw new ScraperError('scrape-failed', 'Website scraping is not configured')
  }
  const response = await (options.fetch ?? fetch)('https://api.firecrawl.dev/v2/scrape', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ url, formats: ['markdown'], onlyMainContent: true }),
  })
  let payload: Record<string, unknown>
  try {
    payload = record(await checkedJson(response, 'Firecrawl')) ?? {}
  } catch (error) {
    throw new ScraperError(
      'scrape-failed',
      error instanceof Error ? error.message : 'Website scraping failed',
      { cause: error },
    )
  }
  const data = record(payload.data) ?? payload
  const metadata = record(data.metadata) ?? {}
  const content = text(data.markdown)
  if (!content) {
    throw new ScraperError('scrape-failed', 'The website returned no readable content')
  }
  const description = text(metadata.description)
  return {
    title: text(metadata.title) ?? text(metadata.ogTitle),
    content: description ? `${content}\n\n${description}` : content,
    meta: {
      siteName: text(metadata.siteName) ?? text(metadata.ogSiteName),
      author: text(metadata.author),
      imageUrl:
        text(metadata.ogImage) ??
        text(metadata.image) ??
        text(record(metadata.ogImage)?.url),
      faviconUrl: text(metadata.favicon),
      publishedAt: timestamp(metadata.publishedTime ?? metadata.publishedAt),
    },
  }
}

export async function scrapeTweet(
  tweetId: string,
  options: { apiKey?: string; fetch?: Fetcher } = {},
): Promise<ScrapedBookmark> {
  const apiKey = options.apiKey?.trim()
  if (!apiKey) {
    throw new ScraperError('scrape-failed', 'Tweet scraping is not configured')
  }
  const endpoint = new URL('https://api.twitterapi.io/twitter/tweets')
  endpoint.searchParams.set('tweet_ids', tweetId)
  const response = await (options.fetch ?? fetch)(endpoint, {
    headers: { 'X-API-Key': apiKey },
  })
  let payload: unknown
  try {
    payload = await checkedJson(response, 'Twitter API')
  } catch (error) {
    throw new ScraperError(
      response.status === 404 ? 'tweet-not-found' : 'scrape-failed',
      error instanceof Error ? error.message : 'Tweet scraping failed',
      { cause: error },
    )
  }
  const root = record(payload) ?? {}
  const candidates = [root.tweets, record(root.data)?.tweets, root.data]
  const tweet = candidates
    .flatMap((candidate) => (Array.isArray(candidate) ? candidate : [candidate]))
    .map(record)
    .find(Boolean)
  if (!tweet) throw new ScraperError('tweet-not-found', 'Tweet not found')

  const author = record(tweet.author) ?? record(tweet.user) ?? {}
  const quoted = record(tweet.quoted_tweet) ?? record(tweet.quotedTweet)
  const media = Array.isArray(tweet.media)
    ? tweet.media
    : Array.isArray(record(tweet.extendedEntities)?.media)
      ? (record(tweet.extendedEntities)?.media as unknown[])
      : []
  const firstMedia = record(media[0])
  const content = text(tweet.text ?? tweet.full_text)
  if (!content) throw new ScraperError('tweet-not-found', 'Tweet has no readable text')
  const quotedText = text(quoted?.text ?? quoted?.full_text)
  const handle = text(author.userName ?? author.username ?? author.screen_name)
  return {
    title: handle ? `@${handle}` : text(author.name),
    content: quotedText ? `${content}\n\nQuoted tweet:\n${quotedText}` : content,
    meta: {
      author: text(author.name),
      handle,
      imageUrl:
        text(firstMedia?.media_url_https ?? firstMedia?.url) ??
        text(author.profilePicture ?? author.profile_image_url_https),
      publishedAt: timestamp(tweet.createdAt ?? tweet.created_at),
      tweetId,
    },
  }
}

export async function scrapeTweetWithFallback(
  tweetId: string,
  options: {
    apiKey?: string
    effectPolicy?: ProviderPolicy
    firecrawlApiKey?: string
    fetch?: Fetcher
  } = {},
): Promise<ScrapedBookmark> {
  return await runAsScraperPromise(tweetEffect(tweetId, options))
}

function tweetEffect(
  tweetId: string,
  options: {
    apiKey?: string
    effectPolicy?: ProviderPolicy
    firecrawlApiKey?: string
    fetch?: Fetcher
  },
) {
  const fetcher = options.fetch ?? fetch
  const primary = providerAttempt({
    code: 'scrape-failed',
    policy: options.effectPolicy,
    provider: 'twitter',
    stage: 'scrape',
    task: (signal) =>
      scrapeTweet(tweetId, {
        apiKey: options.apiKey,
        fetch: abortableFetch(fetcher, signal),
      }),
  })
  if (!options.firecrawlApiKey?.trim()) return primary
  return withProviderFallback({
    code: 'scrape-failed',
    primary,
    shouldFallback: (failure) => failure.code !== 'tweet-not-found',
    fallback: () =>
      providerAttempt({
        code: 'scrape-failed',
        policy: options.effectPolicy,
        provider: 'firecrawl',
        stage: 'scrape',
        task: async (signal) => {
      const fallback = await scrapeWebsite(`https://x.com/i/status/${tweetId}`, {
        apiKey: options.firecrawlApiKey,
            fetch: abortableFetch(fetcher, signal),
      })
      return {
        ...fallback,
        meta: { ...fallback.meta, tweetId },
      }
        },
      }),
  })
}

async function streamToBytes(stream: ReadableStream<Uint8Array>) {
  const reader = stream.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    if (!value) continue
    size += value.byteLength
    if (size > MAX_AUDIO_BYTES) {
      await reader.cancel('audio-size-limit')
      throw new ScraperError(
        'transcription-failed',
        'The video audio is too large to transcribe',
      )
    }
    chunks.push(value)
  }
  const bytes = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return bytes
}

async function transcribeAudio(
  audio: Uint8Array,
  options: { apiKey?: string; fetch?: Fetcher },
) {
  const apiKey = options.apiKey?.trim()
  if (!apiKey) {
    throw new ScraperError(
      'transcript-unavailable',
      'This video has no captions and transcription is not configured',
    )
  }
  const form = new FormData()
  form.append('model_id', 'scribe_v1')
  const audioBuffer = audio.buffer.slice(
    audio.byteOffset,
    audio.byteOffset + audio.byteLength,
  ) as ArrayBuffer
  form.append(
    'file',
    new Blob([audioBuffer], { type: 'audio/mp4' }),
    'youtube-audio.m4a',
  )
  const response = await (options.fetch ?? fetch)(
    'https://api.elevenlabs.io/v1/speech-to-text',
    { method: 'POST', headers: { 'xi-api-key': apiKey }, body: form },
  )
  const payload = record(await response.json().catch(() => null))
  if (!response.ok || !text(payload?.text)) {
    const message =
      text(record(payload?.detail)?.message) ??
      `Video transcription failed (HTTP ${response.status})`
    throw new ScraperError(
      'transcription-failed',
      message,
      {
        cause: new HttpStatusError(message, response.status, response.headers),
      },
    )
  }
  return text(payload?.text)!
}

async function fetchYoutubeCaptions(
  captionTracks: Array<{
    base_url: string
    kind?: 'asr' | 'frc'
  }>,
  options: { fetch?: Fetcher },
) {
  const track =
    captionTracks.find((candidate) => candidate.kind !== 'asr') ?? captionTracks[0]
  if (!track) return undefined

  const endpoint = new URL(track.base_url)
  endpoint.searchParams.set('fmt', 'json3')
  const response = await (options.fetch ?? fetch)(endpoint)
  if (!response.ok) {
    throw new Error(`YouTube captions failed (HTTP ${response.status})`)
  }
  const payload = record(await response.json().catch(() => null))
  const events = Array.isArray(payload?.events) ? payload.events : []
  const content = events
    .flatMap((event) => {
      const segments = record(event)?.segs
      return Array.isArray(segments)
        ? segments.map((segment) => text(record(segment)?.utf8)).filter(Boolean)
        : []
    })
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
  return content || undefined
}

export async function scrapeYoutube(
  videoId: string,
  options: {
    elevenLabsApiKey?: string
    fetch?: Fetcher
    createInnertube?: typeof Innertube.create
  } = {},
): Promise<ScrapedBookmark> {
  const createInnertube = options.createInnertube ?? Innertube.create.bind(Innertube)
  try {
    const youtube = await createInnertube({
      client_type: ClientType.IOS,
      enable_session_cache: false,
      fetch: options.fetch as typeof globalThis.fetch | undefined,
      generate_session_locally: true,
      retrieve_innertube_config: false,
      retrieve_player: false,
    })
    const info = await youtube.getBasicInfo(videoId)
    const durationSeconds = number(info.basic_info.duration)
    const thumbnails = info.basic_info.thumbnail ?? []
    const largestThumbnail = [...thumbnails].sort(
      (left, right) => (right.width ?? 0) - (left.width ?? 0),
    )[0]
    const meta: BookmarkMeta = {
      author: text(info.basic_info.author ?? info.basic_info.channel?.name),
      imageUrl: text(largestThumbnail?.url),
      videoId,
      durationSeconds,
    }

    try {
      const content = await fetchYoutubeCaptions(info.captions?.caption_tracks ?? [], {
        fetch: options.fetch,
      })
      if (content) {
        return {
          title: text(info.basic_info.title),
          content,
          meta,
          transcriptSource: 'captions',
        }
      }
    } catch {
      // Captionless, blocked, or unavailable transcripts continue to Scribe.
    }

    if (durationSeconds !== undefined && durationSeconds > MAX_AUDIO_DURATION_SECONDS) {
      throw new ScraperError(
        'audio-too-long',
        'Captionless videos must be 60 minutes or shorter',
      )
    }
    const audioStream = await info.download({
      type: 'audio',
      quality: 'bestefficiency',
      format: 'mp4',
    })
    const content = await transcribeAudio(await streamToBytes(audioStream), {
      apiKey: options.elevenLabsApiKey,
      fetch: options.fetch,
    })
    return {
      title: text(info.basic_info.title),
      content,
      meta,
      transcriptSource: 'scribe',
    }
  } catch (error) {
    if (error instanceof ScraperError) throw error
    throw new ScraperError(
      'transcript-unavailable',
      error instanceof Error ? error.message : 'YouTube transcript unavailable',
      { cause: error },
    )
  }
}

export async function scrapeYoutubeWithFallback(
  videoId: string,
  options: {
    effectPolicy?: ProviderPolicy
    elevenLabsApiKey?: string
    firecrawlApiKey?: string
    fetch?: Fetcher
    createInnertube?: typeof Innertube.create
  } = {},
): Promise<ScrapedBookmark> {
  return await runAsScraperPromise(youtubeEffect(videoId, options))
}

function youtubeEffect(
  videoId: string,
  options: {
    effectPolicy?: ProviderPolicy
    elevenLabsApiKey?: string
    firecrawlApiKey?: string
    fetch?: Fetcher
    createInnertube?: typeof Innertube.create
  },
) {
  const fetcher = options.fetch ?? fetch
  const primary = providerAttempt({
    code: 'transcript-unavailable',
    policy:
      options.effectPolicy ??
      ({
        attemptTimeoutMs: 6 * 60_000,
        baseDelayMs: 0,
        maxRetries: 0,
      } satisfies ProviderPolicy),
    provider: 'youtube',
    stage: 'scrape',
    task: (signal) =>
      scrapeYoutube(videoId, {
        createInnertube: options.createInnertube,
        elevenLabsApiKey: options.elevenLabsApiKey,
        fetch: abortableFetch(fetcher, signal),
      }),
  })
  if (!options.firecrawlApiKey?.trim()) return primary
  return withProviderFallback({
    code: 'transcript-unavailable',
    primary,
    shouldFallback: (failure) => failure.code !== 'audio-too-long',
    fallback: () =>
      providerAttempt({
        code: 'transcript-unavailable',
        policy: options.effectPolicy,
        provider: 'firecrawl',
        stage: 'scrape',
        task: async (signal) => {
      const fallback = await scrapeWebsite(
        `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`,
            {
              apiKey: options.firecrawlApiKey,
              fetch: abortableFetch(fetcher, signal),
            },
      )
      return {
        ...fallback,
        meta: {
          ...fallback.meta,
          imageUrl:
            fallback.meta?.imageUrl ??
            `https://i.ytimg.com/vi/${encodeURIComponent(videoId)}/hqdefault.jpg`,
          videoId,
        },
      }
        },
      }),
  })
}

function summaryPrompt(bookmark: Doc<'bookmarks'>, scraped: ScrapedBookmark) {
  return `Summarize this saved ${bookmark.kind} for a private personal bookmark library.
Return only strict JSON with this exact shape:
{"title":"concise title","summary":"2–4 useful sentences","labels":["3–6 lowercase topical tags"]}
Use specific topical labels, never generic labels like website, tweet, or video.

URL: ${bookmark.url}
Source title: ${scraped.title ?? ''}
Content:
${truncateContent(scraped.content, MAX_MODEL_CONTENT_BYTES)}`
}

function parseSummary(value: string): BookmarkSummary {
  const fenced = value.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]
  const candidate = fenced ?? value.slice(value.indexOf('{'), value.lastIndexOf('}') + 1)
  const parsed = record(JSON.parse(candidate))
  if (!parsed) throw new Error('Model returned invalid summary JSON')
  return {
    title: text(parsed.title),
    summary: text(parsed.summary),
    labels: normalizeLabels(Array.isArray(parsed.labels) ? parsed.labels.filter((item): item is string => typeof item === 'string') : []),
  }
}

function accountIdFromToken(token: string) {
  const payload = token.split('.')[1]
  if (!payload) throw new Error('ChatGPT access token is invalid')
  const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as Record<
    string,
    unknown
  >
  const auth = record(parsed['https://api.openai.com/auth'])
  const accountId = text(auth?.chatgpt_account_id)
  if (!accountId) throw new Error('ChatGPT account id is unavailable')
  return accountId
}

function outputTextFromSse(body: string) {
  let output = ''
  for (const line of body.split(/\r?\n/)) {
    if (!line.startsWith('data:')) continue
    const data = line.slice(5).trim()
    if (!data || data === '[DONE]') continue
    const event = record(JSON.parse(data))
    if (event?.type === 'response.output_text.delta' && typeof event.delta === 'string') {
      output += event.delta
    }
  }
  return output
}

async function summarizeWithChatGpt(
  prompt: string,
  accessToken: string,
  fetcher: Fetcher,
) {
  const response = await fetcher('https://chatgpt.com/backend-api/codex/responses', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${accessToken}`,
      'chatgpt-account-id': accountIdFromToken(accessToken),
      originator: 'beegreat',
      'OpenAI-Beta': 'responses=experimental',
      accept: 'text/event-stream',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      store: false,
      stream: true,
      instructions: 'You organize a private bookmark library. Follow the requested JSON format exactly.',
      input: [{ role: 'user', content: [{ type: 'input_text', text: prompt }] }],
      reasoning: { effort: 'low', summary: 'auto' },
      text: { verbosity: 'low' },
      include: ['reasoning.encrypted_content'],
      tool_choice: 'none',
      parallel_tool_calls: false,
    }),
  })
  const body = await response.text()
  if (!response.ok) {
    throw new HttpStatusError(
      `ChatGPT summary failed (HTTP ${response.status})`,
      response.status,
      response.headers,
    )
  }
  const output = outputTextFromSse(body)
  if (!output) throw new Error('ChatGPT returned no summary')
  return parseSummary(output)
}

async function summarizeWithOpenRouter(
  prompt: string,
  apiKey: string,
  fetcher: Fetcher,
) {
  const response = await fetcher('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
      'HTTP-Referer': 'https://beegreat.app',
      'X-Title': 'BeeGreat Mind',
    },
    body: JSON.stringify({
      model: OPENROUTER_MODEL,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      reasoning: { effort: 'low' },
    }),
  })
  const payload = record(await checkedJson(response, 'OpenRouter'))
  const choices = Array.isArray(payload?.choices) ? payload.choices : []
  const content = text(record(record(choices[0])?.message)?.content)
  if (!content) throw new Error('OpenRouter returned no summary')
  return parseSummary(content)
}

export async function summarizeBookmark(
  bookmark: Doc<'bookmarks'>,
  scraped: ScrapedBookmark,
  options: {
    accessToken?: string
    effectPolicy?: ProviderPolicy
    openRouterApiKey?: string
    fetch?: Fetcher
  },
) {
  return await runAsScraperPromise(summaryEffect(bookmark, scraped, options))
}

function summaryEffect(
  bookmark: Doc<'bookmarks'>,
  scraped: ScrapedBookmark,
  options: {
    accessToken?: string
    effectPolicy?: ProviderPolicy
    openRouterApiKey?: string
    fetch?: Fetcher
  },
) {
  const prompt = summaryPrompt(bookmark, scraped)
  const fetcher = options.fetch ?? fetch
  const fallback = () =>
    providerAttempt({
      code: 'summary-failed',
      policy: options.effectPolicy ?? SUMMARY_POLICY,
      provider: 'openrouter',
      stage: 'summarize',
      task: (signal) => {
        const openRouterApiKey = options.openRouterApiKey?.trim()
        if (!openRouterApiKey) {
          throw new Error('No summary provider is configured')
        }
        return summarizeWithOpenRouter(
          prompt,
          openRouterApiKey,
          abortableFetch(fetcher, signal),
        )
      },
    })
  const accessToken = options.accessToken?.trim()
  if (!accessToken) return fallback()
  if (!options.openRouterApiKey?.trim()) {
    return providerAttempt({
      code: 'summary-failed',
      policy: options.effectPolicy ?? SUMMARY_POLICY,
      provider: 'chatgpt',
      stage: 'summarize',
      task: (signal) =>
        summarizeWithChatGpt(
          prompt,
          accessToken,
          abortableFetch(fetcher, signal),
        ),
    })
  }
  return withProviderFallback({
    code: 'summary-failed',
    primary: providerAttempt({
      code: 'summary-failed',
      policy: options.effectPolicy ?? SUMMARY_POLICY,
      provider: 'chatgpt',
      stage: 'summarize',
      task: (signal) =>
        summarizeWithChatGpt(
          prompt,
          accessToken,
          abortableFetch(fetcher, signal),
        ),
    }),
    fallback,
  })
}

export const process = internalAction({
  args: { bookmarkId: v.id('bookmarks') },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    const bookmark: Doc<'bookmarks'> | null = await ctx.runQuery(
      internal.bookmarks.getForProcessing,
      { bookmarkId: args.bookmarkId },
    )
    if (!bookmark) return null
    const claimed = await ctx.runMutation(internal.bookmarks.markProcessing, {
      bookmarkId: bookmark._id,
    })
    if (!claimed) return null

    const processing = Effect.gen(function* () {
      const credentialResult = yield* Effect.either(
        convexOperation({
          provider: 'credential-broker',
          stage: 'auth',
          task: () =>
            ctx.runAction(internal.chatgptAuthActions.resolveForAgent, {
              userId: bookmark.userId,
            }),
        }),
      )
      const accessToken =
        credentialResult._tag === 'Right' && credentialResult.right.status === 'ok'
          ? credentialResult.right.accessToken
          : undefined

      const remotePreparation = Effect.gen(function* () {
        const scraped = yield* (bookmark.kind === 'website'
          ? providerAttempt({
              code: 'scrape-failed',
              policy: DEFAULT_NETWORK_POLICY,
              provider: 'firecrawl',
              stage: 'scrape',
              task: (signal) =>
                scrapeWebsite(bookmark.url, {
                  apiKey: env.FIRECRAWL_API_KEY,
                  fetch: abortableFetch(fetch, signal),
                }),
            })
          : bookmark.kind === 'tweet'
            ? tweetEffect(bookmark.meta?.tweetId ?? '', {
                apiKey: env.TWITTERAPI_IO_API_KEY,
                firecrawlApiKey: env.FIRECRAWL_API_KEY,
              })
            : youtubeEffect(bookmark.meta?.videoId ?? '', {
                elevenLabsApiKey: env.ELEVENLABS_API_KEY,
                firecrawlApiKey: env.FIRECRAWL_API_KEY,
              }))
        const summaryResult = yield* Effect.either(
          summaryEffect(bookmark, scraped, {
            accessToken,
            openRouterApiKey: env.OPENROUTER_API_KEY,
          }),
        )
        return { scraped, summaryResult }
      }).pipe(
        Effect.timeoutFail({
          duration: REMOTE_WORKFLOW_TIMEOUT_MS,
          onTimeout: () =>
            new ProviderFailure({
              cause: new Error('Hivemind remote workflow timed out'),
              code: 'unknown',
              message: `Hivemind remote workflow timed out after ${REMOTE_WORKFLOW_TIMEOUT_MS}ms`,
              provider: 'hivemind',
              retryAfterMs: 0,
              retryable: false,
              stage: 'workflow',
            }),
        }),
      )
      const { scraped, summaryResult } = yield* remotePreparation

      yield* convexOperation({
        provider: 'convex',
        stage: 'persistence',
        task: () =>
          summaryResult._tag === 'Right'
            ? ctx.runMutation(internal.bookmarks.saveScrape, {
                bookmarkId: bookmark._id,
                title: summaryResult.right.title ?? scraped.title,
                summary: summaryResult.right.summary,
                labels: summaryResult.right.labels,
                content: scraped.content,
                meta: scraped.meta,
                transcriptSource: scraped.transcriptSource,
              })
            : ctx.runMutation(internal.bookmarks.saveScrape, {
                bookmarkId: bookmark._id,
                title: scraped.title,
                labels: [],
                content: scraped.content,
                meta: scraped.meta,
                transcriptSource: scraped.transcriptSource,
                errorCode: 'summary-failed',
                errorMessage: failureMessage(summaryResult.left),
              }),
      })
    })

    const program = processing.pipe(
      Effect.catchAll((failure) =>
        convexOperation({
          provider: 'convex',
          stage: 'persistence',
          task: () =>
            ctx.runMutation(internal.bookmarks.markFailed, {
              bookmarkId: bookmark._id,
              errorCode: failureCode(failure),
              errorMessage: failureMessage(failure),
            }),
        }).pipe(Effect.orDie),
      ),
    )

    await Effect.runPromise(program)
    return null
  },
})
