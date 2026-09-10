package com.beegreat.contract

import java.net.URI
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter

// Port of packages/tool-presentation/src/bookmark-presentation.ts and
// apps/mobile/src/lib/bookmark-url.ts.

val BOOKMARK_KIND_LABELS = mapOf("website" to "Website", "tweet" to "Tweet", "youtube" to "Video")

fun bookmarkKindLabel(kind: String): String = BOOKMARK_KIND_LABELS[kind] ?: kind

/** Who or where a bookmark came from: handle, author, site name, or host. Mobile flavor. */
fun bookmarkSourceLabel(url: String, handle: String?, author: String?, fallback: String): String {
  if (!handle.isNullOrEmpty()) return "@$handle"
  if (!author.isNullOrEmpty()) return author
  return runCatching { URI(url).host?.removePrefix("www.") }.getOrNull() ?: fallback
}

/** Compact age for list rows: "today", "yesterday", "12d ago", then "Mar 4". */
fun bookmarkRelativeDate(timestamp: Long, now: Long = System.currentTimeMillis()): String {
  val days = Math.floorDiv(now - timestamp, 86_400_000L)
  return when {
    days <= 0 -> "today"
    days == 1L -> "yesterday"
    days < 30 -> "${days}d ago"
    else -> DateTimeFormatter.ofPattern("MMM d").format(Instant.ofEpochMilli(timestamp).atZone(ZoneId.systemDefault()))
  }
}

private val SCHEME = Regex("^[a-z][a-z\\d+.-]*:", RegexOption.IGNORE_CASE)

/** Makes a user-entered domain fetchable while rejecting non-web schemes. */
fun normalizeBookmarkInputUrl(value: String): String? {
  val trimmed = value.trim()
  if (trimmed.isEmpty()) return null
  val candidate =
    when {
      trimmed.startsWith("//") -> "https:$trimmed"
      SCHEME.containsMatchIn(trimmed) -> trimmed
      else -> "https://$trimmed"
    }
  val parsed = runCatching { URI(candidate) }.getOrNull() ?: return null
  if (parsed.scheme != "http" && parsed.scheme != "https") return null
  if (parsed.host.isNullOrEmpty()) return null
  return parsed.toString()
}

private val URL_IN_TEXT = Regex("""https?://\S+""", RegexOption.IGNORE_CASE)

/** First web URL inside shared text, or the whole text as a domain. */
fun urlFromSharedText(value: String): String? {
  val match = URL_IN_TEXT.find(value)?.value?.trimEnd('.', ',', ')', ']')
  return normalizeBookmarkInputUrl(match ?: value)
}
