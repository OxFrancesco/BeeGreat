import * as Predicate from 'effect/Predicate'
import * as Result from 'effect/Result'
import * as Schema from 'effect/Schema'
import * as SchemaGetter from 'effect/SchemaGetter'

const DEVIN_API_BASE_URL = 'https://api.devin.ai/v3'
const DEVIN_REQUEST_TIMEOUT_MS = 30_000
const MAX_PULL_REQUESTS = 20
const MAX_MESSAGES = 10

export const DEVIN_SESSION_STATUSES = [
  'new',
  'claimed',
  'running',
  'exit',
  'error',
  'suspended',
  'resuming',
] as const

export type DevinSessionStatus = (typeof DEVIN_SESSION_STATUSES)[number]
export type DevinMode = 'normal' | 'fast'

export type DevinPullRequest = {
  url: string
  state?: string
}

export type DevinSession = {
  sessionId: string
  url: string
  title?: string
  status: DevinSessionStatus
  statusDetail?: string
  pullRequests: DevinPullRequest[]
  createdAt: number
  updatedAt: number
}

export type DevinMessage = {
  eventId: string
  source: 'devin' | 'user'
  message: string
  createdAt: number
}

export type DevinCreateSessionInput = {
  prompt: string
  title?: string
  repos?: string[]
  mode?: DevinMode
  maxAcuLimit?: number
}

type FetchLike = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>

const isNonEmptyString = Schema.is(Schema.NonEmptyString)
const isString = Schema.is(Schema.String)
const isUnknownArray = Schema.is(Schema.Array(Schema.Unknown))

function isHttpsUrl(text: string) {
  try {
    return new URL(text).protocol === 'https:'
  } catch {
    return false
  }
}

/**
 * Devin fills optional response fields inconsistently, so an unusable value
 * decodes to undefined instead of failing the whole payload.
 */
const LenientString = Schema.Unknown.pipe(
  Schema.decodeTo(Schema.UndefinedOr(Schema.String), {
    decode: SchemaGetter.transform((value) =>
      isNonEmptyString(value) ? value : undefined,
    ),
    encode: SchemaGetter.transform((value) => value),
  }),
)

const HttpsUrl = Schema.NonEmptyString.pipe(
  Schema.check(Schema.makeFilter(isHttpsUrl)),
)

/** Pull requests are best-effort: malformed entries are dropped, not fatal. */
const PullRequestList = Schema.Unknown.pipe(
  Schema.decodeTo(
    Schema.mutable(
      Schema.Array(
        Schema.Struct({
          url: Schema.String,
          state: Schema.optional(Schema.String),
        }),
      ),
    ),
    {
      decode: SchemaGetter.transform((value) => {
        if (!isUnknownArray(value)) return []
        return value
          .slice(0, MAX_PULL_REQUESTS)
          .flatMap((entry): DevinPullRequest[] => {
            if (!Predicate.isObject(entry)) return []
            const url =
              isNonEmptyString(entry.pr_url) && isHttpsUrl(entry.pr_url)
                ? entry.pr_url
                : undefined
            if (!url) return []
            const pullRequest: DevinPullRequest = { url }
            if (isNonEmptyString(entry.pr_state)) pullRequest.state = entry.pr_state
            return [pullRequest]
          })
      }),
      encode: SchemaGetter.transform((value) => value),
    },
  ),
)

const SessionPayload = Schema.Struct({
  session_id: Schema.NonEmptyString,
  url: HttpsUrl,
  title: Schema.optional(LenientString),
  status: Schema.Literals(DEVIN_SESSION_STATUSES),
  status_detail: Schema.optional(LenientString),
  pull_requests: Schema.optional(PullRequestList),
  created_at: Schema.Number,
  updated_at: Schema.Number,
})

type DevinSessionPayload = typeof SessionPayload.Type

/** Messages are best-effort: malformed entries are dropped, not fatal. */
const MessageList = Schema.Array(Schema.Unknown).pipe(
  Schema.decodeTo(
    Schema.mutable(
      Schema.Array(
        Schema.Struct({
          eventId: Schema.String,
          source: Schema.Literals(['devin', 'user']),
          message: Schema.String,
          createdAt: Schema.Number,
        }),
      ),
    ),
    {
      decode: SchemaGetter.transform((items) =>
        items.slice(-MAX_MESSAGES).flatMap((entry): DevinMessage[] => {
          if (!Predicate.isObject(entry)) return []
          const eventId = isNonEmptyString(entry.event_id) ? entry.event_id : undefined
          const source =
            entry.source === 'devin' || entry.source === 'user'
              ? entry.source
              : undefined
          const text = isNonEmptyString(entry.message) ? entry.message : undefined
          if (!eventId || !source || !text || !Predicate.isNumber(entry.created_at)) {
            return []
          }
          return [{ eventId, source, message: text, createdAt: entry.created_at }]
        }),
      ),
      encode: SchemaGetter.transform((value) => value),
    },
  ),
)

const MessagesPayload = Schema.Struct({
  items: MessageList,
})

const INVALID_SESSION_RESPONSE = 'Devin returned an invalid session response.'
const INVALID_MESSAGES_RESPONSE = 'Devin returned an invalid messages response.'

const decodeJson = Schema.decodeUnknownResult(Schema.fromJsonString(Schema.Unknown))

function toSession(payload: DevinSessionPayload): DevinSession {
  const session: DevinSession = {
    sessionId: payload.session_id,
    url: payload.url,
    status: payload.status,
    pullRequests: payload.pull_requests ?? [],
    createdAt: payload.created_at,
    updatedAt: payload.updated_at,
  }
  if (payload.title !== undefined) session.title = payload.title
  if (payload.status_detail !== undefined) session.statusDetail = payload.status_detail
  return session
}

function devinErrorMessage(text: string, status: number) {
  const fallback = `Devin request failed (${status}).`
  const parsed = decodeJson(text)
  if (Result.isFailure(parsed) || !Predicate.isObject(parsed.success)) return fallback
  const body = parsed.success
  const direct =
    (isNonEmptyString(body.message) ? body.message : undefined) ??
    (isNonEmptyString(body.error) ? body.error : undefined)
  if (direct) return direct.slice(0, 500)
  if (isUnknownArray(body.detail)) {
    const details = body.detail
      .flatMap((entry) => {
        const detail = Predicate.isObject(entry) ? entry : null
        return detail !== null && isString(detail.msg) ? [detail.msg] : []
      })
      .join('; ')
    if (details) return details.slice(0, 500)
  }
  return fallback
}

type DevinRequestHeaders = {
  authorization: string
  'content-type'?: string
}

type CreateSessionRequestBody = {
  prompt: string
  title?: string
  repos?: string[]
  devin_mode?: DevinMode
  max_acu_limit?: number
  resumable: boolean
  tags: string[]
}

export function createDevinClient(
  config: { apiKey: string; orgId: string },
  fetchImpl: FetchLike = fetch,
) {
  const organizationPath = `/organizations/${encodeURIComponent(config.orgId)}`

  async function request<Payload, Encoded>(
    path: string,
    payloadSchema: Schema.Codec<Payload, Encoded>,
    invalidPayloadMessage: string,
    init?: RequestInit,
  ): Promise<Payload> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), DEVIN_REQUEST_TIMEOUT_MS)
    try {
      const baseHeaders: DevinRequestHeaders = {
        authorization: `Bearer ${config.apiKey}`,
      }
      if (init?.body) baseHeaders['content-type'] = 'application/json'
      const response = await fetchImpl(`${DEVIN_API_BASE_URL}${path}`, {
        ...init,
        headers: {
          ...baseHeaders,
          ...init?.headers,
        },
        signal: controller.signal,
      })
      const text = await response.text()
      if (!response.ok) {
        throw new Error(devinErrorMessage(text, response.status))
      }
      const body = text ? decodeJson(text) : Result.succeed(null)
      if (Result.isFailure(body)) {
        throw new Error('Devin returned an invalid JSON response.')
      }
      const payload = Schema.decodeUnknownResult(payloadSchema)(body.success)
      if (Result.isFailure(payload)) throw new Error(invalidPayloadMessage)
      return payload.success
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Devin did not respond in time.')
      }
      throw error
    } finally {
      clearTimeout(timeout)
    }
  }

  return {
    async createSession(input: DevinCreateSessionInput): Promise<DevinSession> {
      const body: CreateSessionRequestBody = {
        prompt: input.prompt,
        resumable: true,
        tags: ['beegreat'],
      }
      if (input.title) body.title = input.title
      if (input.repos?.length) body.repos = input.repos
      if (input.mode) body.devin_mode = input.mode
      if (input.maxAcuLimit !== undefined) body.max_acu_limit = input.maxAcuLimit
      return toSession(
        await request(
          `${organizationPath}/sessions`,
          SessionPayload,
          INVALID_SESSION_RESPONSE,
          {
            method: 'POST',
            body: JSON.stringify(body),
          },
        ),
      )
    },

    async getSession(sessionId: string): Promise<DevinSession> {
      return toSession(
        await request(
          `${organizationPath}/sessions/${encodeURIComponent(sessionId)}`,
          SessionPayload,
          INVALID_SESSION_RESPONSE,
        ),
      )
    },

    async listMessages(sessionId: string): Promise<DevinMessage[]> {
      const payload = await request(
        `${organizationPath}/sessions/${encodeURIComponent(sessionId)}/messages`,
        MessagesPayload,
        INVALID_MESSAGES_RESPONSE,
      )
      return payload.items
    },

    async sendMessage(sessionId: string, message: string): Promise<DevinSession> {
      return toSession(
        await request(
          `${organizationPath}/sessions/${encodeURIComponent(sessionId)}/messages`,
          SessionPayload,
          INVALID_SESSION_RESPONSE,
          { method: 'POST', body: JSON.stringify({ message }) },
        ),
      )
    },
  }
}
