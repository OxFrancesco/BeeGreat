'use node'

import { v } from 'convex/values'
import { internal } from './_generated/api'
import { internalAction } from './_generated/server'
import type { ActionCtx } from './_generated/server'
import { resolveGoogleHealthAccessToken } from './googleHealthAuthActions'

const API_BASE = 'https://health.googleapis.com/v4'
const MAX_RANGE_DAYS = 31
const SHORT_ROLLUP_RANGE_DAYS = 14
const SHORT_ROLLUP_TYPES = new Set([
  'heart-rate',
  'total-calories',
  'active-minutes',
  'calories-in-heart-rate-zone',
])

type TimeField = 'interval' | 'sample' | 'daily' | 'none'
type DataType = {
  filterName: string
  timeField: TimeField
  filterField?: string
  operations: ReadonlyArray<'list' | 'daily-rollup' | 'reconcile'>
}

// Ported from the live-verified registry in resources/google-health-cli.
// ECG, irregular-rhythm notifications, and exercise routes are deliberately
// excluded from the initial least-privilege OAuth grant.
const DATA_TYPES: Record<string, DataType> = {
  steps: {
    filterName: 'steps',
    timeField: 'interval',
    operations: ['list', 'daily-rollup', 'reconcile'],
  },
  'heart-rate': {
    filterName: 'heart_rate',
    timeField: 'sample',
    operations: ['list', 'daily-rollup', 'reconcile'],
  },
  exercise: {
    filterName: 'exercise',
    timeField: 'interval',
    operations: ['list', 'reconcile'],
  },
  distance: {
    filterName: 'distance',
    timeField: 'interval',
    operations: ['list', 'daily-rollup', 'reconcile'],
  },
  'active-zone-minutes': {
    filterName: 'active_zone_minutes',
    timeField: 'interval',
    operations: ['list', 'daily-rollup', 'reconcile'],
  },
  altitude: {
    filterName: 'altitude',
    timeField: 'interval',
    operations: ['list', 'daily-rollup', 'reconcile'],
  },
  'basal-energy-burned': {
    filterName: 'basal_energy_burned',
    timeField: 'interval',
    operations: ['list', 'reconcile'],
  },
  'active-energy-burned': {
    filterName: 'active_energy_burned',
    timeField: 'interval',
    operations: ['list', 'daily-rollup', 'reconcile'],
  },
  'vo2-max': {
    filterName: 'vo2_max',
    timeField: 'sample',
    operations: ['list', 'reconcile'],
  },
  'heart-rate-variability': {
    filterName: 'heart_rate_variability',
    timeField: 'sample',
    operations: ['list', 'reconcile'],
  },
  'activity-level': {
    filterName: 'activity_level',
    timeField: 'interval',
    operations: ['list', 'reconcile'],
  },
  floors: {
    filterName: 'floors',
    timeField: 'interval',
    operations: ['daily-rollup', 'reconcile'],
  },
  'active-minutes': {
    filterName: 'active_minutes',
    timeField: 'interval',
    operations: ['daily-rollup', 'reconcile'],
  },
  weight: {
    filterName: 'weight',
    timeField: 'sample',
    operations: ['list', 'daily-rollup', 'reconcile'],
  },
  'body-fat': {
    filterName: 'body_fat',
    timeField: 'sample',
    operations: ['list', 'daily-rollup', 'reconcile'],
  },
  height: {
    filterName: 'height',
    timeField: 'sample',
    operations: ['list', 'reconcile'],
  },
  'oxygen-saturation': {
    filterName: 'oxygen_saturation',
    timeField: 'sample',
    operations: ['list', 'reconcile'],
  },
  'blood-glucose': {
    filterName: 'blood_glucose',
    timeField: 'sample',
    operations: ['list', 'daily-rollup', 'reconcile'],
  },
  'core-body-temperature': {
    filterName: 'core_body_temperature',
    timeField: 'sample',
    operations: ['list', 'daily-rollup', 'reconcile'],
  },
  sleep: {
    filterName: 'sleep',
    timeField: 'interval',
    filterField: 'sleep.interval.civil_end_time',
    operations: ['list', 'reconcile'],
  },
  'daily-resting-heart-rate': {
    filterName: 'daily_resting_heart_rate',
    timeField: 'daily',
    operations: ['list', 'reconcile'],
  },
  'daily-heart-rate-variability': {
    filterName: 'daily_heart_rate_variability',
    timeField: 'daily',
    operations: ['list', 'reconcile'],
  },
  'daily-oxygen-saturation': {
    filterName: 'daily_oxygen_saturation',
    timeField: 'daily',
    operations: ['list', 'reconcile'],
  },
  'daily-respiratory-rate': {
    filterName: 'daily_respiratory_rate',
    timeField: 'daily',
    operations: ['list', 'reconcile'],
  },
  'daily-vo2-max': {
    filterName: 'daily_vo2_max',
    timeField: 'daily',
    operations: ['list', 'reconcile'],
  },
  'daily-sleep-temperature-derivations': {
    filterName: 'daily_sleep_temperature_derivations',
    timeField: 'daily',
    operations: ['list', 'reconcile'],
  },
  'daily-heart-rate-zones': {
    filterName: 'daily_heart_rate_zones',
    timeField: 'daily',
    operations: ['reconcile'],
  },
  'respiratory-rate-sleep-summary': {
    filterName: 'respiratory_rate_sleep_summary',
    timeField: 'sample',
    operations: ['list', 'reconcile'],
  },
  'run-vo2-max': {
    filterName: 'run_vo2_max',
    timeField: 'sample',
    operations: ['list', 'daily-rollup', 'reconcile'],
  },
  'sedentary-period': {
    filterName: 'sedentary_period',
    timeField: 'interval',
    operations: ['list', 'daily-rollup', 'reconcile'],
  },
  'swim-lengths-data': {
    filterName: 'swim_lengths_data',
    timeField: 'interval',
    operations: ['list', 'daily-rollup', 'reconcile'],
  },
  'hydration-log': {
    filterName: 'hydration_log',
    timeField: 'interval',
    operations: ['list', 'daily-rollup', 'reconcile'],
  },
  'total-calories': {
    filterName: 'total_calories',
    timeField: 'interval',
    operations: ['daily-rollup'],
  },
  'time-in-heart-rate-zone': {
    filterName: 'time_in_heart_rate_zone',
    timeField: 'interval',
    operations: ['daily-rollup', 'reconcile'],
  },
  'calories-in-heart-rate-zone': {
    filterName: 'calories_in_heart_rate_zone',
    timeField: 'interval',
    operations: ['daily-rollup', 'reconcile'],
  },
  'nutrition-log': {
    filterName: 'nutrition_log',
    timeField: 'interval',
    operations: ['list', 'daily-rollup', 'reconcile'],
  },
  food: { filterName: 'food', timeField: 'none', operations: ['list'] },
  'food-measurement-unit': {
    filterName: 'food_measurement_unit',
    timeField: 'none',
    operations: ['list'],
  },
}

function parseDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value))
    throw new Error('Dates must use YYYY-MM-DD.')
  const date = new Date(`${value}T00:00:00.000Z`)
  if (
    !Number.isFinite(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
  ) {
    throw new Error(`Invalid date: ${value}`)
  }
  return date
}

function addDays(value: string, days: number) {
  const date = parseDate(value)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

function validateRange(
  dataType: string,
  operation: 'list' | 'daily-rollup' | 'reconcile',
  from: string,
  to: string,
) {
  const start = parseDate(from)
  const end = parseDate(to)
  const days = Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1
  if (days < 1)
    throw new Error('The end date must be on or after the start date.')
  const maximum =
    operation === 'daily-rollup' && SHORT_ROLLUP_TYPES.has(dataType)
      ? SHORT_ROLLUP_RANGE_DAYS
      : MAX_RANGE_DAYS
  if (days > maximum)
    throw new Error(
      `${dataType} ${operation} queries are limited to ${maximum} days at a time.`,
    )
}

function zonedMidnight(date: string, timeZone: string) {
  parseDate(date)
  let instant = Date.parse(`${date}T00:00:00.000Z`)
  let formatter: Intl.DateTimeFormat
  try {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    })
  } catch {
    throw new Error(`Invalid IANA timezone: ${timeZone}`)
  }
  const target = Date.parse(`${date}T00:00:00.000Z`)
  for (let attempt = 0; attempt < 2; attempt++) {
    const parts = Object.fromEntries(
      formatter
        .formatToParts(new Date(instant))
        .filter((part) => part.type !== 'literal')
        .map((part) => [part.type, Number(part.value)]),
    )
    const represented = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
    )
    instant += target - represented
  }
  return new Date(instant).toISOString().replace('.000Z', 'Z')
}

function filterFor(type: DataType, from: string, to: string, timeZone: string) {
  if (type.timeField === 'none') return undefined
  const path =
    type.filterField ??
    (type.timeField === 'sample'
      ? `${type.filterName}.sample_time.physical_time`
      : type.timeField === 'daily'
        ? `${type.filterName}.date`
        : `${type.filterName}.interval.civil_start_time`)
  const exclusiveTo = addDays(to, 1)
  if (type.timeField === 'sample') {
    return `${path} >= "${zonedMidnight(from, timeZone)}" AND ${path} < "${zonedMidnight(exclusiveTo, timeZone)}"`
  }
  if (type.timeField === 'daily') {
    return `${path} >= "${from}" AND ${path} < "${exclusiveTo}"`
  }
  return `${path} >= "${from}T00:00:00" AND ${path} < "${exclusiveTo}T00:00:00"`
}

function civilDate(value: string) {
  const date = parseDate(value)
  return {
    date: {
      year: date.getUTCFullYear(),
      month: date.getUTCMonth() + 1,
      day: date.getUTCDate(),
    },
  }
}

async function requireGoogleHealth(
  ctx: ActionCtx,
  userId: string,
): Promise<string> {
  const enabled = await ctx.runQuery(internal.powerups.checkEnabled, {
    userId,
    powerupId: 'google-health',
  })
  if (!enabled)
    throw new Error(
      'The Google Health power-up is not enabled. Turn it on from the profile screen first.',
    )
  return await resolveGoogleHealthAccessToken(ctx, userId)
}

async function googleRequest(
  accessToken: string,
  path: string,
  init?: RequestInit,
) {
  let response: Response | undefined
  for (let attempt = 0; attempt < 4; attempt++) {
    response = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        authorization: `Bearer ${accessToken}`,
        accept: 'application/json',
        ...(init?.body ? { 'content-type': 'application/json' } : {}),
        ...init?.headers,
      },
    })
    if (response.ok) return await response.text()
    if (response.status !== 429 && response.status < 500) break
    if (attempt < 3)
      await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** attempt))
  }
  const message = (await response?.text().catch(() => '')) ?? ''
  if (response?.status === 401 || response?.status === 403) {
    throw new Error(
      'Google Health authorization was rejected. Reconnect the power-up and check its granted scopes.',
    )
  }
  throw new Error(
    `Google Health request failed (${response?.status ?? 'network'}): ${message.slice(0, 300)}`,
  )
}

export const getContext = internalAction({
  args: { userId: v.string() },
  returns: v.string(),
  handler: async (ctx, args): Promise<string> => {
    const token = await requireGoogleHealth(ctx, args.userId)
    const [profile, settings]: [string, string] = await Promise.all([
      googleRequest(token, '/users/me/profile'),
      googleRequest(token, '/users/me/settings'),
    ])
    return JSON.stringify({
      profile: JSON.parse(profile),
      settings: JSON.parse(settings),
    })
  },
})

export const queryData = internalAction({
  args: {
    userId: v.string(),
    dataType: v.string(),
    operation: v.union(
      v.literal('list'),
      v.literal('daily-rollup'),
      v.literal('reconcile'),
    ),
    from: v.string(),
    to: v.string(),
    timeZone: v.string(),
    limit: v.optional(v.number()),
  },
  returns: v.string(),
  handler: async (ctx, args): Promise<string> => {
    const type = DATA_TYPES[args.dataType]
    if (!type)
      throw new Error(`Unsupported Google Health data type: ${args.dataType}`)
    if (!type.operations.includes(args.operation)) {
      throw new Error(
        `${args.dataType} does not support ${args.operation}. Supported: ${type.operations.join(', ')}`,
      )
    }
    validateRange(args.dataType, args.operation, args.from, args.to)
    const token = await requireGoogleHealth(ctx, args.userId)
    const path = `/users/me/dataTypes/${encodeURIComponent(args.dataType)}/dataPoints`
    if (args.operation === 'daily-rollup') {
      return await googleRequest(token, `${path}:dailyRollUp`, {
        method: 'POST',
        body: JSON.stringify({
          range: {
            start: civilDate(args.from),
            end: civilDate(addDays(args.to, 1)),
          },
          windowSizeDays: 1,
        }),
      })
    }
    const query = new URLSearchParams()
    const filter = filterFor(type, args.from, args.to, args.timeZone)
    if (filter) query.set('filter', filter)
    if (args.operation === 'list') {
      query.set(
        'pageSize',
        String(
          Math.max(
            1,
            Math.min(
              Math.floor(args.limit ?? 50),
              args.dataType === 'sleep' || args.dataType === 'exercise'
                ? 25
                : 100,
            ),
          ),
        ),
      )
    }
    const suffix = args.operation === 'reconcile' ? ':reconcile' : ''
    const queryString = query.toString()
    return await googleRequest(
      token,
      `${path}${suffix}${queryString ? `?${queryString}` : ''}`,
    )
  },
})
