// @vitest-environment node

import { afterEach, expect, test } from 'vitest'
import { sendTelegramBotMessage, TelegramBotError } from './telegramBot'

const originalToken = process.env.TELEGRAM_BOT_TOKEN

afterEach(() => {
  if (originalToken === undefined) delete process.env.TELEGRAM_BOT_TOKEN
  else process.env.TELEGRAM_BOT_TOKEN = originalToken
})

test('sends a plain self-message through the configured bot', async () => {
  process.env.TELEGRAM_BOT_TOKEN = 'bot-token-fixture'
  const result = await sendTelegramBotMessage(
    '123456789',
    'Focus now',
    true,
    async (input, init) => {
      expect(String(input)).toBe(
        'https://api.telegram.org/botbot-token-fixture/sendMessage',
      )
      expect(init?.method).toBe('POST')
      expect(JSON.parse(String(init?.body))).toEqual({
        chat_id: '123456789',
        text: 'Focus now',
        disable_notification: true,
      })
      return Response.json({ ok: true, result: { message_id: 42 } })
    },
  )
  expect(result).toEqual({ messageId: 42 })
})

test('marks blocked-bot responses as permission failures', async () => {
  process.env.TELEGRAM_BOT_TOKEN = 'bot-token-fixture'
  const error = await sendTelegramBotMessage(
    '123456789',
    'Focus now',
    false,
    async () =>
      Response.json(
        { ok: false, description: 'Forbidden: bot was blocked by the user' },
        { status: 403 },
      ),
  ).catch((cause: unknown) => cause)
  expect(error).toBeInstanceOf(TelegramBotError)
  expect(error).toMatchObject({ permissionDenied: true, retryable: false })
})
