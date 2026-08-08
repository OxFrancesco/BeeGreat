import { defineTool, type JsonValue } from '@flue/runtime'
import * as v from 'valibot'

export type TelegramServiceOptions = {
  convexSiteUrl?: string
  brokerSecret?: string
}

function siteUrl(convexUrl: string, configured?: string) {
  if (configured) return configured.replace(/\/$/, '')
  const url = new URL(convexUrl)
  if (!url.hostname.endsWith('.convex.cloud')) {
    throw new Error('CONVEX_SITE_URL is required for non-Convex-cloud URLs.')
  }
  url.hostname = url.hostname.replace(/\.convex\.cloud$/, '.convex.site')
  return url.origin
}

export async function callTelegramService<T extends JsonValue = JsonValue>(
  userId: string,
  convexUrl: string,
  options: TelegramServiceOptions,
  operation: 'status' | 'connect' | 'disconnect' | 'send',
  input: Record<string, unknown> = {},
  fetcher: typeof fetch = fetch,
): Promise<T> {
  const secret = options.brokerSecret?.trim()
  if (!secret) {
    throw new Error('Bee Telegram access is not configured on this deployment.')
  }
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10_000)
  try {
    const response = await fetcher(
      `${siteUrl(convexUrl, options.convexSiteUrl)}/internal/telegram`,
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${secret}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ userId, operation, ...input }),
        signal: controller.signal,
      },
    )
    const body = (await response.json().catch(() => null)) as
      | { error?: unknown }
      | T
      | null
    if (!response.ok) {
      const message =
        body &&
        typeof body === 'object' &&
        'error' in body &&
        typeof body.error === 'string'
          ? body.error
          : `Telegram service failed (HTTP ${response.status})`
      throw new Error(message)
    }
    return body as T
  } finally {
    clearTimeout(timeout)
  }
}

export function createTelegramTools(
  userId: string,
  convexUrl: string,
  options: TelegramServiceOptions,
) {
  return [
    defineTool({
      name: 'telegram_connection_status',
      description:
        "Check whether the user's Telegram account is connected to BeeGreat and can receive messages from Bee.",
      input: v.object({}),
      async run() {
        return {
          output: await callTelegramService(
            userId,
            convexUrl,
            options,
            'status',
          ),
        }
      },
    }),
    defineTool({
      name: 'send_telegram_message',
      description:
        "Send a plain-text message from BeeGreat's bot to the user's own connected Telegram account. Use only when the user explicitly asks Bee to send or save that exact content on Telegram. This cannot message other people or chats.",
      input: v.object({
        text: v.pipe(
          v.string(),
          v.minLength(1),
          v.maxLength(4096),
          v.description('Exact plain-text message to send'),
        ),
        silent: v.optional(
          v.pipe(
            v.boolean(),
            v.description('Deliver without a notification sound'),
          ),
        ),
      }),
      async run({ data }) {
        return {
          output: await callTelegramService(
            userId,
            convexUrl,
            options,
            'send',
            data,
          ),
        }
      },
    }),
  ]
}
