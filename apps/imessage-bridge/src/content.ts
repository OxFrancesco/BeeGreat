// Turns incoming Spectrum message content (text, voice notes, images, and
// grouped attachments) into one prompt Bee can answer.

import type { DeliveredAttachment } from '@flue/sdk'
import type { Content } from 'spectrum-ts'
import type { AgentTransport } from './agent-transport'

export type IncomingPrompt = {
  text: string
  images: DeliveredAttachment[]
  unsupportedAttachment: boolean
}

export async function promptFromContent(
  transport: AgentTransport,
  userId: string,
  content: Content,
): Promise<IncomingPrompt> {
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
        await content.read(),
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
          data: (await content.read()).toString('base64'),
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
