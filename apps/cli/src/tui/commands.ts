export const BEE_COMMANDS = [
  { name: "/new", description: "Start a fresh conversation" },
  { name: "/clear", description: "Clear the visible conversation" },
  { name: "/help", description: "Show commands and shortcuts" },
  { name: "/exit", description: "Leave Bee" },
] as const;

export type BeeCommand = (typeof BEE_COMMANDS)[number];

function fuzzyMatch(value: string, query: string) {
  let queryIndex = 0;
  for (const character of value) {
    if (character === query[queryIndex]) queryIndex += 1;
  }
  return queryIndex === query.length;
}

export function commandSuggestions(value: string): BeeCommand[] {
  if (!value.startsWith("/") || /\s/.test(value)) return [];
  const query = value.toLowerCase();
  const nameMatches = BEE_COMMANDS.filter(({ name }) =>
    fuzzyMatch(name.toLowerCase(), query),
  );
  const matches = nameMatches.length
    ? nameMatches
    : BEE_COMMANDS.filter(({ name, description }) =>
        fuzzyMatch(`${name} ${description}`.toLowerCase(), query),
      );
  return matches.sort((left, right) => {
    const leftPrefix = left.name.startsWith(query) ? 0 : 1;
    const rightPrefix = right.name.startsWith(query) ? 0 : 1;
    return leftPrefix - rightPrefix || left.name.localeCompare(right.name);
  });
}
