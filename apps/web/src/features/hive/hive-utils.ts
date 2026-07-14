const GOLIE_BEE_NAMES = [
  'Melli',
  'Pip',
  'Nectar',
  'Mochi',
  'Sunny',
  'Pollen',
  'Bibi',
] as const

export function getGolieBeeName(seed: string) {
  let hash = 0
  for (const character of seed) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0
  }
  return GOLIE_BEE_NAMES[hash % GOLIE_BEE_NAMES.length]
}

export function formatHighlightExpiry(timestamp: number) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    hour: 'numeric',
    minute: '2-digit',
  }).format(timestamp)
}
