package com.beegreat.contract

import java.io.File
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.doubleOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Asserts the Kotlin contract against `packages/tool-presentation/fixtures/beeui.json`,
 * which the TypeScript source of truth generates. See ADR 0003.
 */
class SharedFixturesTest {
  private val fixtures: JsonObject by lazy {
    val file = generateSequence(File(System.getProperty("user.dir"))) { it.parentFile }
      .map { File(it, "packages/tool-presentation/fixtures/beeui.json") }
      .first { it.exists() }
    Json.parseToJsonElement(file.readText()).jsonObject
  }

  @Test
  fun `extractBeeUi matches the TypeScript implementation`() {
    for (entry in fixtures["extract"]!!.jsonArray) {
      val obj = entry.jsonObject
      val input = obj["input"]!!.jsonPrimitive.content
      val result = extractBeeUi(input)
      assertEquals("spoken for: $input", obj["spoken"]!!.jsonPrimitive.content, result.spoken)
      assertJsonEquals("components for: $input", obj["components"]!!, buildJsonArray { result.components.forEach { add(it.toFixtureJson()) } })
      assertJsonEquals("followUps for: $input", obj["followUps"]!!, deriveBeeUiFollowUps(result.components).toFixtureJson())
    }
  }

  @Test
  fun `scrubIdentifiers matches the TypeScript implementation`() {
    for (entry in fixtures["scrub"]!!.jsonArray) {
      val obj = entry.jsonObject
      val input = obj["input"]!!.jsonPrimitive.content
      assertEquals(input, obj["output"]!!.jsonPrimitive.content, scrubIdentifiers(input))
      assertEquals(input, obj["preserved"]!!.jsonPrimitive.content, scrubIdentifiers(input, preserveAddresses = true))
    }
  }

  @Test
  fun `getToolCopy matches the TypeScript implementation`() {
    for (entry in fixtures["toolCopy"]!!.jsonArray) {
      val obj = entry.jsonObject
      val state =
        when (obj["state"]!!.jsonPrimitive.content) {
          "running" -> ToolActivityState.Running
          "error" -> ToolActivityState.Error
          else -> ToolActivityState.Done
        }
      val copy = getToolCopy(obj["name"]!!.jsonPrimitive.content, state, obj["input"])
      val expected = obj["output"]!!.jsonObject
      assertEquals(expected["label"]!!.jsonPrimitive.content, copy.label)
      assertEquals(expected["powerup"]?.let { (it as? JsonPrimitive)?.takeIf { p -> p.isString }?.content }, copy.powerup)
      assertEquals(expected["specialist"]?.let { (it as? JsonPrimitive)?.takeIf { p -> p.isString }?.content }, copy.specialist)
    }
  }

  private fun assertJsonEquals(message: String, expected: JsonElement, actual: JsonElement) {
    assertTrue("$message\nexpected: $expected\nactual:   $actual", jsonEquals(expected, actual))
  }

  /** Structural equality where `500` and `500.0` are the same number. */
  private fun jsonEquals(a: JsonElement, b: JsonElement): Boolean =
    when {
      a is JsonObject && b is JsonObject -> a.keys == b.keys && a.keys.all { jsonEquals(a[it]!!, b[it]!!) }
      a is JsonArray && b is JsonArray -> a.size == b.size && a.indices.all { jsonEquals(a[it], b[it]) }
      a is JsonPrimitive && b is JsonPrimitive ->
        if (!a.isString && !b.isString && a.doubleOrNull != null && b.doubleOrNull != null) a.doubleOrNull == b.doubleOrNull
        else a == b
      else -> a == b
    }
}

/** Mirrors how the TypeScript component serializes: `type` first, absent optionals omitted. */
private fun BeeUiComponent.toFixtureJson(): JsonElement =
  when (val c = this) {
    is BeeUiComponent.Text -> buildJsonObject { put("type", "text"); put("body", c.body) }
    is BeeUiComponent.Metric -> buildJsonObject { put("type", "metric"); put("label", c.label); put("value", c.value); c.delta?.let { put("delta", it) } }
    is BeeUiComponent.Chart ->
      buildJsonObject {
        put("type", "chart"); put("kind", "bar"); put("title", c.title); c.unit?.let { put("unit", it) }
        put("data", buildJsonArray { c.data.forEach { add(buildJsonObject { put("label", it.label); put("value", it.value) }) } })
      }
    is BeeUiComponent.Tasks ->
      buildJsonObject {
        put("type", "tasks"); put("title", c.title)
        put("items", buildJsonArray { c.items.forEach { add(buildJsonObject { put("id", it.id); put("title", it.title); put("done", it.done); it.due?.let { d -> put("due", d) } }) } })
      }
    is BeeUiComponent.Highlight -> buildJsonObject { put("type", "highlight"); put("title", c.title); put("body", c.body) }
    is BeeUiComponent.Image -> buildJsonObject { put("type", "image"); put("url", c.url); put("alt", c.alt); c.title?.let { put("title", it) } }
    is BeeUiComponent.Bookmark ->
      buildJsonObject {
        put("type", "bookmark"); put("title", c.title); put("url", c.url); c.kind?.let { put("kind", it) }
        c.labels?.let { labels -> put("labels", buildJsonArray { labels.forEach { add(JsonPrimitive(it)) } }) }
        c.note?.let { put("note", it) }
      }
    is BeeUiComponent.Devin ->
      buildJsonObject {
        put("type", "devin"); put("title", c.title); put("status", c.status); c.statusDetail?.let { put("statusDetail", it) }
        put("sessionId", c.sessionId); put("sessionUrl", c.sessionUrl); c.summary?.let { put("summary", it) }
        put("pullRequests", buildJsonArray { c.pullRequests.forEach { add(buildJsonObject { put("url", it.url); it.state?.let { s -> put("state", s) } }) } })
      }
    is BeeUiComponent.FirstFocus ->
      buildJsonObject {
        put("type", "first_focus"); put("requestId", c.requestId); put("goalTitle", c.goalTitle); put("projectTitle", c.projectTitle); put("taskTitle", c.taskTitle)
        c.seed?.let { put("seed", it) }; c.highlightExpiresAt?.let { put("highlightExpiresAt", it) }
      }
    is BeeUiComponent.Confirm -> buildJsonObject { put("type", "confirm"); put("summary", c.summary); put("action", c.action); c.payload?.let { put("payload", it) } }
    is BeeUiComponent.Question ->
      buildJsonObject {
        put("type", "question")
        put("questions", buildJsonArray {
          c.questions.forEach { prompt ->
            add(buildJsonObject {
              put("header", prompt.header); put("question", prompt.question)
              prompt.options?.let { options -> put("options", buildJsonArray { options.forEach { o -> add(buildJsonObject { put("label", o.label); o.description?.let { d -> put("description", d) } }) } }) }
            })
          }
        })
      }
    BeeUiComponent.Unsupported -> buildJsonObject { put("type", "unsupported") }
  }

private fun BeeUiFollowUps.toFixtureJson(): JsonElement = buildJsonObject {
  firstFocus?.let { put("firstFocus", it.toFixtureJson()) }
  web3Confirmation?.let { put("web3Confirmation", buildJsonObject { put("actionId", it.actionId); put("summary", it.summary) }) }
  confirmationSummary?.let { put("confirmation", buildJsonObject { put("summary", it) }) }
  question?.let { put("question", buildJsonObject { put("questions", it.toFixtureJson().jsonObject["questions"] ?: JsonNull) }) }
}
