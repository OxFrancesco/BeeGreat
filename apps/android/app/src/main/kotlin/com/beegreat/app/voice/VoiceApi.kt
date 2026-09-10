package com.beegreat.app.voice

import com.beegreat.app.BuildConfig
import com.beegreat.flue.FlueJson
import com.beegreat.flue.HeaderProvider
import com.beegreat.flue.await
import java.io.File
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response

@Serializable private data class TranscriptionResponse(val text: String)

@Serializable private data class SpeechResponse(val audio: String)

@Serializable data class RealtimeToken(val token: String, val expiresAt: Double, val websocketUrl: String)

/** The worker voice routes (transcribe, speak, realtime token). Port of `apps/mobile/src/lib/voice-api.ts`. */
class VoiceApi(private val http: OkHttpClient, private val headers: HeaderProvider, private val agentUrl: String = BuildConfig.AGENT_URL) {
  /** Raw bytes with the audio content type; the worker builds the multipart request itself. */
  suspend fun transcribe(file: File, mimeType: String = "audio/m4a"): String {
    val response = send(Request.Builder().url("$agentUrl/voice/transcribe").post(file.readBytes().toRequestBody(mimeType.toMediaType())))
    return response.use {
      if (!it.isSuccessful) throw VoiceApiException(readError(it, "Transcription failed."))
      FlueJson.decodeFromString(TranscriptionResponse.serializer(), it.body.string()).text.trim()
    }
  }

  /** MP3 bytes for [text]; the caller owns the cache file. */
  suspend fun speak(text: String): ByteArray {
    val body = FlueJson.encodeToString(kotlinx.serialization.json.JsonObject.serializer(), kotlinx.serialization.json.buildJsonObject { put("text", kotlinx.serialization.json.JsonPrimitive(text)) })
    val response = send(Request.Builder().url("$agentUrl/voice/speak").post(body.toRequestBody("application/json".toMediaType())))
    return response.use {
      if (!it.isSuccessful) throw VoiceApiException(readError(it, "Speech synthesis failed."))
      android.util.Base64.decode(FlueJson.decodeFromString(SpeechResponse.serializer(), it.body.string()).audio, android.util.Base64.DEFAULT)
    }
  }

  suspend fun realtimeToken(): RealtimeToken {
    val response = send(Request.Builder().url("$agentUrl/voice/realtime-token").post(ByteArray(0).toRequestBody(null)))
    return response.use {
      if (!it.isSuccessful) throw VoiceApiException(readError(it, "Conversational voice could not start."))
      FlueJson.decodeFromString(RealtimeToken.serializer(), it.body.string())
    }
  }

  private suspend fun send(builder: Request.Builder): Response {
    for ((key, value) in headers()) builder.header(key, value)
    return http.newCall(builder.build()).await()
  }

  /** Prefers the worker's `{ error }` message so the UI shows the real cause. */
  private fun readError(response: Response, fallback: String): String {
    val message = runCatching { FlueJson.parseToJsonElement(response.body.string()).jsonObject["error"]?.jsonPrimitive?.content }.getOrNull()
    return message ?: "$fallback (HTTP ${response.code})"
  }
}

class VoiceApiException(message: String) : RuntimeException(message)
