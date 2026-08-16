import type { Hono } from 'hono'
import {
  binding,
  captureWorkerFailure,
  convexBridgeTarget,
  secretsMatch,
  type AppContext,
  type AppEnvironment,
} from '../app-env.ts'
import {
  callChannelAction,
  type ChannelActionName,
} from '../shared/channel-actions'
import { callImessageService } from '../shared/imessage-identity'

/**
 * Per-action request validation for `handleChannelAction`. Each parser turns
 * the raw JSON body into the exact input forwarded to Convex, or rejects with
 * that action's original error message (every rejection is HTTP 400). Actions
 * missing from this table are rejected as unknown.
 */
type ChannelActionParse =
  | { ok: true; input: Record<string, unknown> }
  | { ok: false; error: string }

type ChannelActionParser = (body: Record<string, unknown>) => ChannelActionParse

const parseImessageSource: ChannelActionParser = (body) => {
  if (
    body.source !== 'imessage' ||
    typeof body.sourceAddress !== 'string' ||
    !body.sourceAddress.trim()
  ) {
    return { ok: false, error: 'Send a valid channel source.' }
  }
  return {
    ok: true,
    input: { source: body.source, sourceAddress: body.sourceAddress },
  }
}

const parseFirstFocus: ChannelActionParser = (body) => {
  if (
    typeof body.requestId !== 'string' ||
    typeof body.goalTitle !== 'string' ||
    typeof body.projectTitle !== 'string' ||
    typeof body.taskTitle !== 'string' ||
    (body.highlightExpiresAt !== undefined &&
      (typeof body.highlightExpiresAt !== 'number' ||
        !Number.isFinite(body.highlightExpiresAt)))
  ) {
    return { ok: false, error: 'Invalid first-focus action.' }
  }
  return {
    ok: true,
    input: {
      requestId: body.requestId,
      goalTitle: body.goalTitle,
      projectTitle: body.projectTitle,
      taskTitle: body.taskTitle,
      ...(typeof body.highlightExpiresAt === 'number'
        ? { highlightExpiresAt: body.highlightExpiresAt }
        : {}),
    },
  }
}

const parseWeb3Confirmation: ChannelActionParser = (body) => {
  if (
    typeof body.actionId !== 'string' ||
    !body.actionId.trim() ||
    typeof body.summary !== 'string' ||
    !body.summary.trim()
  ) {
    return { ok: false, error: 'Invalid Web3 action.' }
  }
  return { ok: true, input: { actionId: body.actionId, summary: body.summary } }
}

const CHANNEL_ACTION_PARSERS: Partial<
  Record<ChannelActionName, ChannelActionParser>
> = {
  create_cli_thread: () => ({ ok: true, input: {} }),
  context: parseImessageSource,
  create_thread: parseImessageSource,
  sync_transcript: (body) => {
    if (
      typeof body.threadId !== 'number' ||
      !Number.isFinite(body.threadId) ||
      !Array.isArray(body.messages)
    ) {
      return { ok: false, error: 'Invalid transcript sync.' }
    }
    return {
      ok: true,
      input: { threadId: body.threadId, messages: body.messages },
    }
  },
  title_thread: (body) => {
    if (
      typeof body.threadId !== 'number' ||
      !Number.isFinite(body.threadId) ||
      typeof body.title !== 'string'
    ) {
      return { ok: false, error: 'Invalid conversation title.' }
    }
    return { ok: true, input: { threadId: body.threadId, title: body.title } }
  },
  confirm_first_focus: parseFirstFocus,
  cancel_first_focus: parseFirstFocus,
  complete_highlight: (body) => {
    if (typeof body.requestId !== 'string' || typeof body.taskId !== 'string') {
      return { ok: false, error: 'Invalid Highlight completion.' }
    }
    return {
      ok: true,
      input: { requestId: body.requestId, taskId: body.taskId },
    }
  },
  get_web3_action: (body) => {
    if (typeof body.actionId !== 'string' || !body.actionId.trim()) {
      return { ok: false, error: 'Invalid Web3 action.' }
    }
    return { ok: true, input: { actionId: body.actionId } }
  },
  confirm_web3: parseWeb3Confirmation,
  cancel_web3: parseWeb3Confirmation,
}

/** Keeps text-client writes inside the same guarded Convex transactions. */
async function handleChannelAction(c: AppContext) {
  const body = (await c.req.json().catch(() => null)) as Record<
    string,
    unknown
  > | null
  const action = body?.action
  if (typeof action !== 'string') {
    return c.json({ error: 'Send a channel action.' }, 400)
  }

  // `hasOwn` keeps arbitrary strings (e.g. "toString") from resolving through
  // the object prototype; anything not declared in the table is unknown.
  const parser = Object.hasOwn(CHANNEL_ACTION_PARSERS, action)
    ? CHANNEL_ACTION_PARSERS[action as ChannelActionName]
    : undefined
  if (!parser) {
    return c.json({ error: 'Unknown channel action.' }, 400)
  }
  const channelAction = action as ChannelActionName
  // `body` is non-null here: a null body has no string `action`.
  const parsed = parser(body as Record<string, unknown>)
  if (!parsed.ok) {
    return c.json({ error: parsed.error }, 400)
  }
  const input = parsed.input

  const { convexUrl, convexSiteUrl, brokerSecret } = convexBridgeTarget(c.env)
  const clerkIssuer = binding(c.env, 'CLERK_JWT_ISSUER_DOMAIN')
  if (!convexUrl || !clerkIssuer) {
    captureWorkerFailure(
      new Error('Channel actions are not configured'),
      `${c.get('authKind')}.channel.configuration`,
    )
    return c.json({ error: 'Channel actions are not configured.' }, 503)
  }
  try {
    const result = await callChannelAction(
      { convexUrl, convexSiteUrl, brokerSecret, clerkIssuer },
      c.get('userId'),
      channelAction,
      input,
    )
    return c.body(JSON.stringify(result), 200, {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    })
  } catch (error) {
    captureWorkerFailure(error, `${c.get('authKind')}.channel.${channelAction}`)
    return c.json(
      {
        error:
          error instanceof Error ? error.message : 'Channel action failed.',
      },
      400,
    )
  }
}

export function registerChannelRoutes(app: Hono<AppEnvironment>) {
  app.post('/bridge/channel', async (c) => {
    if (c.get('authKind') !== 'bridge') {
      return c.json(
        { error: 'Trusted bridge authentication is required.' },
        403,
      )
    }
    return await handleChannelAction(c)
  })

  // Sender identity for the trusted iMessage bridge. Unknown senders have no
  // user id yet, so this route accepts the bridge secret alone and scopes every
  // operation to one sender address.
  app.post('/bridge/identity', async (c) => {
    const bridgeSecret = c.req.header('x-bridge-secret')
    const configuredBridgeSecret = binding(c.env, 'BRIDGE_SECRET')
    if (
      !bridgeSecret ||
      !configuredBridgeSecret ||
      !secretsMatch(bridgeSecret, configuredBridgeSecret)
    ) {
      return c.json(
        { error: 'Trusted bridge authentication is required.' },
        403,
      )
    }
    const body = (await c.req.json().catch(() => null)) as {
      action?: unknown
      address?: unknown
    } | null
    const action = body?.action
    if (
      (action !== 'resolve' &&
        action !== 'begin_link' &&
        action !== 'unlink') ||
      typeof body?.address !== 'string' ||
      !body.address.trim()
    ) {
      return c.json({ error: 'Send a valid identity action.' }, 400)
    }
    const { convexUrl, convexSiteUrl, brokerSecret } = convexBridgeTarget(c.env)
    if (!convexUrl) {
      captureWorkerFailure(
        new Error('iMessage identity is not configured'),
        'bridge.identity.configuration',
      )
      return c.json({ error: 'iMessage identity is not configured.' }, 503)
    }
    try {
      const result = await callImessageService(
        convexUrl,
        { convexSiteUrl, brokerSecret },
        action,
        { address: body.address },
      )
      return c.body(JSON.stringify(result.body), result.status as 200, {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store',
      })
    } catch (error) {
      captureWorkerFailure(error, `bridge.identity.${action}`)
      return c.json(
        {
          error:
            error instanceof Error ? error.message : 'Identity action failed.',
        },
        400,
      )
    }
  })

  // Lease-based terminal Web3 delivery. There is no inbound sender header while
  // the bridge polls, so this private endpoint uses the bridge secret directly.
  app.post('/bridge/outbox', async (c) => {
    const bridgeSecret = c.req.header('x-bridge-secret')
    const configuredBridgeSecret = binding(c.env, 'BRIDGE_SECRET')
    if (
      !bridgeSecret ||
      !configuredBridgeSecret ||
      !secretsMatch(bridgeSecret, configuredBridgeSecret)
    ) {
      return c.json(
        { error: 'Trusted bridge authentication is required.' },
        403,
      )
    }
    const body = (await c.req.json().catch(() => null)) as Record<
      string,
      unknown
    > | null
    const action = body?.action
    if (
      action !== 'claim_delivery' &&
      action !== 'complete_delivery' &&
      action !== 'retry_delivery'
    ) {
      return c.json({ error: 'Send a valid outbox action.' }, 400)
    }
    const { convexUrl, convexSiteUrl, brokerSecret } = convexBridgeTarget(c.env)
    if (!convexUrl) {
      return c.json({ error: 'iMessage delivery is not configured.' }, 503)
    }
    try {
      const result = await callImessageService(
        convexUrl,
        { convexSiteUrl, brokerSecret },
        action,
        Object.fromEntries(
          Object.entries(body ?? {}).filter(([key]) => key !== 'action'),
        ),
      )
      return c.body(JSON.stringify(result.body), result.status as 200, {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store',
      })
    } catch (error) {
      captureWorkerFailure(error, `bridge.outbox.${action}`)
      return c.json(
        { error: error instanceof Error ? error.message : 'Delivery failed.' },
        400,
      )
    }
  })

  app.post('/cli/channel', async (c) => {
    if (c.get('authKind') !== 'clerk') {
      return c.json({ error: 'Clerk authentication is required.' }, 403)
    }
    return await handleChannelAction(c)
  })
}
