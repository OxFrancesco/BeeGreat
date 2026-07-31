// @vitest-environment node

import { Buffer } from 'node:buffer'
import { describe, expect, test, vi } from 'vitest'
import type { Doc } from './_generated/dataModel'
import {
  scrapeTweet,
  scrapeTweetWithFallback,
  scrapeWebsite,
  scrapeYoutube,
  scrapeYoutubeWithFallback,
  summarizeBookmark,
} from './scraper'

type Fetcher = typeof globalThis.fetch
type InnertubeFactory = NonNullable<
  NonNullable<Parameters<typeof scrapeYoutube>[1]>['createInnertube']
>

const RETRY_POLICY = {
  attemptTimeoutMs: 1_000,
  baseDelayMs: 0,
  maxRetries: 2,
} as const

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    headers: { 'content-type': 'application/json' },
    ...init,
  })
}

function asFetcher(
  implementation: (
    input: Parameters<Fetcher>[0],
    init?: Parameters<Fetcher>[1],
  ) => Promise<Response>,
) {
  return vi.fn(implementation) as unknown as Fetcher
}

function asInnertubeFactory(factory: () => Promise<unknown>) {
  return factory as unknown as InnertubeFactory
}

function bookmark(overrides: Partial<Doc<'bookmarks'>> = {}) {
  return {
    _id: 'bookmark_fixture',
    _creationTime: 1,
    ownerKey: 'issuer|user_fixture',
    userId: 'user_fixture',
    url: 'https://example.com/guide',
    normalizedUrl: 'https://example.com/guide',
    kind: 'website',
    status: 'processing',
    labels: [],
    searchText: '',
    retryCount: 0,
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  } as Doc<'bookmarks'>
}

function accessToken(accountId = 'account_fixture') {
  return [
    Buffer.from('{}').toString('base64url'),
    Buffer.from(
      JSON.stringify({
        'https://api.openai.com/auth': { chatgpt_account_id: accountId },
      }),
    ).toString('base64url'),
    'signature',
  ].join('.')
}

describe('Firecrawl website scraping', () => {
  test('sends the v2 scrape contract and maps content and metadata', async () => {
    const fetchMock = asFetcher(async () =>
      jsonResponse({
        success: true,
        data: {
          markdown: '# Useful guide',
          metadata: {
            title: 'Useful guide',
            description: 'A practical reference.',
            siteName: 'Example Docs',
            author: 'Bee Writer',
            ogImage: { url: 'https://cdn.example.com/guide.png' },
            favicon: 'https://example.com/favicon.ico',
            publishedTime: '2026-07-14T08:30:00.000Z',
          },
        },
      }),
    )

    const result = await scrapeWebsite('https://example.com/guide', {
      apiKey: 'firecrawl-secret',
      fetch: fetchMock,
    })

    expect(fetchMock).toHaveBeenCalledOnce()
    const [input, init] = vi.mocked(fetchMock).mock.calls[0]!
    expect(input).toBe('https://api.firecrawl.dev/v2/scrape')
    expect(init).toMatchObject({
      method: 'POST',
      headers: {
        authorization: 'Bearer firecrawl-secret',
        'content-type': 'application/json',
      },
    })
    expect(JSON.parse(String(init?.body))).toEqual({
      url: 'https://example.com/guide',
      formats: ['markdown'],
      onlyMainContent: true,
    })
    expect(result).toEqual({
      title: 'Useful guide',
      content: '# Useful guide\n\nA practical reference.',
      meta: {
        siteName: 'Example Docs',
        author: 'Bee Writer',
        imageUrl: 'https://cdn.example.com/guide.png',
        faviconUrl: 'https://example.com/favicon.ico',
        publishedAt: Date.parse('2026-07-14T08:30:00.000Z'),
      },
    })
  })

  test('falls back to the favicon service when Firecrawl has no favicon', async () => {
    const fetchMock = asFetcher(async () =>
      jsonResponse({
        success: true,
        data: {
          markdown: '# Useful guide',
          metadata: { title: 'Useful guide' },
        },
      }),
    )

    const result = await scrapeWebsite('https://docs.example.com/guide', {
      apiKey: 'firecrawl-secret',
      fetch: fetchMock,
    })

    expect(result.meta?.faviconUrl).toBe(
      'https://www.google.com/s2/favicons?domain=docs.example.com&sz=128',
    )
  })

  test('fails before fetching when Firecrawl is not configured', async () => {
    const fetchMock = asFetcher(async () => jsonResponse({}))

    await expect(
      scrapeWebsite('https://example.com/guide', { fetch: fetchMock }),
    ).rejects.toMatchObject({
      name: 'ScraperError',
      code: 'scrape-failed',
      message: 'Website scraping is not configured',
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  test.each([
    [502, { error: 'upstream unavailable' }, 'upstream unavailable'],
    [200, { data: { markdown: '  ' } }, 'no readable content'],
  ])(
    'maps Firecrawl HTTP %s failures to scrape-failed',
    async (status, payload, message) => {
      const fetchMock = asFetcher(async () => jsonResponse(payload, { status }))

      await expect(
        scrapeWebsite('https://example.com/guide', {
          apiKey: 'firecrawl-secret',
          fetch: fetchMock,
        }),
      ).rejects.toMatchObject({ code: 'scrape-failed' })
      await expect(
        scrapeWebsite('https://example.com/guide', {
          apiKey: 'firecrawl-secret',
          fetch: fetchMock,
        }),
      ).rejects.toThrow(message)
    },
  )
})

describe('Twitter scraping', () => {
  test('requests the tweet by id and maps quote, author, media, and timestamp', async () => {
    const fetchMock = asFetcher(async () =>
      jsonResponse({
        data: {
          tweets: [
            {
              text: 'Convex makes reactive apps feel simple.',
              createdAt: 1_721_030_400,
              author: {
                name: 'Bee Great',
                userName: 'beegreat',
                profilePicture: 'https://cdn.example.com/avatar.png',
              },
              quoted_tweet: { text: 'The original thread.' },
              media: [{ media_url_https: 'https://cdn.example.com/tweet.png' }],
            },
          ],
        },
      }),
    )

    const result = await scrapeTweet('187654321', {
      apiKey: 'twitter-secret',
      fetch: fetchMock,
    })

    const [input, init] = vi.mocked(fetchMock).mock.calls[0]!
    expect(String(input)).toBe(
      'https://api.twitterapi.io/twitter/tweets?tweet_ids=187654321',
    )
    expect(init?.headers).toEqual({ 'X-API-Key': 'twitter-secret' })
    expect(result).toEqual({
      title: '@beegreat',
      content:
        'Convex makes reactive apps feel simple.\n\nQuoted tweet:\nThe original thread.',
      meta: {
        author: 'Bee Great',
        handle: 'beegreat',
        imageUrl: 'https://cdn.example.com/tweet.png',
        faviconUrl: 'https://www.google.com/s2/favicons?domain=x.com&sz=128',
        publishedAt: 1_721_030_400_000,
        tweetId: '187654321',
      },
    })
  })

  test.each([
    [404, { error: 'deleted' }, 'tweet-not-found'],
    [503, { error: 'provider down' }, 'scrape-failed'],
  ] as const)('maps HTTP %s to %s taxonomy', async (status, payload, code) => {
    const fetchMock = asFetcher(async () => jsonResponse(payload, { status }))

    await expect(
      scrapeTweet('missing', { apiKey: 'twitter-secret', fetch: fetchMock }),
    ).rejects.toMatchObject({ code })
  })

  test('treats a successful empty response as tweet-not-found', async () => {
    const fetchMock = asFetcher(async () => jsonResponse({ data: { tweets: [] } }))

    await expect(
      scrapeTweet('missing', { apiKey: 'twitter-secret', fetch: fetchMock }),
    ).rejects.toMatchObject({
      code: 'tweet-not-found',
    })
  })

  test('falls back to Firecrawl when the Twitter provider is unavailable', async () => {
    const fetchMock = asFetcher(async (input) => {
      if (String(input).startsWith('https://api.twitterapi.io/')) {
        return jsonResponse(
          { error: 'Unauthorized', message: 'Credits is not enough' },
          { status: 402 },
        )
      }
      return jsonResponse({
        data: {
          markdown: 'A public post captured from X.',
          metadata: {
            title: 'Bee Great on X: A useful post',
            author: 'Bee Great',
          },
        },
      })
    })

    const result = await scrapeTweetWithFallback('187654321', {
      apiKey: 'twitter-secret',
      effectPolicy: RETRY_POLICY,
      firecrawlApiKey: 'firecrawl-secret',
      fetch: fetchMock,
    })

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(vi.mocked(fetchMock).mock.calls[1]?.[0]).toBe(
      'https://api.firecrawl.dev/v2/scrape',
    )
    expect(result).toMatchObject({
      title: 'Bee Great on X: A useful post',
      content: 'A public post captured from X.',
      meta: { author: 'Bee Great', tweetId: '187654321' },
    })
  })

  test('retries transient Twitter failures before considering Firecrawl', async () => {
    let twitterCalls = 0
    const fetchMock = asFetcher(async (input) => {
      if (!String(input).startsWith('https://api.twitterapi.io/')) {
        throw new Error('Firecrawl should not be called')
      }
      twitterCalls += 1
      if (twitterCalls < 3) {
        return jsonResponse({ error: 'provider down' }, { status: 503 })
      }
      return jsonResponse({
        data: {
          tweets: [
            {
              text: 'Recovered after a transient provider failure.',
              author: { userName: 'beegreat' },
            },
          ],
        },
      })
    })

    await expect(
      scrapeTweetWithFallback('187654321', {
        apiKey: 'twitter-secret',
        effectPolicy: RETRY_POLICY,
        firecrawlApiKey: 'firecrawl-secret',
        fetch: fetchMock,
      }),
    ).resolves.toMatchObject({
      title: '@beegreat',
      content: 'Recovered after a transient provider failure.',
    })
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  test('uses Firecrawl only after transient Twitter retries are exhausted', async () => {
    const endpoints: string[] = []
    const fetchMock = asFetcher(async (input) => {
      endpoints.push(String(input))
      if (String(input).startsWith('https://api.twitterapi.io/')) {
        return jsonResponse({ error: 'provider down' }, { status: 503 })
      }
      return jsonResponse({
        data: {
          markdown: 'Recovered through the website fallback.',
          metadata: { title: 'Fallback post' },
        },
      })
    })

    await expect(
      scrapeTweetWithFallback('187654321', {
        apiKey: 'twitter-secret',
        effectPolicy: RETRY_POLICY,
        firecrawlApiKey: 'firecrawl-secret',
        fetch: fetchMock,
      }),
    ).resolves.toMatchObject({
      title: 'Fallback post',
      content: 'Recovered through the website fallback.',
    })
    expect(endpoints).toHaveLength(4)
    expect(endpoints.slice(0, 3)).toSatisfy((values: string[]) =>
      values.every((value) => value.startsWith('https://api.twitterapi.io/')),
    )
    expect(endpoints[3]).toBe('https://api.firecrawl.dev/v2/scrape')
  })

  test('does not fall back for a definitive missing tweet', async () => {
    const fetchMock = asFetcher(async () =>
      jsonResponse({ error: 'deleted' }, { status: 404 }),
    )

    await expect(
      scrapeTweetWithFallback('deleted', {
        apiKey: 'twitter-secret',
        effectPolicy: RETRY_POLICY,
        firecrawlApiKey: 'firecrawl-secret',
        fetch: fetchMock,
      }),
    ).rejects.toMatchObject({ code: 'tweet-not-found' })
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  test('aborts the provider request when its Effect deadline expires', async () => {
    const request: { signal?: AbortSignal } = {}
    const fetchMock = asFetcher(
      async (_input, init) =>
        await new Promise<Response>((_resolve, reject) => {
          request.signal = init?.signal as AbortSignal
          request.signal.addEventListener('abort', () =>
            reject(request.signal?.reason),
          )
        }),
    )

    await expect(
      scrapeTweetWithFallback('slow', {
        apiKey: 'twitter-secret',
        effectPolicy: {
          attemptTimeoutMs: 10,
          baseDelayMs: 0,
          maxRetries: 0,
        },
        fetch: fetchMock,
      }),
    ).rejects.toMatchObject({
      code: 'scrape-failed',
      message: 'twitter request timed out after 10ms',
    })
    expect(request.signal?.aborted).toBe(true)
  })
})

describe('YouTube transcript and ElevenLabs seams', () => {
  test('falls back to Firecrawl when YouTube blocks the datacenter request', async () => {
    const createInnertube = vi.fn(async () => {
      throw new Error('Video is login required')
    })
    const fetchMock = asFetcher(async () =>
      jsonResponse({
        data: {
          markdown: 'Video page and transcript captured by the fallback.',
          metadata: { title: 'Fallback video', author: 'Bee Channel' },
        },
      }),
    )

    const result = await scrapeYoutubeWithFallback('blocked-video', {
      createInnertube: asInnertubeFactory(createInnertube),
      firecrawlApiKey: 'firecrawl-secret',
      fetch: fetchMock,
    })

    expect(fetchMock).toHaveBeenCalledOnce()
    expect(result).toMatchObject({
      title: 'Fallback video',
      content: 'Video page and transcript captured by the fallback.',
      meta: {
        author: 'Bee Channel',
        videoId: 'blocked-video',
        imageUrl: 'https://i.ytimg.com/vi/blocked-video/hqdefault.jpg',
      },
    })
  })

  test('uses captions without downloading audio or calling ElevenLabs', async () => {
    const download = vi.fn()
    const getBasicInfo = vi.fn(async () => ({
      basic_info: {
        title: 'Hive architecture',
        author: 'Bee Channel',
        duration: 90,
        thumbnail: [
          { url: 'https://cdn.example.com/small.jpg', width: 120 },
          { url: 'https://cdn.example.com/large.jpg', width: 1280 },
        ],
      },
      captions: {
        caption_tracks: [
          {
            base_url: 'https://www.youtube.com/api/timedtext?v=video-captions',
            kind: 'asr',
          },
          {
            base_url:
              'https://www.youtube.com/api/timedtext?v=video-captions&lang=en',
          },
        ],
      },
      download,
    }))
    const createInnertube = vi.fn(async () => ({ getBasicInfo }))
    const fetchMock = asFetcher(async (input) => {
      const endpoint = new URL(String(input))
      expect(endpoint.searchParams.get('v')).toBe('video-captions')
      expect(endpoint.searchParams.get('lang')).toBe('en')
      expect(endpoint.searchParams.get('fmt')).toBe('json3')
      return jsonResponse({
        events: [
          { segs: [{ utf8: 'First caption.' }] },
          { segs: [{ utf8: 'Second\ncaption.' }] },
        ],
      })
    })

    const result = await scrapeYoutube('video-captions', {
      createInnertube: asInnertubeFactory(createInnertube),
      fetch: fetchMock,
      elevenLabsApiKey: 'eleven-secret',
    })

    expect(createInnertube).toHaveBeenCalledWith({
      client_type: 'iOS',
      enable_session_cache: false,
      fetch: fetchMock,
      generate_session_locally: true,
      retrieve_innertube_config: false,
      retrieve_player: false,
    })
    expect(getBasicInfo).toHaveBeenCalledWith('video-captions')
    expect(download).not.toHaveBeenCalled()
    expect(fetchMock).toHaveBeenCalledOnce()
    expect(result).toEqual({
      title: 'Hive architecture',
      content: 'First caption. Second caption.',
      meta: {
        author: 'Bee Channel',
        imageUrl: 'https://cdn.example.com/large.jpg',
        faviconUrl:
          'https://www.google.com/s2/favicons?domain=www.youtube.com&sz=128',
        videoId: 'video-captions',
        durationSeconds: 90,
      },
      transcriptSource: 'captions',
    })
  })

  test('downloads audio and sends multipart Scribe input when captions fail', async () => {
    const audio = new Uint8Array([11, 22, 33, 44])
    const download = vi.fn(async () =>
      new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(audio)
          controller.close()
        },
      }),
    )
    const getBasicInfo = vi.fn(async () => ({
      basic_info: {
        title: 'Captionless guide',
        channel: { name: 'Fallback Channel' },
        duration: '600',
        thumbnail: [],
      },
      captions: { caption_tracks: [] },
      download,
    }))
    const createInnertube = vi.fn(async () => ({ getBasicInfo }))
    const fetchMock = asFetcher(async (_input, init) => {
      expect(init?.headers).toEqual({ 'xi-api-key': 'eleven-secret' })
      expect(init?.body).toBeInstanceOf(FormData)
      const form = init?.body as FormData
      expect(form.get('model_id')).toBe('scribe_v1')
      const file = form.get('file')
      expect(file).toBeInstanceOf(File)
      expect((file as File).name).toBe('youtube-audio.m4a')
      expect((file as File).type).toBe('audio/mp4')
      expect(new Uint8Array(await (file as File).arrayBuffer())).toEqual(audio)
      return jsonResponse({ text: 'Transcript from ElevenLabs.' })
    })

    const result = await scrapeYoutube('video-scribe', {
      createInnertube: asInnertubeFactory(createInnertube),
      fetch: fetchMock,
      elevenLabsApiKey: 'eleven-secret',
    })

    expect(download).toHaveBeenCalledWith({
      type: 'audio',
      quality: 'bestefficiency',
      format: 'mp4',
    })
    const [endpoint, init] = vi.mocked(fetchMock).mock.calls[0]!
    expect(endpoint).toBe('https://api.elevenlabs.io/v1/speech-to-text')
    expect(init?.method).toBe('POST')
    expect(result).toMatchObject({
      title: 'Captionless guide',
      content: 'Transcript from ElevenLabs.',
      transcriptSource: 'scribe',
      meta: {
        author: 'Fallback Channel',
        durationSeconds: 600,
        videoId: 'video-scribe',
      },
    })
  })

  test('rejects overlong captionless videos before audio download', async () => {
    const download = vi.fn()
    const getBasicInfo = vi.fn(async () => ({
      basic_info: { title: 'Long video', duration: 3_601, thumbnail: [] },
      captions: { caption_tracks: [] },
      download,
    }))
    const createInnertube = vi.fn(async () => ({ getBasicInfo }))

    await expect(
      scrapeYoutube('video-long', {
        createInnertube: asInnertubeFactory(createInnertube),
        elevenLabsApiKey: 'eleven-secret',
      }),
    ).rejects.toMatchObject({
      code: 'audio-too-long',
    })
    expect(download).not.toHaveBeenCalled()
  })

  test('reports transcript-unavailable when captions fail and Scribe is not configured', async () => {
    const getBasicInfo = vi.fn(async () => ({
      basic_info: { title: 'No transcript', duration: 60, thumbnail: [] },
      captions: { caption_tracks: [] },
      download: vi.fn(async () =>
        new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(new Uint8Array([1]))
            controller.close()
          },
        }),
      ),
    }))
    const createInnertube = vi.fn(async () => ({ getBasicInfo }))

    await expect(
      scrapeYoutube('video-no-transcript', {
        createInnertube: asInnertubeFactory(createInnertube),
      }),
    ).rejects.toMatchObject({
      code: 'transcript-unavailable',
      message: 'This video has no captions and transcription is not configured',
    })
  })
})

describe('summary provider fallback', () => {
  test('prefers ChatGPT subscription credentials and parses streamed JSON', async () => {
    const token = accessToken('account-primary')
    const modelJson = JSON.stringify({
      title: 'Reactive Convex',
      summary: 'A concise guide to reactive application architecture.',
      labels: ['Convex', 'TypeScript', 'convex'],
    })
    const sse = [
      `data: ${JSON.stringify({ type: 'response.output_text.delta', delta: modelJson })}`,
      'data: [DONE]',
      '',
    ].join('\n')
    const fetchMock = asFetcher(async () =>
      new Response(sse, {
        status: 200,
        headers: { 'content-type': 'text/event-stream' },
      }),
    )

    const result = await summarizeBookmark(
      bookmark(),
      { title: 'Source title', content: 'Source content' },
      {
        accessToken: token,
        openRouterApiKey: 'unused-fallback',
        fetch: fetchMock,
      },
    )

    expect(fetchMock).toHaveBeenCalledOnce()
    const [endpoint, init] = vi.mocked(fetchMock).mock.calls[0]!
    expect(endpoint).toBe('https://chatgpt.com/backend-api/codex/responses')
    expect(init?.headers).toMatchObject({
      authorization: `Bearer ${token}`,
      'chatgpt-account-id': 'account-primary',
      'content-type': 'application/json',
    })
    expect(JSON.parse(String(init?.body))).toMatchObject({
      model: 'gpt-5.6-luna',
      stream: true,
      store: false,
    })
    expect(result).toEqual({
      title: 'Reactive Convex',
      summary: 'A concise guide to reactive application architecture.',
      labels: ['convex', 'typescript'],
    })
  })

  test('falls back from a failed ChatGPT request to OpenRouter', async () => {
    const token = accessToken()
    const fetchMock = asFetcher(async (input) => {
      if (String(input).includes('chatgpt.com')) {
        return jsonResponse({ error: 'subscription unavailable' }, { status: 503 })
      }
      return jsonResponse({
        choices: [
          {
            message: {
              content: JSON.stringify({
                title: 'Fallback title',
                summary: 'The OpenRouter fallback completed the summary.',
                labels: ['agents', 'bookmarks', 'research'],
              }),
            },
          },
        ],
      })
    })

    const result = await summarizeBookmark(
      bookmark({ kind: 'tweet', url: 'https://x.com/i/status/1' }),
      { content: 'A saved tweet about research agents.' },
      {
        accessToken: token,
        openRouterApiKey: 'openrouter-secret',
        fetch: fetchMock,
      },
    )

    expect(fetchMock).toHaveBeenCalledTimes(2)
    const [fallbackEndpoint, fallbackInit] = vi.mocked(fetchMock).mock.calls[1]!
    expect(fallbackEndpoint).toBe(
      'https://openrouter.ai/api/v1/chat/completions',
    )
    expect(fallbackInit?.headers).toMatchObject({
      authorization: 'Bearer openrouter-secret',
      'HTTP-Referer': 'https://beegreat.app',
      'X-Title': 'BeeGreat Mind',
    })
    expect(JSON.parse(String(fallbackInit?.body))).toMatchObject({
      model: 'openai/gpt-5.6-luna',
      response_format: { type: 'json_object' },
    })
    expect(result).toEqual({
      title: 'Fallback title',
      summary: 'The OpenRouter fallback completed the summary.',
      labels: ['agents', 'bookmarks', 'research'],
    })
  })

  test('uses OpenRouter directly without a subscription token', async () => {
    const fetchMock = asFetcher(async () =>
      jsonResponse({
        choices: [
          {
            message: {
              content:
                '```json\n{"summary":"Direct fallback.","labels":["mind"]}\n```',
            },
          },
        ],
      }),
    )

    await expect(
      summarizeBookmark(bookmark(), { content: 'Saved content' }, {
        openRouterApiKey: 'openrouter-secret',
        fetch: fetchMock,
      }),
    ).resolves.toEqual({
      title: undefined,
      summary: 'Direct fallback.',
      labels: ['mind'],
    })
    expect(String(vi.mocked(fetchMock).mock.calls[0]?.[0])).toContain('openrouter.ai')
  })

  test('surfaces provider exhaustion so the pipeline can save degraded scrape data', async () => {
    const fetchMock = asFetcher(async () =>
      jsonResponse({ error: 'provider unavailable' }, { status: 503 }),
    )

    await expect(
      summarizeBookmark(bookmark(), { content: 'Saved content' }, {
        accessToken: accessToken(),
        openRouterApiKey: 'openrouter-secret',
        fetch: fetchMock,
      }),
    ).rejects.toThrow('provider unavailable')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  test('does not fetch when no summary provider is configured', async () => {
    const fetchMock = asFetcher(async () => jsonResponse({}))

    await expect(
      summarizeBookmark(bookmark(), { content: 'Saved content' }, {
        fetch: fetchMock,
      }),
    ).rejects.toThrow('No summary provider is configured')
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
