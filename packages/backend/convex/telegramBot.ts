'use node'

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
  let response: Response
  try {
    response = await fetchImpl(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          ...(silent ? { disable_notification: true } : {}),
        }),
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
  const body = (await response.json().catch(() => ({}))) as {
    ok?: boolean
    description?: string
    result?: { message_id?: number }
  }
  if (!response.ok || !body.ok || !body.result?.message_id) {
    throw new TelegramBotError(
      body.description ?? 'Telegram could not send the message',
      `http_${response.status}`,
      response.status === 401 || response.status === 403,
      response.status === 429 || response.status >= 500,
    )
  }
  return { messageId: body.result.message_id }
}
