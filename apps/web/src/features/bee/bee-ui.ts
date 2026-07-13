import { z } from 'zod'

export const firstFocusPreviewSchema = z.object({
  type: z.literal('first_focus'),
  requestId: z.string().min(1),
  goalTitle: z.string().min(1),
  projectTitle: z.string().min(1),
  taskTitle: z.string().min(1),
  seed: z.string().min(1).optional(),
  highlightExpiresAt: z.number().finite().optional(),
})

export type FirstFocusPreview = z.infer<typeof firstFocusPreviewSchema>

export const uiComponentSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('text'), body: z.string() }),
  z.object({
    type: z.literal('metric'),
    label: z.string(),
    value: z.string(),
    delta: z.string().optional(),
  }),
  z.object({
    type: z.literal('chart'),
    kind: z.literal('bar'),
    title: z.string(),
    unit: z.string().optional(),
    data: z.array(z.object({ label: z.string(), value: z.number() })).min(1),
  }),
  z.object({
    type: z.literal('tasks'),
    title: z.string(),
    items: z.array(
      z.object({
        id: z.string(),
        title: z.string(),
        done: z.boolean(),
        due: z.string().optional(),
      }),
    ),
  }),
  z.object({
    type: z.literal('highlight'),
    title: z.string(),
    body: z.string(),
  }),
  firstFocusPreviewSchema,
  z.object({
    type: z.literal('confirm'),
    summary: z.string(),
    action: z.string(),
    payload: z.record(z.string(), z.unknown()).optional(),
  }),
])

export type UIComponent = z.infer<typeof uiComponentSchema>

const uiSpecSchema = z.object({ components: z.array(uiComponentSchema) })
const BEEUI_BLOCK = /```beeui\s*([\s\S]*?)```/g

/** Splits Bee's response into conversational copy and validated web UI. */
export function extractBeeUI(text: string): {
  spoken: string
  components: Array<UIComponent>
} {
  const components: Array<UIComponent> = []
  const spoken = text
    .replace(BEEUI_BLOCK, (_match, json: string) => {
      try {
        const parsed = uiSpecSchema.safeParse(JSON.parse(json))
        if (parsed.success) components.push(...parsed.data.components)
      } catch {
        // A malformed generated block must never leak raw JSON into the chat.
      }
      return ''
    })
    .replace(/\s+/g, ' ')
    .trim()

  return { spoken, components }
}

export function endOfLocalDay(dayOffset = 0): number {
  const date = new Date()
  date.setDate(date.getDate() + dayOffset)
  date.setHours(23, 59, 59, 999)
  return date.getTime()
}

export function formatHighlightExpiry(timestamp: number): string {
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    hour: 'numeric',
    minute: '2-digit',
  }).format(timestamp)
}
