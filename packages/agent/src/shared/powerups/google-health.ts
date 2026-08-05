import { defineSubagent, defineTool, useTool } from '@flue/runtime'
import * as v from 'valibot'
import type { PowerupDefinition } from './types.ts'

const DATA_TYPES = [
  'steps',
  'heart-rate',
  'exercise',
  'distance',
  'active-zone-minutes',
  'altitude',
  'basal-energy-burned',
  'active-energy-burned',
  'vo2-max',
  'heart-rate-variability',
  'activity-level',
  'floors',
  'active-minutes',
  'weight',
  'body-fat',
  'height',
  'oxygen-saturation',
  'blood-glucose',
  'core-body-temperature',
  'sleep',
  'daily-resting-heart-rate',
  'daily-heart-rate-variability',
  'daily-oxygen-saturation',
  'daily-respiratory-rate',
  'daily-vo2-max',
  'daily-sleep-temperature-derivations',
  'daily-heart-rate-zones',
  'respiratory-rate-sleep-summary',
  'run-vo2-max',
  'sedentary-period',
  'swim-lengths-data',
  'hydration-log',
  'total-calories',
  'time-in-heart-rate-zone',
  'calories-in-heart-rate-zone',
  'nutrition-log',
  'food',
  'food-measurement-unit',
] as const

const INSTRUCTIONS = `You are the Google Health specialist inside BeeGreat, working for Bee
(the coordinator). You answer questions using the user's connected Google Health API v4 data.
Your reply goes back to Bee, not directly to the user, so be concise and include dates, units,
and whether a result is a raw reading or an aggregate.

- Call get_health_context before date-sensitive work to learn the user's timezone and profile context.
- For steps, distance, total calories, floors, and active minutes, use daily-rollup for totals.
- Use list for individual heart-rate, weight, SpO2, HRV, sleep, and exercise records.
- Missing rollup days mean no synced data, not zero. Never turn an absent day into 0 or include it in an average.
- Google protobuf int64 values can be strings. Preserve their meaning when calculating or summarizing.
- This power-up is read-only. Never claim to write, edit, or delete a health record.
- Do not diagnose conditions or overstate health conclusions. Describe trends and encourage qualified medical advice for concerning results.
- If authentication is missing or expired, tell Bee the user must connect Google Health from Profile → Power-ups.`

export const googleHealth: PowerupDefinition = {
  id: 'google-health',

  profile(userId, convexUrl, runtime) {
    const convexSiteUrl = (() => {
      if (runtime.convexSiteUrl) return runtime.convexSiteUrl.replace(/\/$/, '')
      const url = new URL(convexUrl)
      if (!url.hostname.endsWith('.convex.cloud')) return null
      url.hostname = url.hostname.replace(/\.convex\.cloud$/, '.convex.site')
      return url.origin
    })()

    const request = async (
      path: 'context' | 'query',
      input: Record<string, unknown>,
    ) => {
      if (!convexSiteUrl || !runtime.credentialBrokerSecret) {
        throw new Error('Google Health is not configured for the Bee worker.')
      }
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 30_000)
      try {
        const response = await fetch(
          `${convexSiteUrl}/internal/google-health/${path}`,
          {
            method: 'POST',
            headers: {
              authorization: `Bearer ${runtime.credentialBrokerSecret}`,
              'content-type': 'application/json',
            },
            body: JSON.stringify({ userId, ...input }),
            signal: controller.signal,
          },
        )
        const body = await response.text()
        if (!response.ok) {
          const parsed = JSON.parse(body) as { error?: unknown }
          throw new Error(
            typeof parsed.error === 'string'
              ? parsed.error
              : 'Google Health request failed.',
          )
        }
        return body
      } finally {
        clearTimeout(timeout)
      }
    }

    const tools = [
        defineTool({
          name: 'get_health_context',
          description:
            'Get the connected Google Health profile and settings, including the account timezone used to interpret dates.',
          async run() {
            return await request('context', {})
          },
        }),
        defineTool({
          name: 'query_health_data',
          description:
            'Read a bounded date range from Google Health. Use daily-rollup for daily totals, list for readings/sessions, and reconcile for a merged source stream. Most ranges allow 31 days; heart-rate, total-calories, active-minutes, and calories-in-heart-rate-zone rollups allow 14.',
          input: v.object({
            dataType: v.picklist(
              DATA_TYPES,
              'A supported Google Health data type',
            ),
            operation: v.picklist(
              ['list', 'daily-rollup', 'reconcile'],
              'How Google Health should read or aggregate the data',
            ),
            from: v.pipe(
              v.string(),
              v.description('Start date in YYYY-MM-DD format'),
            ),
            to: v.pipe(
              v.string(),
              v.description(
                'Inclusive end date in YYYY-MM-DD format; at most 31 days after from',
              ),
            ),
            timeZone: v.pipe(
              v.string(),
              v.description(
                'IANA timezone from get_health_context settings, e.g. Europe/Rome',
              ),
            ),
            limit: v.optional(
              v.pipe(
                v.number(),
                v.description(
                  'Maximum rows for list/reconcile, 1–100; defaults to 50',
                ),
              ),
            ),
          }),
          async run({ data }) {
            return await request('query', data)
          },
        }),
    ]

    return defineSubagent({
      name: 'google-health',
      description:
        'The user’s Google Health data (read-only): steps, workouts, sleep, heart rate, weight, SpO2, HRV, nutrition, and related trends. Delegate all personal health-data questions here; do not treat them as goals or tasks.',
      agent: () => {
        for (const tool of tools) useTool(tool)
        return INSTRUCTIONS
      },
    })
  },
}
