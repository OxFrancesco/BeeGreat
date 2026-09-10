package com.beegreat.contract

// Port of the matchers in apps/mobile/src/lib/first-focus-confirmation.ts.

private val CONFIRMATION = Regex("""^(yes|yep|confirm|confirmed|looks good|create it|do it)[.!]?$""", RegexOption.IGNORE_CASE)
private val COMPLETED_PAST =
  Regex("""^(i(?:'ve| have)? )?(completed|finished) ((my|the|this) )?(highlight|task|it)[.!]?$""", RegexOption.IGNORE_CASE)
private val COMPLETE_IMPERATIVE = Regex("""^(complete|finish) ((my|the|this) )?(highlight|task)[.!]?$""", RegexOption.IGNORE_CASE)
private val MARK_DONE = Regex("""^mark ((my|the|this) )?(highlight|task|it)( as)? done[.!]?$""", RegexOption.IGNORE_CASE)

fun isFirstFocusConfirmation(text: String): Boolean = CONFIRMATION.matches(text.trim())

/** Matches explicit completion commands without hijacking conversational uses of "done". */
fun isHighlightCompletion(text: String): Boolean {
  val command = text.trim()
  return COMPLETED_PAST.matches(command) || COMPLETE_IMPERATIVE.matches(command) || MARK_DONE.matches(command)
}
