import { timingSafeEqual } from 'node:crypto'
import { zstdDecompressSync } from 'node:zlib'

export const dynamic = 'force-dynamic'
export const maxDuration = 300
export const runtime = 'nodejs'

const CHATGPT_CODEX_RESPONSES =
  'https://chatgpt.com/backend-api/codex/responses'
const MAX_COMPRESSED_BODY_BYTES = 8 * 1024 * 1024
const MAX_DECOMPRESSED_BODY_BYTES = 32 * 1024 * 1024

const REQUEST_HEADER_ALLOWLIST = [
  'accept',
  'authorization',
  'chatgpt-account-id',
  'content-encoding',
  'content-type',
  'openai-beta',
  'originator',
  'session-id',
  'user-agent',
  'x-client-request-id',
] as const

const RESPONSE_HEADER_ALLOWLIST = [
  'cache-control',
  'content-type',
  'openai-processing-ms',
  'retry-after',
  'x-request-id',
] as const

export interface CodexAdapterOptions {
  adapterSecret?: string
  upstreamFetch?: (
    input: string | URL | Request,
    init?: RequestInit,
  ) => Promise<Response>
}

function secretsMatch(left: string, right: string) {
  const leftBytes = Buffer.from(left)
  const rightBytes = Buffer.from(right)
  return (
    leftBytes.length === rightBytes.length &&
    timingSafeEqual(leftBytes, rightBytes)
  )
}

function allowedHeaders(
  source: Headers,
  allowlist: readonly string[],
): Headers {
  const result = new Headers()
  for (const name of allowlist) {
    const value = source.get(name)
    if (value) result.set(name, value)
  }
  return result
}

function jsonError(error: string, status: number) {
  return Response.json(
    { error },
    { status, headers: { 'cache-control': 'no-store' } },
  )
}

export async function proxyCodexRequest(
  request: Request,
  options: CodexAdapterOptions = {},
) {
  const configuredSecret = (
    options.adapterSecret ?? process.env.FLUE_CODEX_ADAPTER_SECRET
  )?.trim()
  const suppliedSecret = request.headers.get('x-flue-codex-adapter-secret')
  if (
    !configuredSecret ||
    !suppliedSecret ||
    !secretsMatch(configuredSecret, suppliedSecret)
  ) {
    return jsonError('Unauthorized', 401)
  }

  const requestHeaders = allowedHeaders(
    request.headers,
    REQUEST_HEADER_ALLOWLIST,
  )
  requestHeaders.set('accept-encoding', 'identity')

  try {
    const encodedBody = Buffer.from(await request.arrayBuffer())
    if (encodedBody.byteLength > MAX_COMPRESSED_BODY_BYTES) {
      return jsonError('Request body too large', 413)
    }
    const upstreamBody =
      requestHeaders.get('content-encoding')?.toLowerCase() === 'zstd'
        ? zstdDecompressSync(encodedBody, {
            maxOutputLength: MAX_DECOMPRESSED_BODY_BYTES,
          })
        : encodedBody
    requestHeaders.delete('content-encoding')

    const upstream = await (options.upstreamFetch ?? fetch)(
      CHATGPT_CODEX_RESPONSES,
      {
        method: 'POST',
        headers: requestHeaders,
        body: upstreamBody,
        signal: request.signal,
      },
    )
    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: allowedHeaders(upstream.headers, RESPONSE_HEADER_ALLOWLIST),
    })
  } catch {
    return jsonError('Codex upstream unavailable', 502)
  }
}

export function POST(request: Request) {
  return proxyCodexRequest(request)
}
