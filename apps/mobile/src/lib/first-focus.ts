import { z } from 'zod';

export const firstFocusPreviewSchema = z.object({
  type: z.literal('first_focus'),
  requestId: z.string().min(1),
  goalTitle: z.string().min(1),
  projectTitle: z.string().min(1),
  taskTitle: z.string().min(1),
  seed: z.string().min(1).optional(),
  highlightExpiresAt: z.number().finite().optional(),
});

export type FirstFocusPreview = z.infer<typeof firstFocusPreviewSchema>;

const GOLIE_BEE_NAMES = ['Melli', 'Pip', 'Nectar', 'Mochi', 'Sunny', 'Pollen', 'Bibi'] as const;

/** A stable presentation name for the single MVP GolieBee preset. */
export function getGolieBeeName(seed: string): string {
  let hash = 0;
  for (const character of seed) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  }
  return GOLIE_BEE_NAMES[hash % GOLIE_BEE_NAMES.length];
}

/** Uses a persisted customization seed when the backend supplies one. */
export function getStableGolieBeeSeed(value: unknown, fallback: string): string {
  if (!value || typeof value !== 'object' || !('seed' in value)) return fallback;
  const seed = value.seed;
  return typeof seed === 'string' && seed.trim() ? seed : fallback;
}

export function formatHighlightExpiry(timestamp: number): string {
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    hour: 'numeric',
    minute: '2-digit',
  }).format(timestamp);
}

export function endOfLocalDay(dayOffset = 0): number {
  const date = new Date();
  date.setDate(date.getDate() + dayOffset);
  date.setHours(23, 59, 59, 999);
  return date.getTime();
}
