package com.beegreat.flue

import java.io.IOException
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import okhttp3.Call
import okhttp3.Callback
import okhttp3.HttpUrl
import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response

/** Headers resolved per request, so a refreshed auth token is picked up on reconnect. */
typealias HeaderProvider = suspend () -> Map<String, String>

/** Failed Flue HTTP request. `status` drives retry policy in the observer. */
class FlueApiError(val status: Int, val body: String?, val ref: String?) :
  IOException(compose(status, body, ref)) {
  companion object {
    private fun compose(status: Int, body: String?, ref: String?): String {
      val message =
        runCatching { FlueJson.parseToJsonElement(body ?: "").jsonObject["error"]?.jsonObject?.get("message")?.jsonPrimitive?.contentOrNull }
          .getOrNull()
      val refSuffix = ref?.let { " [$it]" } ?: ""
      return "Flue API error $status$refSuffix: ${message ?: "request failed"}"
    }
  }
}

/** One image attachment on a user message. */
@Serializable data class DeliveredAttachment(val data: String, val mimeType: String, val filename: String? = null, val type: String = "image")

/** Receipt for one admitted message. */
@Serializable
data class SendResult(
  val streamUrl: String,
  val offset: String,
  val submissionId: String,
  val uid: String,
  val deduplicated: Boolean? = null,
)

@Serializable data class AbortResult(val aborted: Boolean)

/**
 * HTTP client for one agent conversation. Port of `@flue/sdk`'s `HttpClient`
 * plus the request helpers in `client.ts`: the URL is the agent's mount path
 * plus the conversation id, and every path suffix hangs off it.
 */
class FlueHttp(
  url: String,
  private val headers: HeaderProvider,
  val client: OkHttpClient = OkHttpClient(),
) {
  val conversationUrl: HttpUrl = url.trimEnd('/').toHttpUrl()

  /** Live tails idle for minutes between frames; no read timeout on that client. */
  private val streamClient: OkHttpClient = client.newBuilder().readTimeout(java.time.Duration.ZERO).build()

  fun url(path: String = "", query: Map<String, String?> = emptyMap()): HttpUrl {
    val builder = (conversationUrl.toString() + path).toHttpUrl().newBuilder()
    for ((key, value) in query) if (value != null) builder.setQueryParameter(key, value)
    return builder.build()
  }

  fun attachmentUrl(attachmentId: String): String =
    url("/attachments/${java.net.URLEncoder.encode(attachmentId, "UTF-8")}").toString()

  suspend fun send(
    body: String,
    attachments: List<DeliveredAttachment> = emptyList(),
    idempotencyKey: String? = null,
  ): SendResult {
    val payload = buildJsonObject {
      put("kind", "user")
      put("body", body)
      if (attachments.isNotEmpty()) put("attachments", FlueJson.encodeToJsonElement(kotlinx.serialization.builtins.ListSerializer(DeliveredAttachment.serializer()), attachments))
      if (idempotencyKey != null) put("idempotencyKey", idempotencyKey)
    }
    return json(SendResult.serializer(), method = "POST", body = payload)
  }

  suspend fun abort(): AbortResult = json(AbortResult.serializer(), method = "POST", path = "/abort", body = JsonObject(emptyMap()))

  suspend fun history(): FlueSnapshot = withAttachmentUrls(json(FlueSnapshot.serializer(), query = mapOf("view" to "history")))

  /** Fills `url` on durably recorded `file` parts, like the SDK does. */
  fun withAttachmentUrls(snapshot: FlueSnapshot) = snapshot.copy(messages = snapshot.messages.map(::withAttachmentUrls))

  fun withAttachmentUrls(message: FlueMessage): FlueMessage {
    var changed = false
    val parts =
      message.parts.map { part ->
        if (part is FluePart.File && part.id != null && part.url == null) {
          changed = true
          part.copy(url = attachmentUrl(part.id))
        } else part
      }
    return if (changed) message.copy(parts = parts) else message
  }

  fun withAttachmentUrls(chunk: Chunk): Chunk =
    when (chunk) {
      is Chunk.Reset -> chunk.copy(snapshot = withAttachmentUrls(chunk.snapshot))
      is Chunk.MessageAppended -> chunk.copy(message = withAttachmentUrls(chunk.message))
      else -> chunk
    }

  suspend fun request(
    url: HttpUrl,
    method: String = "GET",
    body: JsonElement? = null,
    extraHeaders: Map<String, String> = emptyMap(),
    stream: Boolean = false,
  ): Response {
    val builder = Request.Builder().url(url)
    for ((key, value) in headers()) builder.header(key, value)
    for ((key, value) in extraHeaders) builder.header(key, value)
    if (body != null) builder.method(method, body.toString().toRequestBody(JSON_MEDIA_TYPE)) else builder.method(method, null)
    return (if (stream) streamClient else client).newCall(builder.build()).await()
  }

  private suspend fun <T> json(
    serializer: kotlinx.serialization.KSerializer<T>,
    method: String = "GET",
    path: String = "",
    query: Map<String, String?> = emptyMap(),
    body: JsonElement? = null,
  ): T {
    val response = request(url(path, query), method, body)
    response.use {
      val text = it.body.string()
      if (!it.isSuccessful) throw FlueApiError(it.code, text.ifEmpty { null }, it.header("flue-error-ref"))
      return FlueJson.decodeFromString(serializer, text)
    }
  }

  private companion object {
    val JSON_MEDIA_TYPE = "application/json".toMediaType()
  }
}

suspend fun Call.await(): Response = suspendCancellableCoroutine { continuation ->
  enqueue(
    object : Callback {
      override fun onResponse(call: Call, response: Response) {
        continuation.resume(response)
      }

      override fun onFailure(call: Call, e: IOException) {
        if (!continuation.isCancelled) continuation.resumeWithException(e)
      }
    }
  )
  continuation.invokeOnCancellation { cancel() }
}

internal fun JsonElement.stringOrNull(): String? = (this as? JsonPrimitive)?.contentOrNull
