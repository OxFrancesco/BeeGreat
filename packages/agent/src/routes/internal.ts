import type { Hono } from 'hono'
import * as v from 'valibot'
import { dispatchBee } from '../agents/bee.ts'
import {
  binding,
  secretsMatch,
  type AppContext,
  type AppEnvironment,
} from '../app-env.ts'
import { jsonRecordSchema } from '../shared/json.ts'

/** Convex authenticates to these routes with the server-only broker secret. */
function brokerSecretMatches(c: AppContext) {
  const configuredSecret = binding(c.env, 'AGENT_CREDENTIAL_BROKER_SECRET')
  const suppliedSecret = c.req
    .header('authorization')
    ?.match(/^Bearer ([^\s]+)$/i)?.[1]
  return Boolean(
    configuredSecret &&
      suppliedSecret &&
      secretsMatch(configuredSecret, suppliedSecret),
  )
}

const userIdSchema = v.pipe(v.string(), v.regex(/^user_[A-Za-z0-9]+$/))

function isConversationOf(userId: string, conversationId: string) {
  return (
    conversationId === userId ||
    new RegExp(`^${userId}~[0-9]+$`).test(conversationId)
  )
}

const accountDeletionSchema = v.pipe(
  v.object({
    userId: userIdSchema,
    conversationIds: v.pipe(v.array(v.string()), v.maxLength(250)),
  }),
  v.check(({ userId, conversationIds }) =>
    conversationIds.every((id) => isConversationOf(userId, id)),
  ),
)

/**
 * Strictly-validated fields of a settled-action event. Extra descriptive
 * fields (kind, detail, error, explorerLink) stay unvalidated on purpose:
 * they are copied into signal attributes only when they are strings.
 */
const web3SettledSchema = v.pipe(
  v.object({
    userId: userIdSchema,
    conversationId: v.string(),
    actionId: v.string(),
    summary: v.string(),
    continuation: v.nullish(
      v.pipe(v.string(), v.minLength(1), v.maxLength(1_000)),
    ),
    jobRunId: v.nullish(v.string()),
    status: v.picklist(['executed', 'failed', 'refunded', 'expired']),
  }),
  v.check(({ userId, conversationId }) =>
    isConversationOf(userId, conversationId),
  ),
)

const attributeStringSchema = v.string()

const jobRunSchema = v.object({
  runId: v.string(),
  jobId: v.string(),
  userId: userIdSchema,
  threadId: v.pipe(
    v.number(),
    v.check((value: number) => Number.isSafeInteger(value)),
    v.minValue(1),
  ),
  title: v.pipe(v.string(), v.maxLength(80)),
  instruction: v.pipe(v.string(), v.maxLength(8_000)),
  scheduledFor: v.number(),
  dispatchId: v.pipe(v.string(), v.maxLength(256)),
  delivery: v.pipe(v.array(v.picklist(['app', 'telegram'])), v.maxLength(2)),
})

export function registerInternalRoutes(app: Hono<AppEnvironment>) {
  app.post('/internal/account-deletion', async (c) => {
    if (!brokerSecretMatches(c)) {
      return c.json({ error: 'Unauthorized' }, 401)
    }
    const parsed = v.safeParse(
      accountDeletionSchema,
      await c.req.json().catch(() => null),
    )
    if (!parsed.success) {
      return c.json({ error: 'Invalid deletion request' }, 400)
    }
    const body = parsed.output

    const conversationIds = [...new Set(body.conversationIds)]
    for (let index = 0; index < conversationIds.length; index += 20) {
      await Promise.all(
        conversationIds
          .slice(index, index + 20)
          .map((id) =>
            c.env.FLUE_BEE_V2_AGENT.getByName(id).deleteAccountData(),
          ),
      )
    }
    let siteObjectsDeleted = 0
    const prefix = `users/${body.userId}/`
    while (true) {
      const page = await c.env.BEE_SITES_BUCKET.list({ prefix, limit: 1_000 })
      const keys = page.objects.map((object) => object.key)
      if (!keys.length) break
      await c.env.BEE_SITES_BUCKET.delete(keys)
      siteObjectsDeleted += keys.length
      if (siteObjectsDeleted > 100_000) {
        throw new Error('Bee Site account cleanup exceeded its safety bound')
      }
    }
    return c.json({ deleted: conversationIds.length, siteObjectsDeleted })
  })

  /**
   * Convex wake-up for settled Web3 actions: injects a `web3.action_settled`
   * event into the user's active Bee conversation so long-running multi-step
   * plans (e.g. bridge, then open a pool position) continue without the user
   * nudging the chat. The event carries status only — Bee re-reads authoritative
   * details through its own Web3 tools and still cannot confirm or execute.
   */
  app.post('/internal/web3-settled', async (c) => {
    if (!brokerSecretMatches(c)) {
      return c.json({ error: 'Unauthorized' }, 401)
    }
    const rawBody = await c.req.json().catch(() => null)
    // The record view keeps the loose descriptive fields that the strict
    // schema does not model; both parse the same decoded body exactly once.
    if (!v.is(jsonRecordSchema, rawBody)) {
      return c.json({ error: 'Invalid settled-action event' }, 400)
    }
    const extras = rawBody
    const parsed = v.safeParse(web3SettledSchema, rawBody)
    if (!parsed.success) {
      return c.json({ error: 'Invalid settled-action event' }, 400)
    }
    const body = parsed.output
    const attributes: Record<string, string> = {}
    attributes.actionId = body.actionId
    attributes.status = body.status
    if (v.is(attributeStringSchema, extras.kind)) {
      attributes.kind = extras.kind
    }
    if (v.is(attributeStringSchema, body.continuation)) {
      attributes.continuation = body.continuation
    }
    if (v.is(attributeStringSchema, extras.detail)) {
      attributes.detail = extras.detail
    }
    if (v.is(attributeStringSchema, extras.error)) {
      attributes.error = extras.error
    }
    if (v.is(attributeStringSchema, extras.explorerLink)) {
      attributes.explorerLink = extras.explorerLink
    }
    if (v.is(attributeStringSchema, body.jobRunId)) {
      attributes.jobRunId = body.jobRunId
    }
    await dispatchBee({
      id: body.conversationId,
      message: {
        kind: 'signal',
        type: 'web3.action_settled',
        body: body.summary,
        attributes,
      },
    })
    return c.json({ dispatched: true })
  })

  /** Convex dispatches one idempotent signal for each materialized Job run. */
  app.post('/internal/job-run', async (c) => {
    if (!brokerSecretMatches(c)) {
      return c.json({ error: 'Unauthorized' }, 401)
    }
    const parsed = v.safeParse(
      jobRunSchema,
      await c.req.json().catch(() => null),
    )
    if (!parsed.success) {
      return c.json({ error: 'Invalid Job run' }, 400)
    }
    const body = parsed.output
    const destinations = body.delivery
    const deliveryInstruction = destinations.includes('telegram')
      ? 'Before settling the run, send a concise useful result to the user with send_telegram_message.'
      : 'The result remains in this Job thread.'
    const receipt = await dispatchBee({
      id: `${body.userId}~${body.threadId}`,
      idempotencyKey: body.dispatchId,
      message: {
        kind: 'signal',
        type: 'job.scheduled',
        body: `Run the scheduled Job “${body.title}”. ${body.instruction}\n\n${deliveryInstruction} Call complete_agent_job_run exactly once with the truthful outcome. If an approval or user decision blocks completion, settle it as needs_attention.`,
        attributes: {
          runId: body.runId,
          jobId: body.jobId,
          scheduledFor: String(body.scheduledFor),
          delivery: destinations.join(','),
        },
      },
    })
    return c.json({ submissionId: receipt.submissionId })
  })
}
