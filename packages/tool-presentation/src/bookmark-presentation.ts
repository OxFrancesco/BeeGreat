// Shared presentation vocabulary for saved bookmarks ("Mind"). Web and
// mobile render bookmarks with their own components, but the words users
// read come from this module so the platforms cannot drift. Where the two
// apps deliberately differ today, the difference is an explicit option here
// instead of a hidden fork.

export type BookmarkKind = "website" | "tweet" | "youtube";

/**
 * Human names for each bookmark kind. Mobile's detail screen deliberately
 * says "Post" instead of "Tweet" and keeps that copy local.
 */
export const BOOKMARK_KIND_LABELS = {
  website: "Website",
  tweet: "Tweet",
  youtube: "Video",
} satisfies Record<BookmarkKind, string>;

export function bookmarkKindLabel(kind: BookmarkKind): string {
  return BOOKMARK_KIND_LABELS[kind];
}

/** Compact text glyph for each bookmark kind (web renders these as badges). */
export function bookmarkKindGlyph(kind: BookmarkKind): string {
  return kind === "website" ? "↗" : kind === "tweet" ? "𝕏" : "▶";
}

export type BookmarkSourceLabelOptions = {
  /**
   * Strip a stored leading "@" before prefixing one. Web does this; mobile
   * shows the stored handle verbatim.
   */
  normalizeHandle?: boolean;
  /**
   * Fall back to the crawled site name before the hostname. Web does this;
   * mobile skips straight to the hostname.
   */
  preferSiteName?: boolean;
  /**
   * Copy when the URL cannot be parsed. Web shows the human kind label;
   * mobile shows the raw kind value.
   */
  unparseableUrlLabel: string;
};

/** Who or where a bookmark came from: handle, author, site name, or host. */
export function bookmarkSourceLabel(
  bookmark: {
    url: string;
    meta?: { handle?: string; author?: string; siteName?: string };
  },
  options: BookmarkSourceLabelOptions,
): string {
  const meta = bookmark.meta;
  if (meta?.handle) {
    return `@${options.normalizeHandle ? meta.handle.replace(/^@/, "") : meta.handle}`;
  }
  if (meta?.author) return meta.author;
  if (options.preferSiteName && meta?.siteName) return meta.siteName;
  try {
    return new URL(bookmark.url).hostname.replace(/^www\./, "");
  } catch {
    return options.unparseableUrlLabel;
  }
}

/** Compact age for list rows: "today", "yesterday", "12d ago", then "Mar 4". */
export function bookmarkRelativeDate(timestamp: number): string {
  const days = Math.floor((Date.now() - timestamp) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(timestamp);
}
