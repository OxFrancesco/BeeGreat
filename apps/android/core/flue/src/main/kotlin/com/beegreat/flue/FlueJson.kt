package com.beegreat.flue

import kotlinx.serialization.KSerializer
import kotlinx.serialization.descriptors.PrimitiveKind
import kotlinx.serialization.descriptors.PrimitiveSerialDescriptor
import kotlinx.serialization.descriptors.SerialDescriptor
import kotlinx.serialization.encoding.Decoder
import kotlinx.serialization.encoding.Encoder
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonDecoder
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.doubleOrNull

/**
 * The one JSON configuration for Flue wire types. Absent optional fields stay
 * absent (never `null`), so a re-serialized message stays a valid
 * `FlueConversationMessage` for the web and Expo clients that read the same
 * Convex rows.
 */
val FlueJson: Json = Json {
  ignoreUnknownKeys = true
  explicitNulls = false
  encodeDefaults = true
  isLenient = true
}

/** JavaScript numbers arrive as `3` or `3.0`; either must decode as a whole number. */
object LenientLongSerializer : KSerializer<Long> {
  override val descriptor: SerialDescriptor = PrimitiveSerialDescriptor("LenientLong", PrimitiveKind.LONG)

  override fun deserialize(decoder: Decoder): Long {
    val json = decoder as? JsonDecoder ?: return decoder.decodeLong()
    val primitive = json.decodeJsonElement() as? JsonPrimitive ?: error("Expected a number")
    return primitive.doubleOrNull?.toLong() ?: error("Expected a number, got ${primitive.content}")
  }

  override fun serialize(encoder: Encoder, value: Long) = encoder.encodeLong(value)
}

typealias LenientLong = @kotlinx.serialization.Serializable(LenientLongSerializer::class) Long
