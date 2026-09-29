package app.pecu

import java.io.BufferedReader
import java.io.IOException
import java.util.concurrent.TimeUnit
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.*
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.HttpUrl.Companion.toHttpUrl

interface HistoryReader {
  suspend fun state(thread: String?): AccountState
  suspend fun threads(before: ThreadCursor? = null): ThreadPage
}

class PecuApi(
  private val token: suspend () -> String,
  private val origin: String = BuildConfig.API_ORIGIN,
  private val client: OkHttpClient = OkHttpClient.Builder()
    .connectTimeout(20, TimeUnit.SECONDS).readTimeout(90, TimeUnit.SECONDS)
    .callTimeout(8, TimeUnit.MINUTES).retryOnConnectionFailure(false)
    .followRedirects(false).build(),
) : HistoryReader {
  suspend fun get(path: String, query: List<Pair<String, String>> = emptyList()): String =
    withContext(Dispatchers.IO) { execute(request(path, query = query)).use { response -> checked(response).body.string() } }

  suspend fun post(path: String, body: JsonObject): String =
    withContext(Dispatchers.IO) { execute(request(path, body = body.toString())).use { response -> checked(response).body.string() } }

  override suspend fun state(thread: String?): AccountState = withContext(Dispatchers.Default) { wireJson.decodeFromString(get("state", scope(thread) + ("paged" to "1"))) }
  override suspend fun threads(before: ThreadCursor?): ThreadPage = withContext(Dispatchers.Default) { wireJson.decodeFromString(get("threads", before?.let { listOf("before" to wireJson.encodeToString(it)) }.orEmpty())) }
  suspend fun messages(thread: String?, before: Cursor): MessagePage = withContext(Dispatchers.Default) { wireJson.decodeFromString(get("messages", scope(thread) + ("before" to wireJson.encodeToString(before)))) }
  suspend fun deleteThread(thread: String?) { post("thread-delete", buildJsonObject { put("threadId", thread?.let(::JsonPrimitive) ?: JsonNull) }) }
  suspend fun portfolio(tokens: List<String>): Portfolio = wireJson.decodeFromString(get("portfolio", tokens.map { "token" to it } + ("stocks" to "1")))
  suspend fun inference(): Inference = wireJson.decodeFromString(get("inference"))
  suspend fun connect(connect: Boolean): Inference = wireJson.decodeFromString(post(if (connect) "inference-connect" else "inference-disconnect", buildJsonObject {}))
  suspend fun automations(): AutomationList = wireJson.decodeFromString(get("tasks"))
  suspend fun automationAction(code: String, kind: String, maxUsd: Double? = null): AutomationActionResult =
    wireJson.decodeFromString(post("task-action", buildJsonObject { put("code", code); put("kind", kind); maxUsd?.let { put("maxUsd", it) } }))
  suspend fun notifications(): NotificationList = wireJson.decodeFromString(get("notifications"))
  suspend fun readNotifications() { post("notification-read", buildJsonObject {}) }
  suspend fun registerPush(token: String) { post("push-register", buildJsonObject { put("token", token); put("platform", "android") }) }
  suspend fun unregisterPush(token: String) { post("push-unregister", buildJsonObject { put("token", token) }) }

  suspend fun turn(turn: TurnRequest, onEvent: (StreamEvent) -> Unit) {
    val call = client.newCall(request("turn", body = wireJson.encodeToString(turn))
      .newBuilder().header("Accept", "text/event-stream; mode=live; stages=1, application/json").build())
    suspendCancellableCoroutine<Unit> { continuation ->
      continuation.invokeOnCancellation { call.cancel() }
      call.enqueue(object : Callback {
        override fun onFailure(call: Call, e: IOException) { if (continuation.isActive) continuation.resumeWithException(e) }
        override fun onResponse(call: Call, response: Response) {
          try {
            response.use {
              checked(it)
              if (it.header("Content-Type")?.contains("text/event-stream") != true) {
                val result = wireJson.parseToJsonElement(it.body.string()).jsonObject
                if (result["status"]?.jsonPrimitive?.content == "busy") throw PecuException("Pecu is still working. Check for its reply before retrying.")
              } else {
                val reducer = StreamReducer()
                readFrames(it.body.charStream().buffered()) { event ->
                  if (!continuation.isActive) throw IOException("Stream closed")
                  reducer.accept(event)
                  onEvent(event)
                }
                if (!reducer.complete) throw PecuException("The connection dropped. Check for a reply, or retry this same request.")
              }
            }
            if (continuation.isActive) continuation.resume(Unit)
          } catch (error: Exception) { if (continuation.isActive) continuation.resumeWithException(error) }
        }
      })
    }
  }

  private suspend fun request(path: String, body: String? = null, query: List<Pair<String, String>> = emptyList()): Request {
    require(path.matches(Regex("[a-z-]+")))
    val url = "$origin/stocks/api/$path".toHttpUrl().newBuilder()
    query.forEach { (key, value) -> url.addQueryParameter(key, value) }
    return Request.Builder().url(url.build()).header("Authorization", "Bearer ${token()}")
      .header("Origin", origin).header("Accept", "application/json")
      .apply { body?.let { post(it.toRequestBody("application/json".toMediaType())) } }.build()
  }

  private suspend fun execute(request: Request): Response = withContext(Dispatchers.IO) { client.newCall(request).await() }
  private fun checked(response: Response): Response {
    if (response.isSuccessful) return response
    val text = response.body.string()
    val message = runCatching { wireJson.parseToJsonElement(text).jsonObject["error"]?.jsonPrimitive?.content }.getOrNull()
    throw PecuException(if (response.code == 401) "Sign in again to reconnect to Pecu." else message ?: "Pecu is unavailable. Try again.")
  }
  private fun scope(thread: String?) = thread?.let { listOf("t" to it) }.orEmpty()
}

private suspend fun Call.await(): Response = suspendCancellableCoroutine { continuation ->
  continuation.invokeOnCancellation { cancel() }
  enqueue(object : Callback {
    override fun onFailure(call: Call, e: IOException) { if (continuation.isActive) continuation.resumeWithException(e) }
    override fun onResponse(call: Call, response: Response) {
      continuation.resume(response) { _, value, _ -> value.close() }
    }
  })
}

fun readFrames(reader: BufferedReader, accept: (StreamEvent) -> Unit) {
  val data = StringBuilder()
  fun emit() {
    if (data.isNotEmpty()) { accept(wireJson.decodeFromString(data.toString())); data.clear() }
  }
  while (true) {
    val line = reader.readLine() ?: break
    if (line.isEmpty()) emit()
    else if (line.startsWith("data:")) {
      if (data.isNotEmpty()) data.append('\n')
      data.append(line.substring(5).trimStart())
      require(data.length <= 1_000_000) { "Pecu returned an oversized stream event." }
    }
  }
  emit()
}
