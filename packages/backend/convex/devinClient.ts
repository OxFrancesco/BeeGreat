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

type FetchLike = typeof fetch

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function optionalString(value: unknown) {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

function optionalHttpsUrl(value: unknown) {
  const text = optionalString(value)
  if (!text) return undefined
  try {
    return new URL(text).protocol === 'https:' ? text : undefined
  } catch {
    return undefined
  }
}

function parseSession(value: unknown): DevinSession {
  const body = record(value)
  const sessionId = optionalString(body?.session_id)
  const url = optionalHttpsUrl(body?.url)
  const status = optionalString(body?.status)
  const createdAt = body?.created_at
  const updatedAt = body?.updated_at
  if (
    !sessionId ||
    !url ||
    !status ||
    !DEVIN_SESSION_STATUSES.includes(status as DevinSessionStatus) ||
    typeof createdAt !== 'number' ||
    typeof updatedAt !== 'number'
  ) {
    throw new Error('Devin returned an invalid session response.')
  }

  const pullRequests = Array.isArray(body?.pull_requests)
    ? body.pull_requests
        .slice(0, MAX_PULL_REQUESTS)
        .flatMap((value): DevinPullRequest[] => {
          const pullRequest = record(value)
          const pullRequestUrl = optionalHttpsUrl(pullRequest?.pr_url)
          if (!pullRequestUrl) return []
          return [
            {
              url: pullRequestUrl,
              ...(optionalString(pullRequest?.pr_state)
                ? { state: optionalString(pullRequest?.pr_state) }
                : {}),
            },
          ]
        })
    : []

  return {
    sessionId,
    url,
    ...(optionalString(body?.title) ? { title: optionalString(body?.title) } : {}),
    status: status as DevinSessionStatus,
    ...(optionalString(body?.status_detail)
      ? { statusDetail: optionalString(body?.status_detail) }
      : {}),
    pullRequests,
    createdAt,
    updatedAt,
  }
}

function parseMessages(value: unknown): DevinMessage[] {
  const body = record(value)
  if (!Array.isArray(body?.items)) {
    throw new Error('Devin returned an invalid messages response.')
  }
  return body.items.slice(-MAX_MESSAGES).flatMap((value): DevinMessage[] => {
    const message = record(value)
    const eventId = optionalString(message?.event_id)
    const source = optionalString(message?.source)
    const text = optionalString(message?.message)
    const createdAt = message?.created_at
    if (
      !eventId ||
      (source !== 'devin' && source !== 'user') ||
      !text ||
      typeof createdAt !== 'number'
    ) {
      return []
    }
    return [{ eventId, source, message: text, createdAt }]
  })
}

function errorMessage(value: unknown, status: number) {
  const body = record(value)
  const direct = optionalString(body?.message) ?? optionalString(body?.error)
  if (direct) return direct.slice(0, 500)
  if (Array.isArray(body?.detail)) {
    const details = body.detail
      .flatMap((entry) => {
        const detail = record(entry)
        return typeof detail?.msg === 'string' ? [detail.msg] : []
      })
      .join('; ')
    if (details) return details.slice(0, 500)
  }
  return `Devin request failed (${status}).`
}

export function createDevinClient(
  config: { apiKey: string; orgId: string },
  fetchImpl: FetchLike = fetch,
) {
  const organizationPath = `/organizations/${encodeURIComponent(config.orgId)}`

  async function request(path: string, init?: RequestInit) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), DEVIN_REQUEST_TIMEOUT_MS)
    try {
      const response = await fetchImpl(`${DEVIN_API_BASE_URL}${path}`, {
        ...init,
        headers: {
          authorization: `Bearer ${config.apiKey}`,
          ...(init?.body ? { 'content-type': 'application/json' } : {}),
          ...init?.headers,
        },
        signal: controller.signal,
      })
      const text = await response.text()
      let body: unknown = null
      if (text) {
        try {
          body = JSON.parse(text) as unknown
        } catch {
          if (response.ok) throw new Error('Devin returned an invalid JSON response.')
        }
      }
      if (!response.ok) throw new Error(errorMessage(body, response.status))
      return body
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
    async createSession(input: {
      prompt: string
      title?: string
      repos?: string[]
      mode?: DevinMode
      maxAcuLimit?: number
    }) {
      return parseSession(
        await request(`${organizationPath}/sessions`, {
          method: 'POST',
          body: JSON.stringify({
            prompt: input.prompt,
            ...(input.title ? { title: input.title } : {}),
            ...(input.repos?.length ? { repos: input.repos } : {}),
            ...(input.mode ? { devin_mode: input.mode } : {}),
            ...(input.maxAcuLimit !== undefined
              ? { max_acu_limit: input.maxAcuLimit }
              : {}),
            resumable: true,
            tags: ['beegreat'],
          }),
        }),
      )
    },

    async getSession(sessionId: string) {
      return parseSession(
        await request(
          `${organizationPath}/sessions/${encodeURIComponent(sessionId)}`,
        ),
      )
    },

    async listMessages(sessionId: string) {
      return parseMessages(
        await request(
          `${organizationPath}/sessions/${encodeURIComponent(sessionId)}/messages`,
        ),
      )
    },

    async sendMessage(sessionId: string, message: string) {
      return parseSession(
        await request(
          `${organizationPath}/sessions/${encodeURIComponent(sessionId)}/messages`,
          { method: 'POST', body: JSON.stringify({ message }) },
        ),
      )
    },
  }
}
