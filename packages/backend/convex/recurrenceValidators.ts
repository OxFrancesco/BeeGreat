import { v } from 'convex/values'

export const recurrenceFrequencyValidator = v.union(
  v.literal('daily'),
  v.literal('weekly'),
  v.literal('monthly'),
  v.literal('yearly'),
)

export const recurrenceInputValidator = v.object({
  frequency: recurrenceFrequencyValidator,
  interval: v.number(),
  firstOccurrenceAt: v.number(),
})

export type RecurrenceFrequency =
  | 'daily'
  | 'weekly'
  | 'monthly'
  | 'yearly'

export type RecurrenceInput = {
  frequency: RecurrenceFrequency
  interval: number
  firstOccurrenceAt: number
}
