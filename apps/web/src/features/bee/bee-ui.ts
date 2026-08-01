import { scrubIdentifiers } from '@beegreat/tool-presentation'
import { z } from 'zod'

const httpsUrlSchema = z
  .string()
  .url()
  .refine((url) => url.startsWith('https://'), 'Expected an HTTPS URL')

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
  z.object({
    type: z.literal('image'),
    url: httpsUrlSchema,
    alt: z.string(),
    title: z.string().optional(),
  }),
  z.object({
    type: z.literal('bookmark'),
    title: z.string(),
    url: httpsUrlSchema,
    kind: z.enum(['website', 'tweet', 'youtube']).optional(),
    labels: z.array(z.string()).max(8).optional(),
    note: z.string().optional(),
  }),
  z.object({
    type: z.literal('devin'),
    title: z.string(),
    status: z.string(),
    statusDetail: z.string().optional(),
    sessionId: z.string().regex(/^devin-[A-Za-z0-9_-]+$/),
    sessionUrl: httpsUrlSchema,
    summary: z.string().optional(),
    pullRequests: z
      .array(z.object({ url: httpsUrlSchema, state: z.string().optional() }))
      .max(20),
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
const MARKDOWN_IMAGE = /!\[([^\]]*)\]\((https:\/\/[^\s)]+)(?:\s+["'][^"']*["'])?\)/g

/** Machine ids belong in structured fields, never in copy the user reads. */
function scrubComponent(component: UIComponent): UIComponent {
  switch (component.type) {
    case 'text':
      return { ...component, body: scrubIdentifiers(component.body) }
    case 'metric':
      return {
        ...component,
        label: scrubIdentifiers(component.label),
        value: scrubIdentifiers(component.value),
        delta: component.delta
          ? scrubIdentifiers(component.delta)
          : component.delta,
      }
    case 'chart':
    case 'tasks':
      return { ...component, title: scrubIdentifiers(component.title) }
    case 'highlight':
      return {
        ...component,
        title: scrubIdentifiers(component.title),
        body: scrubIdentifiers(component.body),
      }
    case 'image':
      return {
        ...component,
        alt: scrubIdentifiers(component.alt),
        title: component.title
          ? scrubIdentifiers(component.title)
          : component.title,
      }
    case 'devin':
      return {
        ...component,
        title: scrubIdentifiers(component.title),
        summary: component.summary
          ? scrubIdentifiers(component.summary)
          : component.summary,
      }
    case 'bookmark':
      return {
        ...component,
        title: scrubIdentifiers(component.title),
        note: component.note
          ? scrubIdentifiers(component.note)
          : component.note,
      }
    case 'confirm':
      return { ...component, summary: scrubIdentifiers(component.summary) }
    default:
      return component
  }
}

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
        if (parsed.success) {
          components.push(...parsed.data.components.map(scrubComponent))
        }
      } catch {
        // A malformed generated block must never leak raw JSON into the chat.
      }
      return ''
    })
    // Specialists may return Markdown directly. Promote it into the image card.
    .replace(MARKDOWN_IMAGE, (_match, alt: string, url: string) => {
      if (
        !components.some(
          (component) => component.type === 'image' && component.url === url,
        )
      ) {
        components.push({
          type: 'image',
          url,
          alt: alt.trim() || 'Generated image',
        })
      }
      return ''
    })
    // Keep line breaks so markdown structure survives; just trim the excess.
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  return { spoken: scrubIdentifiers(spoken), components }
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
