import type { Hono } from 'hono'
import { dispatchBee } from '../agents/bee.ts'
import {
  binding,
  secretsMatch,
  type AppContext,
  type AppEnvironment,
} from '../app-env.ts'

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

export function registerInternalRoutes(app: Hono<AppEnvironment>) {
  app.post('/internal/account-deletion', async (c) => {
    if (!brokerSecretMatches(c)) {
      return c.json({ error: 'Unauthorized' }, 401)
    }
    const body = (await c.req.json().catch(() => null)) as {
      userId?: unknown
      conversationIds?: unknown
    } | null
    if (
      !body ||
      typeof body.userId !== 'string' ||
      !/^user_[A-Za-z0-9]+$/.test(body.userId) ||
      !Array.isArray(body.conversationIds) ||
      body.conversationIds.length > 250 ||
      body.conversationIds.some(
        (id) =>
          typeof id !== 'string' ||
          (id !== body.userId &&
            !new RegExp(`^${body.userId}~[0-9]+$`).test(id)),
      )
    ) {
      return c.json({ error: 'Invalid deletion request' }, 400)
    }

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
    const body = (await c.req.json().catch(() => null)) as {
      userId?: unknown
      conversationId?: unknown
      actionId?: unknown
      kind?: unknown
      status?: unknown
      summary?: unknown
      continuation?: unknown
      detail?: unknown
      error?: unknown
      explorerLink?: unknown
      jobRunId?: unknown
    } | null
    const status = body?.status
    if (
      !body ||
      typeof body.userId !== 'string' ||
      !/^user_[A-Za-z0-9]+$/.test(body.userId) ||
      typeof body.conversationId !== 'string' ||
      (body.conversationId !== body.userId &&
        !new RegExp(`^${body.userId}~[0-9]+$`).test(body.conversationId)) ||
      typeof body.actionId !== 'string' ||
      typeof body.summary !== 'string' ||
      (body.continuation !== undefined &&
        body.continuation !== null &&
        (typeof body.continuation !== 'string' ||
          body.continuation.length < 1 ||
          body.continuation.length > 1_000)) ||
      (body.jobRunId !== undefined &&
        body.jobRunId !== null &&
        typeof body.jobRunId !== 'string') ||
      (status !== 'executed' &&
        status !== 'failed' &&
        status !== 'refunded' &&
        status !== 'expired')
    ) {
      return c.json({ error: 'Invalid settled-action event' }, 400)
    }
    const attributes: Record<string, string> = {
      actionId: body.actionId,
      status,
    }
    if (typeof body.kind === 'string') attributes.kind = body.kind
    if (typeof body.continuation === 'string') {
      attributes.continuation = body.continuation
    }
    if (typeof body.detail === 'string') attributes.detail = body.detail
    if (typeof body.error === 'string') attributes.error = body.error
    if (typeof body.explorerLink === 'string') {
      attributes.explorerLink = body.explorerLink
    }
    if (typeof body.jobRunId === 'string') attributes.jobRunId = body.jobRunId
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
    const body = (await c.req.json().catch(() => null)) as {
      runId?: unknown
      jobId?: unknown
      userId?: unknown
      threadId?: unknown
      title?: unknown
      instruction?: unknown
      delivery?: unknown
      scheduledFor?: unknown
      dispatchId?: unknown
    } | null
    if (
      !body ||
      typeof body.runId !== 'string' ||
      typeof body.jobId !== 'string' ||
      typeof body.userId !== 'string' ||
      !/^user_[A-Za-z0-9]+$/.test(body.userId) ||
      typeof body.threadId !== 'number' ||
      !Number.isSafeInteger(body.threadId) ||
      body.threadId < 1 ||
      typeof body.title !== 'string' ||
      body.title.length > 80 ||
      typeof body.instruction !== 'string' ||
      body.instruction.length > 8_000 ||
      typeof body.scheduledFor !== 'number' ||
      typeof body.dispatchId !== 'string' ||
      body.dispatchId.length > 256 ||
      !Array.isArray(body.delivery) ||
      body.delivery.length > 2 ||
      body.delivery.some(
        (destination) => destination !== 'app' && destination !== 'telegram',
      )
    ) {
      return c.json({ error: 'Invalid Job run' }, 400)
    }
    const destinations = body.delivery as Array<'app' | 'telegram'>
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
