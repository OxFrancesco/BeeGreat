package com.beegreat.flue

import kotlinx.coroutines.flow.take
import kotlinx.coroutines.flow.toList
import kotlinx.coroutines.test.runTest
import mockwebserver3.MockResponse
import mockwebserver3.MockWebServer
import okhttp3.OkHttpClient
import org.junit.Assert.assertEquals
import org.junit.Test

class DurableStreamTest {
  private fun http(server: MockWebServer) =
    FlueHttp(server.url("/agents/bee/user1").toString(), { mapOf("authorization" to "Bearer t") }, OkHttpClient())

  @Test
  fun `catches up with JSON batches then tails SSE and dedups nothing itself`() = runTest {
    val server = MockWebServer()
    server.start()
    server.enqueue(
      MockResponse.Builder()
        .addHeader("content-type", "application/json")
        .addHeader("Stream-Next-Offset", "10")
        .body("""[{"type":"message-started","conversationId":"c","messageId":"m1","position":{"batch":1,"index":0}}]""")
        .build()
    )
    server.enqueue(
      MockResponse.Builder()
        .addHeader("content-type", "application/json")
        .addHeader("Stream-Next-Offset", "10")
        .addHeader("Stream-Up-To-Date", "true")
        .body("[]")
        .build()
    )
    val sse =
      listOf(
        "event: data",
        "data: {\"type\":\"message-delta\",\"conversationId\":\"c\",\"messageId\":\"m1\",\"kind\":\"text\",\"delta\":\"hi\",\"position\":{\"batch\":2,\"index\":0}}",
        "",
        "event: control",
        "data: {\"streamNextOffset\":\"11\",\"upToDate\":true}",
        "",
        "event: control",
        "data: {\"streamNextOffset\":\"11\",\"upToDate\":true,\"streamClosed\":true}",
        "",
      ).joinToString("\n")
    server.enqueue(MockResponse.Builder().addHeader("content-type", "text/event-stream").body(sse).build())

    val batches = http(server).updates("-1", LiveMode.Sse).toList()
    assertEquals(listOf(1, 0, 1, 0), batches.map { it.items.size })
    assertEquals(listOf("10", "10", "11", "11"), batches.map { it.nextOffset })
    assertEquals(true, batches.last().streamClosed)

    val first = server.takeRequest()
    assertEquals("-1", first.url.queryParameter("offset"))
    assertEquals(null, first.url.queryParameter("live"))
    assertEquals("Bearer t", first.headers["authorization"])
    server.takeRequest()
    val live = server.takeRequest()
    assertEquals("sse", live.url.queryParameter("live"))
    assertEquals("10", live.url.queryParameter("offset"))
    server.close()
  }

  @Test
  fun `a 401 on the stream surfaces as FlueApiError with status`() = runTest {
    val server = MockWebServer()
    server.start()
    server.enqueue(MockResponse.Builder().code(401).body("""{"error":{"message":"sign in"}}""").build())
    val error = runCatching { http(server).updates("-1", LiveMode.Sse).take(1).toList() }.exceptionOrNull()
    assertEquals(401, (error as FlueApiError).status)
    server.close()
  }

  @Test
  fun `send posts a user message and parses the receipt`() = runTest {
    val server = MockWebServer()
    server.start()
    server.enqueue(
      MockResponse.Builder()
        .code(202)
        .body("""{"streamUrl":"u","offset":"3","submissionId":"sub1","uid":"uid1"}""")
        .build()
    )
    val result = http(server).send("hello")
    assertEquals("sub1", result.submissionId)
    val request = server.takeRequest()
    assertEquals("POST", request.method)
    assertEquals("""{"kind":"user","body":"hello"}""", request.body?.utf8())
    server.close()
  }
}
