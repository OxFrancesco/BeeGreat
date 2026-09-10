package com.beegreat.flue

import java.io.IOException
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.delay
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.runInterruptible
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import okhttp3.Response

enum class LiveMode(val queryValue: String) {
  Sse("sse"),
  LongPoll("long-poll"),
}

/**
 * One delivered batch from the durable stream. Empty batches are keep-alives
 * and still carry a safe resume offset.
 */
data class StreamBatch(
  val items: List<JsonElement>,
  val nextOffset: String,
  val upToDate: Boolean,
  val streamClosed: Boolean,
)

/**
 * Reads the conversation `updates` view as a Durable Stream.
 *
 * Protocol, verified against `@durable-streams/client` 0.2.6:
 * - `GET <url>?view=updates&offset=<o>` returns a JSON array batch with
 *   `Stream-Next-Offset`, and `Stream-Up-To-Date` once caught up.
 * - When up to date, `&live=sse` opens `text/event-stream`. `event: data`
 *   frames carry JSON (an item or an array of items) and are buffered until the
 *   `event: control` frame, whose JSON `{streamNextOffset, upToDate,
 *   streamClosed}` seals the batch. A control frame with no data is a
 *   keep-alive.
 * - `&live=long-poll` blocks until new data or a server timeout, then returns
 *   a normal JSON batch.
 *
 * The resume offset only advances per fully delivered batch, so a dropped
 * connection redelivers at most the in-flight batch; the observer dedups by
 * chunk position.
 */
fun FlueHttp.updates(offset: String, live: LiveMode): Flow<StreamBatch> = flow {
  var current = offset
  var upToDate = false
  var attempt = 0
  while (true) {
    currentCoroutineContext().ensureActive()
    try {
      if (!upToDate) {
        val batch = readJsonBatch(request(url("", mapOf("view" to "updates", "offset" to current))))
        current = batch.nextOffset
        upToDate = batch.upToDate
        attempt = 0
        emit(batch)
        if (batch.streamClosed) return@flow
        continue
      }
      when (live) {
        LiveMode.LongPoll -> {
          val batch = readJsonBatch(request(url("", mapOf("view" to "updates", "offset" to current, "live" to live.queryValue)), stream = true))
          current = batch.nextOffset
          upToDate = batch.upToDate || upToDate
          attempt = 0
          emit(batch)
          if (batch.streamClosed) return@flow
        }
        LiveMode.Sse -> {
          val response = request(url("", mapOf("view" to "updates", "offset" to current, "live" to live.queryValue)), stream = true)
          if (!response.isSuccessful) throw response.toApiError()
          if (response.header("content-type")?.contains("text/event-stream") != true) {
            val batch = readJsonBatch(response)
            current = batch.nextOffset
            emit(batch)
            if (batch.streamClosed) return@flow
            continue
          }
          var closed = false
          readSse(response) { batch ->
            current = batch.nextOffset
            attempt = 0
            emit(batch)
            if (batch.streamClosed) closed = true
          }
          if (closed) return@flow
          // The connection ended without a stream-closed control frame:
          // reconnect and catch up from the last delivered offset.
          upToDate = false
        }
      }
    } catch (e: FlueApiError) {
      // 4xx is not something a retry fixes; hand it to the observer.
      if (e.status in 400..499 && e.status != 429) throw e
      delay(backoff(attempt++))
      upToDate = false
    } catch (e: IOException) {
      if (attempt >= MAX_TRANSPORT_RETRIES) throw e
      delay(backoff(attempt++))
      upToDate = false
    }
  }
}

private const val MAX_TRANSPORT_RETRIES = 5

private fun backoff(attempt: Int): Long = minOf(200L shl attempt, 10_000L)

private fun Response.toApiError(): FlueApiError = FlueApiError(code, runCatching { body.string() }.getOrNull()?.ifEmpty { null }, header("flue-error-ref"))

private fun readJsonBatch(response: Response): StreamBatch =
  response.use {
    if (!it.isSuccessful) throw it.toApiError()
    val text = it.body.string().trim().ifEmpty { "[]" }
    val parsed = FlueJson.parseToJsonElement(text)
    StreamBatch(
      items = if (parsed is JsonArray) parsed.toList() else listOf(parsed),
      nextOffset = it.header(STREAM_OFFSET_HEADER) ?: error("Missing $STREAM_OFFSET_HEADER"),
      upToDate = it.header(STREAM_UP_TO_DATE_HEADER) != null,
      streamClosed = it.header(STREAM_CLOSED_HEADER)?.equals("true", ignoreCase = true) == true,
    )
  }

private suspend fun readSse(response: Response, onBatch: suspend (StreamBatch) -> Unit) {
  response.use {
    val source = it.body.source()
    val dataParts = mutableListOf<String>()
    var eventType: String? = null
    val data = mutableListOf<String>()

    suspend fun flushEvent() {
      val type = eventType
      if (type != null && data.isNotEmpty()) {
        val payload = data.joinToString("\n")
        when (type) {
          "data" -> dataParts += payload
          "control" -> {
            val control = FlueJson.parseToJsonElement(payload) as? kotlinx.serialization.json.JsonObject
              ?: throw ConversationStreamError("Failed to parse SSE control event: $payload")
            val items = mergeJsonParts(dataParts)
            dataParts.clear()
            onBatch(
              StreamBatch(
                items = items,
                nextOffset = control["streamNextOffset"]?.stringOrNull() ?: error("Control frame missing streamNextOffset"),
                upToDate = control["upToDate"]?.stringOrNull()?.toBoolean() ?: false,
                streamClosed = control["streamClosed"]?.stringOrNull()?.toBoolean() ?: false,
              )
            )
          }
        }
      }
      eventType = null
      data.clear()
    }

    while (true) {
      val line = runInterruptible { source.readUtf8Line() } ?: break
      when {
        line.isEmpty() -> flushEvent()
        line.startsWith("event:") -> eventType = line.substring(6).removePrefix(" ")
        line.startsWith("data:") -> data += line.substring(5).removePrefix(" ")
      }
    }
    // A connection can end mid-event; the DS client flushes what it has.
    flushEvent()
  }
}

/** Each data frame is a JSON value or array; they merge into one item list like the DS client. */
private fun mergeJsonParts(parts: List<String>): List<JsonElement> =
  parts.flatMap { part ->
    val trimmed = part.trim()
    if (trimmed.isEmpty()) emptyList()
    else
      when (val parsed = FlueJson.parseToJsonElement(trimmed)) {
        is JsonArray -> parsed.toList()
        else -> listOf(parsed)
      }
  }

private const val STREAM_OFFSET_HEADER = "Stream-Next-Offset"
private const val STREAM_UP_TO_DATE_HEADER = "Stream-Up-To-Date"
private const val STREAM_CLOSED_HEADER = "Stream-Closed"
