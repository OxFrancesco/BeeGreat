// The first-focus preview schema and highlight timing live in the shared
// beeui contract (@beegreat/tool-presentation) used by every client.
export {
  endOfLocalDay,
  firstFocusPreviewSchema,
  formatHighlightExpiry,
  type FirstFocusPreview,
} from '@beegreat/tool-presentation';

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
