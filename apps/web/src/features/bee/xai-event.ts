import { z } from 'zod'

// A field the xai realtime socket may omit or fill with a shape this hook
// does not consume; both degrade to "absent" instead of dropping the event.
const lenientString = z.string().optional().catch(undefined)

/** The subset of the xai realtime event vocabulary this hook consumes. */
export const xaiEventSchema = z.object({
  type: lenientString,
  transcript: lenientString,
  item_id: lenientString,
  delta: lenientString,
  response_id: lenientString,
  message: lenientString,
  response: z.object({ id: lenientString }).optional().catch(undefined),
  error: z.object({ message: lenientString }).optional().catch(undefined),
  ping_timestamp: z.union([z.number(), z.string()]).optional().catch(undefined),
})

export type XaiEvent = z.infer<typeof xaiEventSchema>
