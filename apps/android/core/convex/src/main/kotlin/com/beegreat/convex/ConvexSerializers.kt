package com.beegreat.convex

import kotlinx.serialization.KSerializer
import kotlinx.serialization.descriptors.PrimitiveKind
import kotlinx.serialization.descriptors.PrimitiveSerialDescriptor
import kotlinx.serialization.descriptors.SerialDescriptor
import kotlinx.serialization.encoding.Decoder
import kotlinx.serialization.encoding.Encoder
import kotlinx.serialization.json.JsonDecoder
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.doubleOrNull
import kotlinx.serialization.json.jsonPrimitive
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.util.Base64

/**
 * Convex sends JavaScript numbers as float64. A count like `3` arrives as
 * `3`, `3.0`, or, for `BigInt` columns, `{"$integer": "<base64 little-endian>"}`.
 * The stock `Int` serializer rejects two of those, so models use this one.
 */
object ConvexIntSerializer : KSerializer<Int> {
  override val descriptor: SerialDescriptor = PrimitiveSerialDescriptor("ConvexInt", PrimitiveKind.INT)

  override fun deserialize(decoder: Decoder): Int = decodeConvexNumber(decoder).toInt()

  override fun serialize(encoder: Encoder, value: Int) = encoder.encodeInt(value)
}

object ConvexLongSerializer : KSerializer<Long> {
  override val descriptor: SerialDescriptor = PrimitiveSerialDescriptor("ConvexLong", PrimitiveKind.LONG)

  override fun deserialize(decoder: Decoder): Long = decodeConvexNumber(decoder).toLong()

  override fun serialize(encoder: Encoder, value: Long) = encoder.encodeLong(value)
}

object ConvexDoubleSerializer : KSerializer<Double> {
  override val descriptor: SerialDescriptor = PrimitiveSerialDescriptor("ConvexDouble", PrimitiveKind.DOUBLE)

  override fun deserialize(decoder: Decoder): Double = decodeConvexNumber(decoder)

  override fun serialize(encoder: Encoder, value: Double) = encoder.encodeDouble(value)
}

/**
 * Argument numbers must be sent as float64. The Android client encodes Kotlin
 * `Int`/`Long` as Convex `$integer` (int64), which every `v.number()` validator
 * in the backend rejects. Always pass `value.n`, never a bare `Int`.
 */
val Number.n: Double
  get() = toDouble()

typealias ConvexInt = @kotlinx.serialization.Serializable(ConvexIntSerializer::class) Int

typealias ConvexLong = @kotlinx.serialization.Serializable(ConvexLongSerializer::class) Long

typealias ConvexDouble = @kotlinx.serialization.Serializable(ConvexDoubleSerializer::class) Double

private fun decodeConvexNumber(decoder: Decoder): Double {
  val json = decoder as? JsonDecoder ?: return decoder.decodeDouble()
  return when (val element = json.decodeJsonElement()) {
    is JsonPrimitive -> element.doubleOrNull ?: error("Expected a number, got ${element.content}")
    is JsonObject -> {
      element["\$integer"]?.let { return littleEndianLong(it.jsonPrimitive.content).toDouble() }
      element["\$float"]?.let { return littleEndianDouble(it.jsonPrimitive.content) }
      error("Expected a Convex number, got $element")
    }
    else -> error("Expected a number, got $element")
  }
}

private fun littleEndianLong(base64: String): Long =
  ByteBuffer.wrap(Base64.getDecoder().decode(base64)).order(ByteOrder.LITTLE_ENDIAN).long

private fun littleEndianDouble(base64: String): Double =
  ByteBuffer.wrap(Base64.getDecoder().decode(base64)).order(ByteOrder.LITTLE_ENDIAN).double
