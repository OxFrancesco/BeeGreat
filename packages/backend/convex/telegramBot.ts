'use node'

import * as Predicate from 'effect/Predicate'
import { jsonRecord } from './jsonValue'

export class TelegramBotError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly permissionDenied = false,
    readonly retryable = false,
  ) {
    super(message)
  }
}

/** Body for Telegram Bot API `sendMessage`, in Telegram's snake_case wire shape. */
type SendMessagePayload = {
  chat_id: string
  text: string
  disable_notification?: boolean
}

export async function sendTelegramBotMessage(
  chatId: string,
  text: string,
  silent = false,
  fetchImpl: typeof fetch = fetch,
) {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim()
  if (!token) {
    throw new TelegramBotError(
      'TELEGRAM_BOT_TOKEN is not configured',
      'configuration_error',
    )
  }
  const payload: SendMessagePayload = { chat_id: chatId, text }
  if (silent) payload.disable_notification = true
  let response: Response
  try {
    response = await fetchImpl(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      },
    )
  } catch {
    throw new TelegramBotError(
      'Could not reach Telegram',
      'network_error',
      false,
      true,
    )
  }
  const body = jsonRecord(await response.json().catch(() => null))
  const rawMessageId = jsonRecord(body?.result)?.message_id
  const messageId = Predicate.isNumber(rawMessageId) ? rawMessageId : undefined
  if (!response.ok || !body?.ok || !messageId) {
    const description = body?.description
    throw new TelegramBotError(
      Predicate.isString(description)
        ? description
        : 'Telegram could not send the message',
      `http_${response.status}`,
      response.status === 401 || response.status === 403,
      response.status === 429 || response.status >= 500,
    )
  }
  return { messageId }
}
