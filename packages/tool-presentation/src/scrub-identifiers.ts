// Internal record ids (Convex documents, Devin sessions, request ids) are
// plumbing for tools, never something the user should read. The agent prompt
// forbids them in user-facing copy; this scrubber is the defense-in-depth for
// the occasions the model slips one in anyway.

// Labelled ids: "ID: j970…", "(id j970…)", "session: devin-abc…", with an
// optional leading separator ("· ID: …") so the joint is removed with them.
const LABELLED_ID =
  /\s*[(\[]?\s*(?:[·•|,;:–—-]\s*)?\b(?:id|ids|identifier|session\s*id|request\s*id)\b\s*[:#=]?\s*[A-Za-z0-9_-]{10,}\s*[)\]]?/gi;

// Bare Convex-style document ids: 32 lowercase base-36 characters. Skipped
// inside URLs/paths/emails so links keep working.
const BARE_CONVEX_ID = /(^|[^/\w.@-])[a-z][a-z0-9]{31}(?![\w.-])/g;

// Bare Devin session ids outside URLs.
const BARE_DEVIN_ID = /(^|[^/\w.@-])devin-[A-Za-z0-9_-]{6,}(?![\w.-])/g;

/** Removes machine identifiers from user-facing copy and tidies the seams. */
export function scrubIdentifiers(text: string): string {
  return text
    .replace(LABELLED_ID, '')
    .replace(BARE_CONVEX_ID, '$1')
    .replace(BARE_DEVIN_ID, '$1')
    .replace(/\s*([·•|])\s*(?=[·•|.,;:!?)]|$)/g, '')
    .replace(/\(\s*\)|\[\s*\]/g, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\s+([.,;:!?])/g, '$1')
    .trim();
}
