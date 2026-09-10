package com.beegreat.contract

import java.net.URI
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.doubleOrNull

/**
 * Bee's generative-UI vocabulary. Port of `packages/tool-presentation/src/beeui.ts`,
 * the single source for every client (ADR 0003). Rules:
 * - an unknown component type degrades to [BeeUiComponent.Unsupported];
 * - an invalid known component drops the entire block;
 * - machine ids are scrubbed from every user-visible string.
 */
sealed interface BeeUiComponent {
  data class Text(val body: String) : BeeUiComponent

  data class Metric(val label: String, val value: String, val delta: String? = null) : BeeUiComponent

  data class Chart(val title: String, val unit: String? = null, val data: List<Bar>) : BeeUiComponent {
    data class Bar(val label: String, val value: Double)
  }

  data class Tasks(val title: String, val items: List<Item>) : BeeUiComponent {
    data class Item(val id: String, val title: String, val done: Boolean, val due: String? = null)
  }

  data class Highlight(val title: String, val body: String) : BeeUiComponent

  data class Image(val url: String, val alt: String, val title: String? = null) : BeeUiComponent

  data class Bookmark(
    val title: String,
    val url: String,
    val kind: String? = null,
    val labels: List<String>? = null,
    val note: String? = null,
  ) : BeeUiComponent

  data class Devin(
    val title: String,
    val status: String,
    val statusDetail: String? = null,
    val sessionId: String,
    val sessionUrl: String,
    val summary: String? = null,
    val pullRequests: List<PullRequest>,
  ) : BeeUiComponent {
    data class PullRequest(val url: String, val state: String? = null)
  }

  data class FirstFocus(
    val requestId: String,
    val goalTitle: String,
    val projectTitle: String,
    val taskTitle: String,
    val seed: String? = null,
    val highlightExpiresAt: Double? = null,
  ) : BeeUiComponent

  data class Confirm(val summary: String, val action: String, val payload: JsonObject? = null) : BeeUiComponent

  data class Question(val questions: List<Prompt>) : BeeUiComponent {
    data class Prompt(val header: String, val question: String, val options: List<Option>? = null)

    data class Option(val label: String, val description: String? = null)
  }

  data object Unsupported : BeeUiComponent
}

data class BeeUiExtraction(val spoken: String, val components: List<BeeUiComponent>)

data class Web3Confirmation(val actionId: String, val summary: String)

data class BeeUiFollowUps(
  val firstFocus: BeeUiComponent.FirstFocus? = null,
  val web3Confirmation: Web3Confirmation? = null,
  val confirmationSummary: String? = null,
  val question: BeeUiComponent.Question? = null,
)

/** Matches an opening beeui fence, e.g. to hide a block that is still streaming. */
val BEEUI_FENCE_OPEN = Regex("```beeui", RegexOption.IGNORE_CASE)

private val BEEUI_FENCE = Regex("```beeui\\s*([\\s\\S]*?)```", RegexOption.IGNORE_CASE)
private val MARKDOWN_IMAGE = Regex("""!\[([^\]]*)]\((https://[^\s)]+)(?:\s+["'][^"']*["'])?\)""")
private val TRAILING_SPACES = Regex("""[ \t]+\n""")
private val BLANK_RUNS = Regex("""\n{3,}""")
private val DEVIN_SESSION_ID = Regex("""^devin-[A-Za-z0-9_-]+$""")

private val KNOWN_TYPES =
  setOf("text", "metric", "chart", "tasks", "highlight", "image", "bookmark", "devin", "first_focus", "confirm", "question")

private val json = Json { ignoreUnknownKeys = true; isLenient = false }

/** Splits Bee's reply into conversational copy and validated UI components. */
fun extractBeeUi(text: String): BeeUiExtraction {
  val components = ArrayList<BeeUiComponent>()
  var spoken =
    BEEUI_FENCE.replace(text) { match ->
      components += parseBeeUiBlock(match.groupValues[1].trim())
      ""
    }
  spoken =
    MARKDOWN_IMAGE.replace(spoken) { match ->
      val alt = match.groupValues[1]
      val url = match.groupValues[2]
      if (components.none { it is BeeUiComponent.Image && it.url == url }) {
        components += BeeUiComponent.Image(url, alt.trim().ifEmpty { "Generated image" })
      }
      ""
    }
  spoken = spoken.replace(TRAILING_SPACES, "\n").replace(BLANK_RUNS, "\n\n").trim()
  return BeeUiExtraction(scrubIdentifiers(spoken), components)
}

/** Parses one fenced beeui JSON payload. Empty list when the block is malformed. */
fun parseBeeUiBlock(payload: String): List<BeeUiComponent> {
  val envelope = runCatching { json.parseToJsonElement(payload) }.getOrNull() as? JsonObject ?: return emptyList()
  val list = envelope["components"] as? JsonArray ?: return emptyList()
  val components = ArrayList<BeeUiComponent>()
  for (value in list) {
    val obj = value as? JsonObject ?: return emptyList()
    val type = obj.str("type") ?: return emptyList()
    if (type !in KNOWN_TYPES) {
      components += BeeUiComponent.Unsupported
      continue
    }
    components += parseComponent(type, obj) ?: return emptyList()
  }
  return components
}

private fun parseComponent(type: String, o: JsonObject): BeeUiComponent? =
  when (type) {
    "text" -> BeeUiComponent.Text(scrubIdentifiers(o.str("body") ?: return null))
    "metric" ->
      BeeUiComponent.Metric(
        label = scrubIdentifiers(o.str("label") ?: return null),
        value = scrubIdentifiers(o.str("value") ?: return null),
        delta = o.optStr("delta") { return null }?.let(::scrubIdentifiers),
      )
    "chart" -> {
      if (o.str("kind") != "bar") return null
      val data =
        (o["data"] as? JsonArray ?: return null).map { item ->
          val bar = item as? JsonObject ?: return null
          BeeUiComponent.Chart.Bar(bar.str("label") ?: return null, bar.num("value") ?: return null)
        }
      if (data.isEmpty()) return null
      BeeUiComponent.Chart(scrubIdentifiers(o.str("title") ?: return null), o.optStr("unit") { return null }, data)
    }
    "tasks" -> {
      val items =
        (o["items"] as? JsonArray ?: return null).map { item ->
          val task = item as? JsonObject ?: return null
          BeeUiComponent.Tasks.Item(
            id = task.str("id") ?: return null,
            title = task.str("title") ?: return null,
            done = task.bool("done") ?: return null,
            due = task.optStr("due") { return null },
          )
        }
      BeeUiComponent.Tasks(scrubIdentifiers(o.str("title") ?: return null), items)
    }
    "highlight" ->
      BeeUiComponent.Highlight(scrubIdentifiers(o.str("title") ?: return null), scrubIdentifiers(o.str("body") ?: return null))
    "image" ->
      BeeUiComponent.Image(
        url = o.httpsUrl("url") ?: return null,
        alt = scrubIdentifiers(o.str("alt") ?: return null),
        title = o.optStr("title") { return null }?.let(::scrubIdentifiers),
      )
    "bookmark" -> {
      val kind = o.optStr("kind") { return null }
      if (kind != null && kind !in setOf("website", "tweet", "youtube")) return null
      val labels =
        when (val raw = o["labels"]) {
          null, JsonNull -> null
          is JsonArray -> raw.map { (it as? JsonPrimitive)?.takeIf { p -> p.isString }?.content ?: return null }.also { if (it.size > 8) return null }
          else -> return null
        }
      BeeUiComponent.Bookmark(
        title = scrubIdentifiers(o.str("title") ?: return null),
        url = o.httpsUrl("url") ?: return null,
        kind = kind,
        labels = labels,
        note = o.optStr("note") { return null }?.let(::scrubIdentifiers),
      )
    }
    "devin" -> {
      val sessionId = o.str("sessionId") ?: return null
      if (!DEVIN_SESSION_ID.matches(sessionId)) return null
      val pullRequests =
        (o["pullRequests"] as? JsonArray ?: return null).map { item ->
          val pr = item as? JsonObject ?: return null
          BeeUiComponent.Devin.PullRequest(pr.httpsUrl("url") ?: return null, pr.optStr("state") { return null })
        }
      if (pullRequests.size > 20) return null
      BeeUiComponent.Devin(
        title = scrubIdentifiers(o.str("title") ?: return null),
        status = o.str("status") ?: return null,
        statusDetail = o.optStr("statusDetail") { return null },
        sessionId = sessionId,
        sessionUrl = o.httpsUrl("sessionUrl") ?: return null,
        summary = o.optStr("summary") { return null }?.let(::scrubIdentifiers),
        pullRequests = pullRequests,
      )
    }
    "first_focus" -> {
      val expires =
        when (val raw = o["highlightExpiresAt"]) {
          null, JsonNull -> null
          else -> {
            val value = (raw as? JsonPrimitive)?.doubleOrNull ?: return null
            if (!value.isFinite() || value < -8_640_000_000_000_000.0 || value > 8_640_000_000_000_000.0) return null
            value
          }
        }
      BeeUiComponent.FirstFocus(
        requestId = o.str("requestId")?.takeIf { it.isNotEmpty() } ?: return null,
        goalTitle = o.str("goalTitle")?.takeIf { it.isNotEmpty() } ?: return null,
        projectTitle = o.str("projectTitle")?.takeIf { it.isNotEmpty() } ?: return null,
        taskTitle = o.str("taskTitle")?.takeIf { it.isNotEmpty() } ?: return null,
        seed = o.optStr("seed") { return null }?.also { if (it.isEmpty()) return null },
        highlightExpiresAt = expires,
      )
    }
    "confirm" -> {
      val payload =
        when (val raw = o["payload"]) {
          null, JsonNull -> null
          is JsonObject -> raw
          else -> return null
        }
      BeeUiComponent.Confirm(scrubIdentifiers(o.str("summary") ?: return null), o.str("action") ?: return null, payload)
    }
    "question" -> parseQuestion(o)
    else -> null
  }

private fun parseQuestion(o: JsonObject): BeeUiComponent.Question? {
  val prompts =
    (o["questions"] as? JsonArray ?: return null).map { item ->
      val prompt = item as? JsonObject ?: return null
      val header = prompt.str("header")?.trim()?.takeIf { it.length in 1..24 } ?: return null
      val question = prompt.str("question")?.trim()?.takeIf { it.length in 1..180 } ?: return null
      val options =
        when (val raw = prompt["options"]) {
          null, JsonNull -> null
          is JsonArray ->
            raw
              .map { option ->
                val obj = option as? JsonObject ?: return null
                val label = obj.str("label")?.trim()?.takeIf { it.length in 1..40 } ?: return null
                val description = obj.optStr("description") { return null }?.trim()?.also { if (it.length !in 1..120) return null }
                BeeUiComponent.Question.Option(scrubIdentifiers(label), description?.let(::scrubIdentifiers))
              }
              .also { if (it.size !in 2..3) return null }
          else -> return null
        }
      BeeUiComponent.Question.Prompt(scrubIdentifiers(header), scrubIdentifiers(question), options)
    }
  if (prompts.size !in 1..3) return null
  return BeeUiComponent.Question(prompts)
}

/**
 * Derives the actionable follow-ups from one reply. A Web3 confirmation is
 * surfaced only when exactly one action-bound confirm card is present.
 */
fun deriveBeeUiFollowUps(components: List<BeeUiComponent>): BeeUiFollowUps {
  val firstFocus = components.filterIsInstance<BeeUiComponent.FirstFocus>().firstOrNull()
  val web3 = components.mapNotNull { (it as? BeeUiComponent.Confirm)?.web3Confirmation() }
  val reversed = components.asReversed()
  val confirmation = reversed.filterIsInstance<BeeUiComponent.Confirm>().firstOrNull { it.web3Confirmation() == null }
  val question = reversed.filterIsInstance<BeeUiComponent.Question>().firstOrNull()
  return BeeUiFollowUps(
    firstFocus = firstFocus,
    web3Confirmation = web3.singleOrNull(),
    confirmationSummary = confirmation?.summary,
    question = question,
  )
}

/** A confirm card is action-bound only through a non-empty string `payload.web3ActionId`. */
fun BeeUiComponent.Confirm.web3Confirmation(): Web3Confirmation? {
  val actionId = (payload?.get("web3ActionId") as? JsonPrimitive)?.takeIf { it.isString }?.content?.takeIf { it.isNotEmpty() }
  return actionId?.let { Web3Confirmation(it, summary) }
}

/** Echoes a question-card choice back to Bee as a normal chat message. */
fun questionAnswer(question: String, answer: String): String = "For \u201C$question\u201D, my answer is \u201C$answer\u201D."

/** Hostname without the `www.` prefix; falls back to the raw URL text. */
fun bookmarkHost(url: String): String =
  runCatching { URI(url).host?.removePrefix("www.") }.getOrNull() ?: url

/** Suggested file name when saving a generated image. */
fun generatedImageFileName(url: String, now: Long = System.currentTimeMillis()): String {
  val sourceName = runCatching { URI(url).path.substringAfterLast('/') }.getOrNull() ?: ""
  return if (Regex("""\.(?:avif|gif|jpe?g|png|webp)$""", RegexOption.IGNORE_CASE).containsMatchIn(sourceName)) sourceName
  else "bee-image-$now.png"
}

private fun JsonObject.str(key: String): String? = (this[key] as? JsonPrimitive)?.takeIf { it.isString }?.content

/** Optional string: absent or null passes as null; any other non-string type fails. */
private inline fun JsonObject.optStr(key: String, onInvalid: () -> Nothing): String? =
  when (val raw = this[key]) {
    null, JsonNull -> null
    is JsonPrimitive -> if (raw.isString) raw.content else onInvalid()
    else -> onInvalid()
  }

private fun JsonObject.num(key: String): Double? = (this[key] as? JsonPrimitive)?.takeIf { !it.isString }?.doubleOrNull?.takeIf { it.isFinite() }

private fun JsonObject.bool(key: String): Boolean? = (this[key] as? JsonPrimitive)?.takeIf { !it.isString }?.booleanOrNull

private fun JsonObject.httpsUrl(key: String): String? {
  val value = str(key) ?: return null
  if (!value.startsWith("https://")) return null
  val uri = runCatching { URI(value) }.getOrNull() ?: return null
  if (uri.host.isNullOrEmpty()) return null
  return value
}
