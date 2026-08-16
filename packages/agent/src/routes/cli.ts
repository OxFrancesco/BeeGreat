import type { Hono } from 'hono'
import {
  captureWorkerFailure,
  convexBridgeTarget,
  type AppEnvironment,
} from '../app-env.ts'
import { callImessageService } from '../shared/imessage-identity'
import { callTelegramService } from '../shared/telegram-tools'

export function registerCliRoutes(app: Hono<AppEnvironment>) {
  app.post('/cli/telegram', async (c) => {
    if (c.get('authKind') !== 'clerk') {
      return c.json({ error: 'Clerk authentication is required.' }, 403)
    }
    const body = (await c.req.json().catch(() => null)) as Record<
      string,
      unknown
    > | null
    const action = body?.action
    const telegramText = body?.text
    if (
      action !== 'connect' &&
      action !== 'status' &&
      action !== 'disconnect' &&
      action !== 'notify'
    ) {
      return c.json({ error: 'Invalid Telegram action.' }, 400)
    }
    if (
      action === 'notify' &&
      (typeof telegramText !== 'string' ||
        !telegramText.trim() ||
        [...telegramText.trim()].length > 4096)
    ) {
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
    const body = (await c.req.json().catch(() => null)) as Record<
      string,
      unknown
    > | null
    const action = body?.action
    if (action !== 'status' && action !== 'disconnect') {
      return c.json({ error: 'Invalid iMessage action.' }, 400)
    }
    const { convexUrl, convexSiteUrl, brokerSecret } = convexBridgeTarget(c.env)
    if (!convexUrl) {
      return c.json({ error: 'iMessage is not configured.' }, 503)
    }
    try {
      const result = await callImessageService(
        convexUrl,
        { convexSiteUrl, brokerSecret },
        action,
        {
          userId: c.get('userId'),
          ...(typeof body?.address === 'string' && body.address.trim()
            ? { address: body.address }
            : {}),
        },
      )
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
