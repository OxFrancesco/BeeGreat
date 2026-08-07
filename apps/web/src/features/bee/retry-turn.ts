import type { FlueConversationMessage } from '@flue/sdk'

export type RetryableTurn = {
  text: string
  messageIds: Array<string>
}

/**
 * Describes the latest user turn that can be replayed. Keeping this pure makes
 * the retry seam independent from Convex and Flue's live transport.
 */
export function getRetryableTurn(
  messages: Array<FlueConversationMessage>,
): RetryableTurn | undefined {
  let lastUserIndex = -1
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index].role === 'user') {
      lastUserIndex = index
      break
    }
  }
  if (lastUserIndex < 0) return undefined

  const userMessage = messages[lastUserIndex]
  const text = userMessage.parts
    .filter((part) => part.type === 'text')
    .map((part) => part.text)
    .join('\n')
    .trim()
  if (!text) return undefined

  return {
    text,
    messageIds: messages
      .slice(lastUserIndex)
      .flatMap((message) => [
        message.id,
        ...(message.role === 'user' && message.submissionId
          ? [`submission:${message.submissionId}`]
          : []),
      ]),
  }
}
