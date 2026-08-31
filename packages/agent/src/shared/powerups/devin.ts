import { defineSubagent, defineTool, useTool, type JsonValue } from '@flue/runtime'
import * as v from 'valibot'
import type { PowerupDefinition } from './types.ts'

const bridgeErrorSchema = v.object({ error: v.string() })

const INSTRUCTIONS = `You are the Devin specialist inside BeeGreat, working for Bee
(the coordinator). You launch and monitor coding work in Devin Cloud. Your reply goes
back to Bee, not directly to the user, so return compact, exact session data.

- Start a session only when Bee's delegation explicitly asks to hand coding work to Devin.
  Preserve the requested repository, acceptance criteria, verification commands, and scope
  in the prompt. Normal mode is the cost-conscious default; fast mode is more expensive.
- A session id is durable context. For updates, inspect the existing session. For additional
  instructions, send a follow-up to that same session; never start a duplicate session.
- After starting, inspecting, or following up, return the session id, title, status,
  status detail, Devin URL, recent Devin messages, and every pull-request URL/state.
- If status_detail is waiting_for_user or waiting_for_approval, state exactly what Devin
  needs. If it is finished, say so only when the API reports it.
- list_devin_tasks only lists sessions BeeGreat launched for this user. It refreshes their
  live status when Devin is reachable.
- Never invent a status, message, repository, PR, or completion. The Devin URL is where the
  user can inspect the full session and continue the conversation directly.`

export const devin: PowerupDefinition = {
  id: 'devin',

  profile(userId, convexUrl, runtime) {
    const convexSiteUrl = (() => {
      if (runtime.convexSiteUrl) return runtime.convexSiteUrl.replace(/\/$/, '')
      const url = new URL(convexUrl)
      if (!url.hostname.endsWith('.convex.cloud')) return null
      url.hostname = url.hostname.replace(/\.convex\.cloud$/, '.convex.site')
      return url.origin
    })()

    const request = async (input: Record<string, JsonValue | undefined>) => {
      if (!convexSiteUrl || !runtime.credentialBrokerSecret) {
        throw new Error('Devin is not configured for the Bee worker.')
      }
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 35_000)
      try {
        const response = await fetch(`${convexSiteUrl}/internal/devin`, {
          method: 'POST',
          headers: {
            authorization: `Bearer ${runtime.credentialBrokerSecret}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({ userId, ...input }),
          signal: controller.signal,
        })
        const body = await response.text()
        if (!response.ok) {
          const parsed = JSON.parse(body)
          throw new Error(
            v.is(bridgeErrorSchema, parsed)
              ? parsed.error
              : 'Devin request failed.',
          )
        }
        return body
      } finally {
        clearTimeout(timeout)
      }
    }

    const tools = [
        defineTool({
          name: 'start_devin_task',
          description:
            'Launch a new Devin Cloud coding session. Use only for an explicit request to hand work to Devin.',
          input: v.object({
            prompt: v.pipe(
              v.string(),
              v.minLength(1),
              v.maxLength(20_000),
              v.description(
                'Self-contained implementation brief with scope, acceptance criteria, and verification steps',
              ),
            ),
            title: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(200))),
            repos: v.optional(
              v.pipe(
                v.array(v.pipe(v.string(), v.minLength(1), v.maxLength(300))),
                v.maxLength(10),
                v.description('Repositories Devin should use, such as owner/repo'),
              ),
            ),
            mode: v.optional(
              v.picklist(
                ['normal', 'fast'],
                'normal is the cost-conscious default; fast is about twice as fast and four times as expensive',
              ),
            ),
            maxAcuLimit: v.optional(
              v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(1000)),
            ),
          }),
          async run({ data }) {
            return await request({ operation: 'start', ...data })
          },
        }),
        defineTool({
          name: 'list_devin_tasks',
          description:
            'List and refresh recent Devin sessions launched for this BeeGreat user.',
          input: v.object({
            limit: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(10))),
          }),
          async run({ data }) {
            return await request({ operation: 'list', ...data })
          },
        }),
        defineTool({
          name: 'inspect_devin_task',
          description:
            'Get live status, recent messages, the Devin URL, and pull requests for one existing session.',
          input: v.object({
            sessionId: v.pipe(
              v.string(),
              v.regex(/^devin-[A-Za-z0-9_-]+$/, 'Expected a devin- session id'),
            ),
          }),
          async run({ data }) {
            return await request({ operation: 'inspect', ...data })
          },
        }),
        defineTool({
          name: 'follow_up_devin_task',
          description:
            'Send additional instructions to an existing Devin session. Suspended sessions resume automatically.',
          input: v.object({
            sessionId: v.pipe(
              v.string(),
              v.regex(/^devin-[A-Za-z0-9_-]+$/, 'Expected a devin- session id'),
            ),
            message: v.pipe(v.string(), v.minLength(1), v.maxLength(10_000)),
          }),
          async run({ data }) {
            return await request({ operation: 'follow_up', ...data })
          },
        }),
    ]

    return defineSubagent({
      name: 'devin',
      description:
        'Devin Cloud coding tasks: launch implementation work, check live session progress and messages, see created pull requests, and send follow-up instructions to an existing session.',
      agent: () => {
        for (const tool of tools) useTool(tool)
        return INSTRUCTIONS
      },
    })
  },
}
