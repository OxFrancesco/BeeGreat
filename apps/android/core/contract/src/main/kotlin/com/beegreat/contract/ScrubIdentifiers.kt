package com.beegreat.contract

// Port of packages/tool-presentation/src/scrub-identifiers.ts. Internal record
// ids are plumbing for tools, never something the user should read.

private val LABELLED_ID =
  Regex(
    """\s*[(\[]?\s*(?:[·•|,;:–—-]\s*)?\b(?:id|ids|identifier|session\s*id|request\s*id)\b\s*[:#=]?\s*[A-Za-z0-9_-]{10,}\s*[)\]]?""",
    RegexOption.IGNORE_CASE,
  )
private val BARE_CONVEX_ID = Regex("""(^|[^/\w.@-])[a-z][a-z0-9]{31}(?![\w.-])""")
private val BARE_DEVIN_ID = Regex("""(^|[^/\w.@-])devin-[A-Za-z0-9_-]{6,}(?![\w.-])""")
private val DANGLING_SEPARATOR = Regex("""\s*([·•|])\s*(?=[·•|.,;:!?)]|$)""")
private val EMPTY_BRACKETS = Regex("""\(\s*\)|\[\s*]""")
private val RUNS_OF_SPACES = Regex("""[ \t]{2,}""")
private val SPACE_BEFORE_PUNCTUATION = Regex("""\s+([.,;:!?])""")
private val EVM_ADDRESS = Regex("""0x[0-9a-fA-F]{40}""")

/** Removes machine identifiers from user-facing copy and tidies the seams. */
fun scrubIdentifiers(text: String, preserveAddresses: Boolean = false): String =
  text
    .replace(LABELLED_ID) { match -> if (preserveAddresses && EVM_ADDRESS.containsMatchIn(match.value)) match.value else "" }
    .replace(BARE_CONVEX_ID, "$1")
    .replace(BARE_DEVIN_ID, "$1")
    .replace(DANGLING_SEPARATOR, "")
    .replace(EMPTY_BRACKETS, "")
    .replace(RUNS_OF_SPACES, " ")
    .replace(SPACE_BEFORE_PUNCTUATION, "$1")
    .trim()
