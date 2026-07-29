export const FAL_MEDIA_OPERATIONS = [
  'generate_image',
  'edit_image',
  'generate_video',
  'edit_video',
] as const

export type FalMediaOperation = (typeof FAL_MEDIA_OPERATIONS)[number]

export type FalMediaRequest = {
  operation: FalMediaOperation
  prompt: string
  sourceUrl?: string
}

export type FalMediaResult = {
  operation: FalMediaOperation
  kind: 'image' | 'video'
  url: string
  requestId: string
}

export type FalMediaModels = Record<FalMediaOperation, string>

export const DEFAULT_FAL_MEDIA_MODELS: FalMediaModels = {
  generate_image: 'openai/gpt-image-2',
  edit_image: 'openai/gpt-image-2/edit',
  generate_video: 'fal-ai/kling-video/v3/pro/text-to-video',
  edit_video: 'fal-ai/kling-video/o3/standard/video-to-video/edit',
}

const FAL_QUEUE_ORIGIN = 'https://queue.fal.run'
const REQUEST_TIMEOUT_MS = 30_000
const MAX_WAIT_MS = 9 * 60_000
const MODEL_PATTERN =
  /^[A-Za-z0-9][A-Za-z0-9._-]*(?:\/[A-Za-z0-9][A-Za-z0-9._-]*)+$/

type FetchImplementation = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>

type FalMediaClientOptions = {
  credentials: string
  models?: Partial<FalMediaModels>
  fetchImpl?: FetchImplementation
  sleep?: (milliseconds: number) => Promise<void>
  maxWaitMs?: number
  now?: () => number
}

type QueueSubmission = {
  request_id?: unknown
  status_url?: unknown
  response_url?: unknown
}

type QueueStatus = {
  status?: unknown
}

function operationKind(operation: FalMediaOperation): 'image' | 'video' {
  return operation.endsWith('image') ? 'image' : 'video'
}

function normalizeCredentials(value: string) {
  const credentials = value.trim().replace(/^Key\s+/i, '')
  if (!credentials) throw new Error('FAL credentials are not configured in Convex.')
  return credentials
}

function normalizeModel(value: string, operation: FalMediaOperation) {
  const model = value.trim()
  if (!MODEL_PATTERN.test(model)) {
    throw new Error(`The configured FAL model for ${operation} is invalid.`)
  }
  return model
}

function normalizePrompt(value: string) {
  const prompt = value.trim()
  if (!prompt || prompt.length > 20_000) {
    throw new Error('The media prompt must be between 1 and 20,000 characters.')
  }
  return prompt
}

function normalizeSourceUrl(value: string | undefined, operation: FalMediaOperation) {
  const needsSource = operation === 'edit_image' || operation === 'edit_video'
  if (!needsSource) {
    if (value !== undefined) {
      throw new Error('A source URL is only accepted for media editing.')
    }
    return undefined
  }
  if (!value || value.length > 8_192) {
    throw new Error('A public HTTPS source URL is required for media editing.')
  }
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new Error('A valid public HTTPS source URL is required for media editing.')
  }
  if (
    url.protocol !== 'https:' ||
    url.username !== '' ||
    url.password !== '' ||
    !url.hostname
  ) {
    throw new Error('A valid public HTTPS source URL is required for media editing.')
  }
  return url.toString()
}

function requestInput(request: FalMediaRequest) {
  const prompt = normalizePrompt(request.prompt)
  const sourceUrl = normalizeSourceUrl(request.sourceUrl, request.operation)
  if (request.operation === 'edit_image') {
    return { prompt, image_urls: [sourceUrl!] }
  }
  if (request.operation === 'edit_video') {
    return { prompt, video_url: sourceUrl! }
  }
  return { prompt }
}

function queueUrl(model: string) {
  return `${FAL_QUEUE_ORIGIN}/${model}`
}

function queueRequestUrl(model: string, requestId: string) {
  return `${queueUrl(model)}/requests/${encodeURIComponent(requestId)}`
}

function expectedQueueUrl(
  candidate: unknown,
  expected: string,
  label: string,
) {
  if (typeof candidate !== 'string') return expected
  let url: URL
  try {
    url = new URL(candidate)
  } catch {
    throw new Error(`FAL returned an invalid ${label} URL.`)
  }
  if (url.origin !== FAL_QUEUE_ORIGIN || url.toString() !== expected) {
    throw new Error(`FAL returned an unexpected ${label} URL.`)
  }
  return url.toString()
}

async function responseJson(response: Response, fallback: string) {
  const payload = (await response.json().catch(() => null)) as unknown
  if (!response.ok) {
    const detail =
      payload &&
      typeof payload === 'object' &&
      'detail' in payload &&
      typeof payload.detail === 'string'
        ? ` ${payload.detail}`
        : ''
    throw new Error(`${fallback} FAL returned HTTP ${response.status}.${detail}`)
  }
  return payload
}

function objectAt(value: unknown, key: string): unknown {
  return value && typeof value === 'object' && key in value
    ? (value as Record<string, unknown>)[key]
    : undefined
}

function firstItem(value: unknown): unknown {
  return Array.isArray(value) ? value[0] : undefined
}

function mediaCandidate(payload: unknown, kind: 'image' | 'video') {
  const data = objectAt(payload, 'data') ?? payload
  if (kind === 'image') {
    return (
      objectAt(firstItem(objectAt(data, 'images')), 'url') ??
      objectAt(objectAt(data, 'image'), 'url') ??
      objectAt(objectAt(data, 'output'), 'url') ??
      objectAt(data, 'url')
    )
  }
  return (
    objectAt(objectAt(data, 'video'), 'url') ??
    objectAt(firstItem(objectAt(data, 'videos')), 'url') ??
    objectAt(objectAt(data, 'output'), 'url') ??
    objectAt(data, 'url')
  )
}

export function extractFalMediaUrl(payload: unknown, kind: 'image' | 'video') {
  const candidate = mediaCandidate(payload, kind)
  if (typeof candidate !== 'string' || candidate.length > 8_192) {
    throw new Error(`FAL completed without a usable ${kind} URL.`)
  }
  let url: URL
  try {
    url = new URL(candidate)
  } catch {
    throw new Error(`FAL completed without a usable ${kind} URL.`)
  }
  if (url.protocol !== 'https:' || url.username || url.password || !url.hostname) {
    throw new Error(`FAL completed without a usable ${kind} URL.`)
  }
  return url.toString()
}

export function createFalMediaClient(options: FalMediaClientOptions) {
  const credentials = normalizeCredentials(options.credentials)
  const fetchImpl = options.fetchImpl ?? fetch
  const sleep =
    options.sleep ??
    ((milliseconds: number) =>
      new Promise<void>((resolve) => setTimeout(resolve, milliseconds)))
  const now = options.now ?? Date.now
  const maxWaitMs = options.maxWaitMs ?? MAX_WAIT_MS
  const models = Object.fromEntries(
    FAL_MEDIA_OPERATIONS.map((operation) => [
      operation,
      normalizeModel(
        options.models?.[operation] ?? DEFAULT_FAL_MEDIA_MODELS[operation],
        operation,
      ),
    ]),
  ) as FalMediaModels

  const request = async (
    url: string,
    init?: RequestInit,
    fallback = 'FAL request failed.',
  ) => {
    const response = await fetchImpl(url, {
      ...init,
      redirect: 'error',
      headers: {
        accept: 'application/json',
        authorization: `Key ${credentials}`,
        ...init?.headers,
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
    return await responseJson(response, fallback)
  }

  return {
    async generate(mediaRequest: FalMediaRequest): Promise<FalMediaResult> {
      const model = models[mediaRequest.operation]
      const submissionPayload = (await request(
        queueUrl(model),
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(requestInput(mediaRequest)),
        },
        'FAL could not start media generation.',
      )) as QueueSubmission
      const requestId = submissionPayload.request_id
      if (
        typeof requestId !== 'string' ||
        !requestId ||
        requestId.length > 512
      ) {
        throw new Error('FAL did not return a valid request id.')
      }
      const resultUrl = queueRequestUrl(model, requestId)
      const statusUrl = expectedQueueUrl(
        submissionPayload.status_url,
        `${resultUrl}/status`,
        'status',
      )
      expectedQueueUrl(submissionPayload.response_url, resultUrl, 'result')

      const startedAt = now()
      let pollCount = 0
      while (true) {
        const statusPayload = (await request(
          statusUrl,
          undefined,
          'FAL status check failed.',
        )) as QueueStatus
        if (statusPayload.status === 'COMPLETED') break
        if (
          statusPayload.status !== 'IN_QUEUE' &&
          statusPayload.status !== 'IN_PROGRESS'
        ) {
          throw new Error('FAL returned an unexpected queue status.')
        }
        if (now() - startedAt >= maxWaitMs) {
          throw new Error('FAL media generation timed out before completion.')
        }
        pollCount += 1
        await sleep(Math.min(1_000 * 2 ** Math.min(pollCount - 1, 3), 10_000))
      }

      const payload = await request(
        resultUrl,
        undefined,
        'FAL result download failed.',
      )
      const kind = operationKind(mediaRequest.operation)
      return {
        operation: mediaRequest.operation,
        kind,
        url: extractFalMediaUrl(payload, kind),
        requestId,
      }
    },
  }
}
