/** Makes a user-entered domain fetchable while rejecting non-web schemes. */
export function normalizeBookmarkInputUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const hasScheme = /^[a-z][a-z\d+.-]*:/i.test(trimmed);
  const candidate = trimmed.startsWith('//')
    ? `https:${trimmed}`
    : hasScheme
      ? trimmed
      : `https://${trimmed}`;

  try {
    const parsed = new URL(candidate);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
      ? parsed.toString()
      : null;
  } catch {
    return null;
  }
}
