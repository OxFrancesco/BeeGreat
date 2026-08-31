import type { Hono } from 'hono'
import type { JsonValue } from '@flue/runtime'
import * as v from 'valibot'
import {
  captureWorkerFailure,
  convexBridgeTarget,
  type AppEnvironment,
} from '../app-env.ts'
import { callImessageService } from '../shared/imessage-identity'
import { callTelegramService } from '../shared/telegram-tools'
import { jsonValueSchema } from '../shared/json.ts'

const telegramRequestSchema = v.object({
  action: v.picklist(['connect', 'status', 'disconnect', 'notify']),
  text: v.optional(jsonValueSchema),
})

const telegramTextSchema = v.pipe(
  v.string(),
  v.check(
    (value) => value.trim().length > 0 && [...value.trim()].length <= 4096,
  ),
)

const imessageRequestSchema = v.object({
  action: v.picklist(['status', 'disconnect']),
  address: v.optional(jsonValueSchema),
})

const nonBlankStringSchema = v.pipe(
  v.string(),
  v.check((value) => value.trim().length > 0),
)

export function registerCliRoutes(app: Hono<AppEnvironment>) {
  app.post('/cli/telegram', async (c) => {
    if (c.get('authKind') !== 'clerk') {
      return c.json({ error: 'Clerk authentication is required.' }, 403)
    }
    const rawBody = await c.req.json().catch(() => null)
    if (!v.is(telegramRequestSchema, rawBody)) {
      return c.json({ error: 'Invalid Telegram action.' }, 400)
    }
    const action = rawBody.action
    const telegramText = rawBody.text
    if (action === 'notify' && !v.is(telegramTextSchema, telegramText)) {
      return c.json(
        { error: 'Send a Telegram message of 4,096 characters or fewer.' },
        400,
      )
    }
    const { convexUrl, convexSiteUrl, brokerSecret } = convexBridgeTarget(c.env)
    if (!convexUrl) {
      return c.json({ error: 'Telegram is not configured.' }, 503)
    }
    try {
      const result = await callTelegramService(
        c.get('userId'),
        convexUrl,
        { convexSiteUrl, brokerSecret },
        action === 'notify' ? 'send' : action,
        action === 'notify' ? { text: String(telegramText) } : {},
      )
      return c.body(JSON.stringify(result), 200, {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store',
      })
    } catch (error) {
      captureWorkerFailure(error, `clerk.telegram.${action}`)
      return c.json(
        {
          error:
            error instanceof Error ? error.message : 'Telegram request failed.',
        },
        400,
      )
    }
  })

  // Linked iMessage senders for the CLI (`bee imessage status|disconnect`).
  app.post('/cli/imessage', async (c) => {
    if (c.get('authKind') !== 'clerk') {
      return c.json({ error: 'Clerk authentication is required.' }, 403)
    }
    const rawBody = await c.req.json().catch(() => null)
    if (!v.is(imessageRequestSchema, rawBody)) {
      return c.json({ error: 'Invalid iMessage action.' }, 400)
    }
    const action = rawBody.action
    const { convexUrl, convexSiteUrl, brokerSecret } = convexBridgeTarget(c.env)
    if (!convexUrl) {
      return c.json({ error: 'iMessage is not configured.' }, 503)
    }
    const input: Record<string, JsonValue | undefined> = {}
    input.userId = c.get('userId')
    if (v.is(nonBlankStringSchema, rawBody.address)) {
      input.address = rawBody.address
    }
    try {
      const result = await callImessageService(
        convexUrl,
        { convexSiteUrl, brokerSecret },
        action,
        input,
      )
      // SAFETY: the Convex bridge answers with a real HTTP status code; Hono
      // types `c.body`'s status as a literal union that cannot be proven from
      // a runtime number.
      return c.body(JSON.stringify(result.body), result.status as 200, {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store',
      })
    } catch (error) {
      captureWorkerFailure(error, `clerk.imessage.${action}`)
      return c.json(
        {
          error:
            error instanceof Error ? error.message : 'iMessage request failed.',
        },
        400,
      )
    }
  })
}
