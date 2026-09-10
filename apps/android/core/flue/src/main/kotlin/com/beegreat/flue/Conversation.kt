package com.beegreat.flue

import kotlinx.serialization.KSerializer
import kotlinx.serialization.Serializable
import kotlinx.serialization.descriptors.SerialDescriptor
import kotlinx.serialization.descriptors.buildClassSerialDescriptor
import kotlinx.serialization.encoding.Decoder
import kotlinx.serialization.encoding.Encoder
import kotlinx.serialization.json.JsonDecoder
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonEncoder
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive

/**
 * One renderable part of a conversation message. Mirrors `FlueConversationPart`
 * in `@flue/sdk`. Unknown part types are kept verbatim so a message survives a
 * round trip through Convex unchanged.
 */
@Serializable(with = FluePartSerializer::class)
sealed interface FluePart {
  @Serializable
  data class Text(val text: String, val state: String, val type: String = "text") : FluePart

  @Serializable
  data class Reasoning(val text: String, val state: String, val type: String = "reasoning") : FluePart

  @Serializable
  data class File(
    val mediaType: String,
    val id: String? = null,
    val size: LenientLong? = null,
    val url: String? = null,
    val filename: String? = null,
    val type: String = "file",
  ) : FluePart

  @Serializable
  data class Tool(
    val toolName: String,
    val toolCallId: String,
    /** `input-available`, `output-available`, or `output-error`. */
    val state: String,
    val input: JsonElement? = null,
    val output: JsonElement? = null,
    val errorText: String? = null,
    val durationMs: LenientLong? = null,
    val type: String = "dynamic-tool",
  ) : FluePart

  /** A `data-<name>` part, or any part type this build does not know. */
  data class Other(val raw: JsonObject) : FluePart {
    val type: String
      get() = raw["type"]?.jsonPrimitive?.contentOrNull ?: ""
  }
}

val FluePart.isStreaming: Boolean
  get() =
    when (this) {
      is FluePart.Text -> state == "streaming"
      is FluePart.Reasoning -> state == "streaming"
      else -> false
    }

object FluePartSerializer : KSerializer<FluePart> {
  override val descriptor: SerialDescriptor = buildClassSerialDescriptor("FluePart")

  override fun deserialize(decoder: Decoder): FluePart {
    val json = decoder as JsonDecoder
    val element = json.decodeJsonElement().jsonObject
    return when (element["type"]?.jsonPrimitive?.contentOrNull) {
      "text" -> json.json.decodeFromJsonElement(FluePart.Text.serializer(), element)
      "reasoning" -> json.json.decodeFromJsonElement(FluePart.Reasoning.serializer(), element)
      "file" -> json.json.decodeFromJsonElement(FluePart.File.serializer(), element)
      "dynamic-tool" -> json.json.decodeFromJsonElement(FluePart.Tool.serializer(), element)
      else -> FluePart.Other(element)
    }
  }

  override fun serialize(encoder: Encoder, value: FluePart) {
    val json = encoder as JsonEncoder
    val element: JsonElement =
      when (value) {
        is FluePart.Text -> json.json.encodeToJsonElement(FluePart.Text.serializer(), value)
        is FluePart.Reasoning -> json.json.encodeToJsonElement(FluePart.Reasoning.serializer(), value)
        is FluePart.File -> json.json.encodeToJsonElement(FluePart.File.serializer(), value)
        is FluePart.Tool -> json.json.encodeToJsonElement(FluePart.Tool.serializer(), value)
        is FluePart.Other -> value.raw
      }
    json.encodeJsonElement(element)
  }
}

@Serializable data class FlueSignal(val tagName: String? = null, val attributes: Map<String, String>? = null)

@Serializable data class FlueSettlementMarker(val outcome: String)

/** One message in a materialized conversation. Mirrors `FlueConversationMessage`. */
@Serializable
data class FlueMessage(
  val id: String,
  /** `user`, `assistant`, or `system`. */
  val role: String,
  /** `user`, `assistant`, `dispatch`, or `advisory`. */
  val purpose: String = role,
  /** `visible`, `hidden`, or `diagnostic`. */
  val display: String = "visible",
  val submissionId: String? = null,
  val turnId: String? = null,
  val signal: FlueSignal? = null,
  val settlement: FlueSettlementMarker? = null,
  val parts: List<FluePart> = emptyList(),
  val metadata: JsonObject? = null,
) {
  val text: String
    get() = parts.filterIsInstance<FluePart.Text>().joinToString("\n") { it.text }

  val reasoningText: String
    get() = parts.filterIsInstance<FluePart.Reasoning>().joinToString("\n\n") { it.text }

  val toolParts: List<FluePart.Tool>
    get() = parts.filterIsInstance<FluePart.Tool>()

  val isUser: Boolean
    get() = role == "user"

  val isAssistant: Boolean
    get() = role == "assistant"

  /** ISO-8601 `metadata.timestamp` as epoch millis, when the agent attached one. */
  val timestampMillis: Long?
    get() =
      (metadata?.get("timestamp") as? JsonPrimitive)?.contentOrNull?.let { value ->
        runCatching { java.time.Instant.parse(value).toEpochMilli() }.getOrNull()
      }
}

@Serializable
data class FlueSettlement(
  val submissionId: String,
  /** `completed`, `failed`, or `aborted`. */
  val outcome: String,
  val error: JsonElement? = null,
  val answeredBySubmissionId: String? = null,
)

/** A complete materialized conversation read at a durable-stream offset. */
@Serializable
data class FlueSnapshot(
  val conversationId: String,
  val offset: String,
  val incarnation: String? = null,
  val messages: List<FlueMessage> = emptyList(),
  val settlements: List<FlueSettlement> = emptyList(),
)

data class FlueConversationState(
  val conversationId: String,
  val messages: List<FlueMessage>,
  val settlements: List<FlueSettlement>,
) {
  companion object {
    fun from(snapshot: FlueSnapshot) =
      FlueConversationState(snapshot.conversationId, snapshot.messages, snapshot.settlements)
  }
}
