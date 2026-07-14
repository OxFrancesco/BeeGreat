import type { FlueConversationMessage } from '@flue/sdk'

export type StoredChatMessage = {
  id: string
  contentJson: string
  createdAt: number
}

function messageKeys(message: FlueConversationMessage) {
  return [
    `id:${message.id}`,
    ...(message.submissionId ? [`submission:${message.submissionId}`] : []),
  ]
}

export function messageTimestamp(
  message: FlueConversationMessage,
  fallback: number,
) {
  const value = message.metadata?.timestamp
  const parsed = typeof value === 'string' ? Date.parse(value) : Number.NaN
  return Number.isFinite(parsed) ? parsed : fallback
}

/** Gives admitted user turns a stable key while Flue reconciles its local echo. */
export function messagesForConvexSync(
  messages: Array<FlueConversationMessage>,
) {
  return messages.flatMap((message) => {
    if (message.role === 'user' && message.submissionId) {
      return [{ ...message, id: `submission:${message.submissionId}` }]
    }
    return message.id.startsWith('local:') ? [] : [message]
  })
}

/** Combines Convex's durable transcript with Flue's live streaming envelope. */
export function mergeConvexMessages(
  rows: Array<StoredChatMessage> | undefined,
  flueMessages: Array<FlueConversationMessage>,
) {
  if (!rows?.length) return flueMessages

  const ordered: Array<{
    message: FlueConversationMessage
    createdAt: number
  }> = []
  const position = new Map<string, number>()

  for (const row of rows) {
    try {
      const message = JSON.parse(row.contentJson) as FlueConversationMessage
      const existing = messageKeys(message)
        .map((key) => position.get(key))
        .find((value) => value !== undefined)
      if (existing === undefined) {
        const nextIndex = ordered.length
        ordered.push({ message, createdAt: row.createdAt })
        for (const key of messageKeys(message)) position.set(key, nextIndex)
      } else {
        const previous = ordered[existing]
        ordered[existing] = {
          message,
          createdAt: Math.min(previous.createdAt, row.createdAt),
        }
        for (const key of [
          ...messageKeys(previous.message),
          ...messageKeys(message),
        ]) {
          position.set(key, existing)
        }
      }
    } catch {
      // One malformed stored envelope should not hide the rest of the chat.
    }
  }

  const fallbackTimestamp =
    ordered.reduce((latest, entry) => Math.max(latest, entry.createdAt), 0) + 1

  for (const [index, message] of flueMessages.entries()) {
    const existing = messageKeys(message)
      .map((key) => position.get(key))
      .find((value) => value !== undefined)
    if (existing === undefined) {
      const nextIndex = ordered.length
      for (const key of messageKeys(message)) position.set(key, nextIndex)
      ordered.push({
        message,
        createdAt: messageTimestamp(message, fallbackTimestamp + index),
      })
    } else {
      for (const key of messageKeys(message)) position.set(key, existing)
      ordered[existing] = { ...ordered[existing], message }
    }
  }

  return ordered
    .sort((left, right) => left.createdAt - right.createdAt)
    .map(({ message }) => message)
}
