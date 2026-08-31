import type { Hono } from 'hono'
import type { JsonValue } from '@flue/runtime'
import * as v from 'valibot'
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
import { jsonRecordSchema, jsonValueSchema } from '../shared/json.ts'

/**
 * Per-action request validation for `handleChannelAction`. Each parser turns
 * the raw JSON body into the exact input forwarded to Convex, or rejects with
 * that action's original error message (every rejection is HTTP 400). Actions
 * missing from this table are rejected as unknown.
 */
type ChannelActionParse =
  | { ok: true; input: Record<string, JsonValue | undefined> }
  | { ok: false; error: string }

type ChannelActionParser = (body: ChannelActionBody) => ChannelActionParse

/** The decoded envelope every channel action shares. */
type ChannelActionBody = v.InferOutput<typeof channelEnvelopeSchema>

const channelEnvelopeSchema = v.object({ action: v.string() })

const nonBlankString = v.pipe(
  v.string(),
  v.check((value) => value.trim().length > 0),
)

const finiteNumber = v.pipe(
  v.number(),
  v.check((value: number) => Number.isFinite(value)),
)

const imessageSourceSchema = v.object({
  source: v.literal('imessage'),
  sourceAddress: nonBlankString,
})

const parseImessageSource: ChannelActionParser = (body) => {
  const parsed = v.safeParse(imessageSourceSchema, body)
  if (!parsed.success) {
    return { ok: false, error: 'Send a valid channel source.' }
  }
  return { ok: true, input: parsed.output }
}

const firstFocusSchema = v.object({
  requestId: v.string(),
  goalTitle: v.string(),
  projectTitle: v.string(),
  taskTitle: v.string(),
  highlightExpiresAt: v.optional(finiteNumber),
})

const parseFirstFocus: ChannelActionParser = (body) => {
  const parsed = v.safeParse(firstFocusSchema, body)
  if (!parsed.success) {
    return { ok: false, error: 'Invalid first-focus action.' }
  }
  return { ok: true, input: parsed.output }
}

const web3ConfirmationSchema = v.object({
  actionId: nonBlankString,
  summary: nonBlankString,
})

const parseWeb3Confirmation: ChannelActionParser = (body) => {
  const parsed = v.safeParse(web3ConfirmationSchema, body)
  if (!parsed.success) {
    return { ok: false, error: 'Invalid Web3 action.' }
  }
  return { ok: true, input: parsed.output }
}

const syncTranscriptSchema = v.object({
  threadId: finiteNumber,
  messages: v.array(jsonValueSchema),
})

const titleThreadSchema = v.object({
  threadId: finiteNumber,
  title: v.string(),
})

const completeHighlightSchema = v.object({
  requestId: v.string(),
  taskId: v.string(),
})

const getWeb3ActionSchema = v.object({ actionId: nonBlankString })

const CHANNEL_ACTION_PARSERS = {
  create_cli_thread: () => ({ ok: true, input: {} }),
  context: parseImessageSource,
  create_thread: parseImessageSource,
  sync_transcript: (body) => {
    const parsed = v.safeParse(syncTranscriptSchema, body)
    if (!parsed.success) {
      return { ok: false, error: 'Invalid transcript sync.' }
    }
    return { ok: true, input: parsed.output }
  },
  title_thread: (body) => {
    const parsed = v.safeParse(titleThreadSchema, body)
    if (!parsed.success) {
      return { ok: false, error: 'Invalid conversation title.' }
    }
    return { ok: true, input: parsed.output }
  },
  confirm_first_focus: parseFirstFocus,
  cancel_first_focus: parseFirstFocus,
  complete_highlight: (body) => {
    const parsed = v.safeParse(completeHighlightSchema, body)
    if (!parsed.success) {
      return { ok: false, error: 'Invalid Highlight completion.' }
    }
    return { ok: true, input: parsed.output }
  },
  get_web3_action: (body) => {
    const parsed = v.safeParse(getWeb3ActionSchema, body)
    if (!parsed.success) {
      return { ok: false, error: 'Invalid Web3 action.' }
    }
    return { ok: true, input: parsed.output }
  },
  confirm_web3: parseWeb3Confirmation,
  cancel_web3: parseWeb3Confirmation,
} satisfies Record<ChannelActionName, ChannelActionParser>

// SAFETY: the parser table satisfies `Record<ChannelActionName, ...>` with
// excess-property checking, so its runtime keys are exactly the
// `ChannelActionName` union; `Object.keys` alone cannot carry that evidence.
const channelActionNameSchema = v.picklist(
  Object.keys(CHANNEL_ACTION_PARSERS) as ChannelActionName[],
)

/** Sender-identity request from the trusted iMessage bridge. */
const identityRequestSchema = v.object({
  action: v.picklist(['resolve', 'begin_link', 'unlink']),
  address: nonBlankString,
})

/** Keeps text-client writes inside the same guarded Convex transactions. */
async function handleChannelAction(c: AppContext) {
  const rawBody = await c.req.json().catch(() => null)
  // `v.is` narrows the envelope without stripping the per-action fields the
  // parsers below still need to decode.
  if (!v.is(channelEnvelopeSchema, rawBody)) {
    return c.json({ error: 'Send a channel action.' }, 400)
  }

  // The closed picklist keeps arbitrary strings (e.g. "toString") from
  // resolving through the object prototype; anything not declared in the
  // parser table is unknown.
  const actionResult = v.safeParse(channelActionNameSchema, rawBody.action)
  if (!actionResult.success) {
    return c.json({ error: 'Unknown channel action.' }, 400)
  }
  const channelAction = actionResult.output
  const parser: ChannelActionParser = CHANNEL_ACTION_PARSERS[channelAction]
  const parsed = parser(rawBody)
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
    const rawBody = await c.req.json().catch(() => null)
    const parsedBody = v.safeParse(identityRequestSchema, rawBody)
    if (!parsedBody.success) {
      return c.json({ error: 'Send a valid identity action.' }, 400)
    }
    const { action, address } = parsedBody.output
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
        { address },
      )
      // SAFETY: the Convex bridge answers with a real HTTP status code; Hono
      // types `c.body`'s status as a literal union that cannot be proven from
      // a runtime number.
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
    const rawBody = await c.req.json().catch(() => null)
    // `v.is` keeps the extra delivery fields that forward to Convex below.
    const body = v.is(jsonRecordSchema, rawBody) ? rawBody : null
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
      // SAFETY: the Convex bridge answers with a real HTTP status code; Hono
      // types `c.body`'s status as a literal union that cannot be proven from
      // a runtime number.
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
