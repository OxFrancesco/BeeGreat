import { z } from 'zod';

/**
 * The generative UI vocabulary shared with the Bee agent
 * (see packages/agent/src/agents/bee.md).
 */
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
  z.object({ type: z.literal('highlight'), title: z.string(), body: z.string() }),
  z.object({
    type: z.literal('confirm'),
    summary: z.string(),
    action: z.string(),
    payload: z.record(z.string(), z.unknown()).optional(),
  }),
]);

export type UIComponent = z.infer<typeof uiComponentSchema>;

const uiSpecSchema = z.object({ components: z.array(uiComponentSchema) });

const BEEUI_BLOCK = /```beeui\s*([\s\S]*?)```/g;

/** Splits agent text into the spoken/displayed sentence and validated UI components. */
export function extractBeeUI(text: string): { spoken: string; components: UIComponent[] } {
  const components: UIComponent[] = [];
  const spoken = text
    .replace(BEEUI_BLOCK, (_match, json: string) => {
      try {
        const parsed = uiSpecSchema.safeParse(JSON.parse(json));
        if (parsed.success) components.push(...parsed.data.components);
      } catch {
        // Malformed block: drop it rather than reading JSON aloud.
      }
      return '';
    })
    .replace(/\s+/g, ' ')
    .trim();
  return { spoken, components };
}
