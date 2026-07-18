export const MAX_CONTENT_BYTES = 64 * 1024
export const MAX_SEARCH_TEXT_BYTES = 32 * 1024
export const MAX_NOTE_BYTES = 4 * 1024
export const MAX_LABELS = 12
export const MAX_LABEL_BYTES = 40

export type BookmarkKind = 'website' | 'tweet' | 'youtube'

export type DetectedBookmark =
  | { kind: 'tweet'; tweetId: string }
  | { kind: 'youtube'; videoId: string }
  | { kind: 'website' }

const TRACKING_PARAMETERS = new Set([
  'fbclid',
  'gclid',
  'dclid',
  'msclkid',
  'mc_cid',
  'mc_eid',
  'igshid',
  'ref_src',
  'ref_url',
  'si',
  'spm',
  'feature',
])

export class BookmarkUrlError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'BookmarkUrlError'
  }
}

function parsedHttpUrl(value: string) {
  const trimmed = value.trim()
  const hasScheme = /^[a-z][a-z\d+.-]*:/i.test(trimmed)
  const candidate = trimmed.startsWith('//')
    ? `https:${trimmed}`
    : hasScheme
      ? trimmed
      : `https://${trimmed}`
  let url: URL
  try {
    url = new URL(candidate)
  } catch {
    throw new BookmarkUrlError('Enter a valid website URL')
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new BookmarkUrlError('Mind only accepts http or https links')
  }
  return url
}

/** Adds HTTPS when the user supplies a bare domain or domain/path. */
export function completeBookmarkUrl(value: string) {
  return parsedHttpUrl(value).toString()
}

function normalizedHost(url: URL) {
  return url.hostname.toLowerCase().replace(/^www\./, '')
}

export function detectBookmarkKind(value: string): DetectedBookmark {
  const url = parsedHttpUrl(value)
  const host = normalizedHost(url)

  if (host === 'x.com' || host === 'twitter.com') {
    const match = url.pathname.match(/^\/[^/]+\/status\/(\d+)(?:\/|$)/i)
    if (match) return { kind: 'tweet', tweetId: match[1] }
  }

  if (host === 'youtu.be') {
    const videoId = url.pathname.split('/').filter(Boolean)[0]
    if (videoId) return { kind: 'youtube', videoId }
  }
  if (host === 'youtube.com' || host.endsWith('.youtube.com')) {
    const pathMatch = url.pathname.match(/^\/(?:shorts|live)\/([^/?#]+)/i)
    const videoId =
      url.pathname === '/watch' ? url.searchParams.get('v') : pathMatch?.[1]
    if (videoId) return { kind: 'youtube', videoId }
  }

  return { kind: 'website' }
}

export function normalizeBookmarkUrl(value: string) {
  const detected = detectBookmarkKind(value)
  if (detected.kind === 'tweet') {
    return `https://x.com/i/status/${detected.tweetId}`
  }
  if (detected.kind === 'youtube') {
    return `https://www.youtube.com/watch?v=${encodeURIComponent(detected.videoId)}`
  }

  const url = parsedHttpUrl(value)
  url.hostname = url.hostname.toLowerCase()
  url.hash = ''
  for (const key of [...url.searchParams.keys()]) {
    if (key.toLowerCase().startsWith('utm_') || TRACKING_PARAMETERS.has(key.toLowerCase())) {
      url.searchParams.delete(key)
    }
  }
  url.searchParams.sort()
  if (
    (url.protocol === 'https:' && url.port === '443') ||
    (url.protocol === 'http:' && url.port === '80')
  ) {
    url.port = ''
  }
  return url.toString()
}

export function truncateContent(value: string, maxBytes: number) {
  if (!Number.isFinite(maxBytes) || maxBytes <= 0) return ''
  const encoder = new TextEncoder()
  if (encoder.encode(value).byteLength <= maxBytes) return value

  let bytes = 0
  let result = ''
  for (const character of value) {
    const size = encoder.encode(character).byteLength
    if (bytes + size > maxBytes) break
    result += character
    bytes += size
  }
  return result
}

export function buildSearchText(input: {
  title?: string
  labels?: string[]
  summary?: string
  content?: string
}) {
  return truncateContent(
    [input.title, input.labels?.join(' '), input.summary, input.content]
      .filter((part): part is string => Boolean(part?.trim()))
      .join('\n'),
    MAX_SEARCH_TEXT_BYTES,
  )
}

export function normalizeLabels(labels: string[]) {
  const unique: string[] = []
  const seen = new Set<string>()
  for (const label of labels) {
    const normalized = truncateContent(label.trim().toLowerCase(), MAX_LABEL_BYTES)
    if (!normalized || seen.has(normalized)) continue
    seen.add(normalized)
    unique.push(normalized)
    if (unique.length === MAX_LABELS) break
  }
  return unique
}

export function normalizeNote(note?: string) {
  const trimmed = note?.trim()
  return trimmed ? truncateContent(trimmed, MAX_NOTE_BYTES) : undefined
}
