package com.beegreat.flue

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive

/** Monotonic ordering token stamped on every chunk. Compared by batch, then index. */
@Serializable
data class ChunkPosition(val batch: LenientLong, val index: LenientLong) : Comparable<ChunkPosition> {
  override fun compareTo(other: ChunkPosition): Int =
    if (batch != other.batch) batch.compareTo(other.batch) else index.compareTo(other.index)
}

class ConversationStreamError(message: String) : RuntimeException(message)

/**
 * The UI projection protocol carried by the `updates` view. The runtime
 * projects its conversation log into these chunks and the observer reduces
 * them into [FlueConversationState]. Mirrors `ConversationStreamChunk`.
 */
sealed interface Chunk {
  val position: ChunkPosition?

  data class Reset(val snapshot: FlueSnapshot, override val position: ChunkPosition) : Chunk

  data class MessageAppended(val message: FlueMessage, override val position: ChunkPosition) : Chunk

  data class MessageStarted(
    val messageId: String,
    val submissionId: String?,
    val turnId: String?,
    val metadata: JsonObject?,
    override val position: ChunkPosition,
  ) : Chunk

  data class MessageMetadata(val messageId: String, val metadata: JsonObject, override val position: ChunkPosition) :
    Chunk

  data class DataPart(val messageId: String, val name: String, val data: JsonElement?, override val position: ChunkPosition) :
    Chunk

  data class MessageDelta(
    val messageId: String,
    /** `text` or `reasoning`. */
    val kind: String,
    val delta: String,
    override val position: ChunkPosition,
  ) : Chunk

  data class ToolInput(
    val messageId: String,
    val toolCallId: String,
    val toolName: String,
    val input: JsonElement?,
    override val position: ChunkPosition,
  ) : Chunk

  data class ToolOutput(
    val toolCallId: String,
    val output: JsonElement?,
    val durationMs: Long?,
    override val position: ChunkPosition,
  ) : Chunk

  data class ToolOutputError(
    val toolCallId: String,
    val errorText: String,
    val durationMs: Long?,
    override val position: ChunkPosition,
  ) : Chunk

  data class MessageCompleted(val messageId: String, override val position: ChunkPosition) : Chunk

  data class SubmissionSettled(val settlement: FlueSettlement, override val position: ChunkPosition) : Chunk

  /** Continuity marker, not content. No position, exempt from dedup. */
  data class Checkpoint(val incarnation: String) : Chunk {
    override val position: ChunkPosition? = null
  }
}

@Serializable
private data class RawChunk(
  val type: String,
  val conversationId: String? = null,
  val position: ChunkPosition? = null,
  val incarnation: String? = null,
  val snapshot: FlueSnapshot? = null,
  val message: FlueMessage? = null,
  val messageId: String? = null,
  val submissionId: String? = null,
  val turnId: String? = null,
  val metadata: JsonObject? = null,
  val name: String? = null,
  val data: JsonElement? = null,
  val kind: String? = null,
  val delta: String? = null,
  val toolCallId: String? = null,
  val toolName: String? = null,
  val input: JsonElement? = null,
  val output: JsonElement? = null,
  val errorText: String? = null,
  val durationMs: LenientLong? = null,
  val outcome: String? = null,
  val error: JsonElement? = null,
  val answeredBySubmissionId: String? = null,
)

/**
 * Validates and types one chunk read from the `updates` view. Unknown shapes
 * throw so a protocol mismatch fails loudly instead of producing silent
 * partial state; the observer recovers by re-hydrating.
 */
fun parseChunk(element: JsonElement): Chunk {
  val obj = element as? JsonObject ?: throw ConversationStreamError("Unsupported agent conversation chunk: $element.")
  val type = obj["type"]?.jsonPrimitive?.contentOrNull ?: throw ConversationStreamError("Unsupported agent conversation chunk: $element.")
  if (type == "stream-checkpoint") {
    val incarnation = obj["incarnation"]?.jsonPrimitive?.contentOrNull
      ?: throw ConversationStreamError("Agent conversation stream checkpoint is missing its incarnation: $element.")
    return Chunk.Checkpoint(incarnation)
  }
  val raw = runCatching { FlueJson.decodeFromJsonElement(RawChunk.serializer(), obj) }.getOrElse {
    throw ConversationStreamError("Unsupported agent conversation chunk: ${it.message}")
  }
  if (raw.conversationId == null) throw ConversationStreamError("Unsupported agent conversation chunk: $element.")
  val position = raw.position ?: throw ConversationStreamError("Agent conversation chunk is missing a valid position: $element.")
  fun need(value: String?, field: String) = value ?: throw ConversationStreamError("Chunk $type is missing $field.")
  return when (type) {
    "conversation-reset" -> Chunk.Reset(raw.snapshot ?: throw ConversationStreamError("Chunk reset is missing snapshot."), position)
    "message-appended" -> Chunk.MessageAppended(raw.message ?: throw ConversationStreamError("Chunk message-appended is missing message."), position)
    "message-started" -> Chunk.MessageStarted(need(raw.messageId, "messageId"), raw.submissionId, raw.turnId, raw.metadata, position)
    "message-metadata" -> Chunk.MessageMetadata(need(raw.messageId, "messageId"), raw.metadata ?: JsonObject(emptyMap()), position)
    "data-part" -> Chunk.DataPart(need(raw.messageId, "messageId"), need(raw.name, "name"), raw.data, position)
    "message-delta" -> Chunk.MessageDelta(need(raw.messageId, "messageId"), need(raw.kind, "kind"), raw.delta ?: "", position)
    "tool-input" -> Chunk.ToolInput(need(raw.messageId, "messageId"), need(raw.toolCallId, "toolCallId"), need(raw.toolName, "toolName"), raw.input, position)
    "tool-output" -> Chunk.ToolOutput(need(raw.toolCallId, "toolCallId"), raw.output, raw.durationMs, position)
    "tool-output-error" -> Chunk.ToolOutputError(need(raw.toolCallId, "toolCallId"), raw.errorText ?: "", raw.durationMs, position)
    "message-completed" -> Chunk.MessageCompleted(need(raw.messageId, "messageId"), position)
    "submission-settled" ->
      Chunk.SubmissionSettled(
        FlueSettlement(need(raw.submissionId, "submissionId"), need(raw.outcome, "outcome"), raw.error, raw.answeredBySubmissionId),
        position,
      )
    else -> throw ConversationStreamError("Unsupported agent conversation chunk: $element.")
  }
}

/** Reduces one chunk into the conversation state. Port of `applyConversationChunk`. */
fun FlueConversationState.apply(chunk: Chunk): FlueConversationState =
  when (chunk) {
    is Chunk.Reset -> FlueConversationState.from(chunk.snapshot)
    is Chunk.MessageAppended -> withMessages { upsert(chunk.message) }
    is Chunk.MessageStarted ->
      withMessages {
        if (any { it.id == chunk.messageId }) this
        else
          this +
            FlueMessage(
              id = chunk.messageId,
              role = "assistant",
              purpose = "assistant",
              display = "visible",
              submissionId = chunk.submissionId,
              turnId = chunk.turnId,
              metadata = chunk.metadata,
            )
      }
    is Chunk.MessageMetadata ->
      updateMessage(chunk.messageId) { it.copy(metadata = deepMerge(it.metadata ?: JsonObject(emptyMap()), chunk.metadata)) }
    is Chunk.DataPart ->
      updateMessage(chunk.messageId) { message ->
        val partType = "data-${chunk.name}"
        val part = FluePart.Other(JsonObject(buildMap {
          put("type", kotlinx.serialization.json.JsonPrimitive(partType))
          chunk.data?.let { put("data", it) }
        }))
        val index = message.parts.indexOfFirst { it is FluePart.Other && it.type == partType }
        message.copy(parts = if (index < 0) message.parts + part else message.parts.toMutableList().also { it[index] = part })
      }
    is Chunk.MessageDelta ->
      updateMessage(chunk.messageId) { message ->
        val parts = message.parts.toMutableList()
        val last = parts.lastOrNull()
        val sameKind =
          (chunk.kind == "text" && last is FluePart.Text && last.state == "streaming") ||
            (chunk.kind == "reasoning" && last is FluePart.Reasoning && last.state == "streaming")
        if (sameKind) {
          parts[parts.lastIndex] =
            when (last) {
              is FluePart.Text -> last.copy(text = last.text + chunk.delta)
              is FluePart.Reasoning -> last.copy(text = last.text + chunk.delta)
              else -> last
            }
        } else {
          closeStreamingTail(parts)
          parts += if (chunk.kind == "reasoning") FluePart.Reasoning(chunk.delta, "streaming") else FluePart.Text(chunk.delta, "streaming")
        }
        message.copy(parts = parts)
      }
    is Chunk.ToolInput ->
      updateMessage(chunk.messageId) { message ->
        if (message.parts.any { it is FluePart.Tool && it.toolCallId == chunk.toolCallId }) message
        else {
          val parts = message.parts.toMutableList()
          closeStreamingTail(parts)
          parts += FluePart.Tool(chunk.toolName, chunk.toolCallId, "input-available", input = chunk.input)
          message.copy(parts = parts)
        }
      }
    is Chunk.ToolOutput ->
      updateTool(chunk.toolCallId) {
        it.copy(state = "output-available", output = chunk.output, errorText = null, durationMs = chunk.durationMs ?: it.durationMs)
      }
    is Chunk.ToolOutputError ->
      updateTool(chunk.toolCallId) {
        it.copy(state = "output-error", output = null, errorText = chunk.errorText, durationMs = chunk.durationMs ?: it.durationMs)
      }
    is Chunk.MessageCompleted ->
      updateMessage(chunk.messageId) { message ->
        message.copy(
          parts =
            message.parts.map {
              when (it) {
                is FluePart.Text -> it.copy(state = "done")
                is FluePart.Reasoning -> it.copy(state = "done")
                else -> it
              }
            }
        )
      }
    is Chunk.SubmissionSettled -> {
      val index = settlements.indexOfFirst { it.submissionId == chunk.settlement.submissionId }
      copy(settlements = if (index < 0) settlements + chunk.settlement else settlements.toMutableList().also { it[index] = chunk.settlement })
    }
    is Chunk.Checkpoint -> this
  }

private fun closeStreamingTail(parts: MutableList<FluePart>) {
  when (val last = parts.lastOrNull()) {
    is FluePart.Text -> if (last.state == "streaming") parts[parts.lastIndex] = last.copy(state = "done")
    is FluePart.Reasoning -> if (last.state == "streaming") parts[parts.lastIndex] = last.copy(state = "done")
    else -> Unit
  }
}

private fun List<FlueMessage>.upsert(message: FlueMessage): List<FlueMessage> {
  val index = indexOfFirst { it.id == message.id }
  return if (index < 0) this + message else toMutableList().also { it[index] = message }
}

private inline fun FlueConversationState.withMessages(update: List<FlueMessage>.() -> List<FlueMessage>): FlueConversationState {
  val next = messages.update()
  return if (next === messages) this else copy(messages = next)
}

private inline fun FlueConversationState.updateMessage(id: String, update: (FlueMessage) -> FlueMessage): FlueConversationState =
  withMessages {
    val index = indexOfFirst { it.id == id }
    if (index < 0) this else toMutableList().also { it[index] = update(it[index]) }
  }

private inline fun FlueConversationState.updateTool(toolCallId: String, update: (FluePart.Tool) -> FluePart.Tool): FlueConversationState =
  withMessages {
    val index = indexOfLast { message -> message.parts.any { it is FluePart.Tool && it.toolCallId == toolCallId } }
    if (index < 0) this
    else
      toMutableList().also { list ->
        val message = list[index]
        list[index] = message.copy(parts = message.parts.map { if (it is FluePart.Tool && it.toolCallId == toolCallId) update(it) else it })
      }
  }

/** Later values win, plain objects merge recursively, prototype keys dropped. */
internal fun deepMerge(base: JsonObject, next: JsonObject): JsonObject {
  val merged = base.toMutableMap()
  for ((key, value) in next) {
    if (key == "__proto__" || key == "constructor" || key == "prototype") continue
    val current = merged[key]
    merged[key] = if (current is JsonObject && value is JsonObject) deepMerge(current, value) else value
  }
  return JsonObject(merged)
}
