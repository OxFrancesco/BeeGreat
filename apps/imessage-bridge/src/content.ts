// Turns incoming Spectrum message content (text, voice notes, images, and
// grouped attachments) into one prompt Bee can answer.

import type { DeliveredAttachment } from '@flue/sdk'
import type { Content } from 'spectrum-ts'
import { untilAborted } from './inbound-queue'
import type { AgentTransport } from './agent-transport'

export type IncomingPrompt = {
  text: string
  images: DeliveredAttachment[]
  unsupportedAttachment: boolean
}

export async function readAttachment(content: { stream(): Promise<ReadableStream<unknown>> }, signal?: AbortSignal) {
  signal?.throwIfAborted()
  const pending = content.stream()
  void pending.then(stream => { if (signal?.aborted) void stream.cancel(signal.reason).catch(() => {}) }, () => {})
  const stream = await untilAborted(pending, signal)
  const reader = stream.getReader()
  const cancel = () => { void reader.cancel(signal?.reason).catch(() => {}) }
  signal?.addEventListener('abort', cancel, { once: true })
  const chunks: Buffer[] = []
  let size = 0
  try {
    while (true) {
      signal?.throwIfAborted()
      const { done, value } = await untilAborted(reader.read(), signal)
      if (done) break
      if (!(value instanceof Uint8Array)) throw new Error('Invalid attachment bytes')
      size += value.byteLength
      if (size > 20 * 1024 * 1024) throw new Error('Attachment exceeds 20 MB')
      chunks.push(Buffer.from(value))
    }
    signal?.throwIfAborted()
    return Buffer.concat(chunks)
  } finally {
    signal?.removeEventListener('abort', cancel)
    void reader.cancel().catch(() => {})
  }
}

export async function promptFromContent(
  transport: AgentTransport,
  userId: string,
  content: Content,
): Promise<IncomingPrompt> {
  transport.signal?.throwIfAborted()
  if (content.type === 'text') {
    return {
      text: content.text.trim(),
      images: [],
      unsupportedAttachment: false,
    }
  }
  if (
    content.type === 'voice' ||
    (content.type === 'attachment' && content.mimeType.startsWith('audio/'))
  ) {
    return {
      text: await transport.transcribeVoice(
        userId,
        await readAttachment(content, transport.signal),
        content.mimeType,
      ),
      images: [],
      unsupportedAttachment: false,
    }
  }
  if (content.type === 'attachment' && content.mimeType.startsWith('image/')) {
    return {
      text: '',
      images: [
        {
          type: 'image',
          data: (await readAttachment(content, transport.signal)).toString('base64'),
          mimeType: content.mimeType,
        },
      ],
      unsupportedAttachment: false,
    }
  }
  if (content.type === 'group') {
    const parts = await Promise.all(
      content.items.map((item) =>
        promptFromContent(transport, userId, item.content),
      ),
    )
    return {
      text: parts
        .map((part) => part.text)
        .filter(Boolean)
        .join('\n'),
      images: parts.flatMap((part) => part.images),
      unsupportedAttachment: parts.some((part) => part.unsupportedAttachment),
    }
  }
  return { text: '', images: [], unsupportedAttachment: true }
}
