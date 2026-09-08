export class BodyTooLargeError extends Error {
  constructor() { super('Request body is too large.') }
}

export async function readLimitedBody(request: Request, maxBytes: number) {
  const declared = request.headers.get('content-length')
  if (declared && (!/^\d+$/.test(declared) || Number(declared) > maxBytes)) {
    await request.body?.cancel().catch(() => {})
    throw new BodyTooLargeError()
  }
  if (!request.body) return new Uint8Array()
  const reader = request.body.getReader()
  const signal = AbortSignal.any([request.signal, AbortSignal.timeout(30_000)])
  const abort = () => { void reader.cancel(signal.reason).catch(() => {}) }
  signal.addEventListener('abort', abort, { once: true })
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      signal.throwIfAborted()
      if (done) break
      size += value.byteLength
      if (size > maxBytes) throw new BodyTooLargeError()
      chunks.push(value)
    }
  } finally {
    signal.removeEventListener('abort', abort)
    await reader.cancel().catch(() => {})
    reader.releaseLock()
  }
  const result = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.byteLength }
  return result
}
