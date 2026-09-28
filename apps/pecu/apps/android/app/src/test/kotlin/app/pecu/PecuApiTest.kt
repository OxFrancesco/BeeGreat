package app.pecu

import java.util.concurrent.TimeUnit
import kotlinx.coroutines.*
import kotlinx.serialization.json.*
import mockwebserver3.MockResponse
import mockwebserver3.MockWebServer
import org.junit.Assert.*
import org.junit.Test

class PecuApiTest {
  @Test fun `wallet review sends the source wallet guard and exact amount`() = runBlocking {
    MockWebServer().use { server ->
      server.start()
      server.enqueue(MockResponse.Builder().addHeader("Content-Type", "text/event-stream").body("data: {\"type\":\"complete\",\"status\":\"complete\"}\n\n").build())
      val wallet = "0x" + "1".repeat(40)
      val command = "/send 0.000000000000000001 USDC to 0x" + "2".repeat(40)
      val api = PecuApi({ "token" }, server.url("/").toString().trimEnd('/'))
      api.turn(TurnRequest("review-id", command, reviewWallet = wallet)) {}
      val body = wireJson.parseToJsonElement(server.takeRequest(2, TimeUnit.SECONDS)!!.body!!.utf8()).jsonObject
      assertEquals(wallet, body.string("reviewWallet"))
      assertEquals(command, body.string("text"))
      assertEquals(1, server.requestCount)
    }
  }
  @Test fun `same backend bearer origin and request id reach the wire`() = runBlocking {
    MockWebServer().use { server ->
      server.start()
      server.enqueue(MockResponse.Builder().addHeader("Content-Type", "text/event-stream").body("data: {\"type\":\"paragraph\",\"text\":\"Hello\",\"replace\":true}\n\ndata: {\"type\":\"complete\",\"status\":\"complete\"}\n\n").build())
      val origin = server.url("/").toString().trimEnd('/')
      val api = PecuApi({ "session-token" }, origin)
      val events = mutableListOf<StreamEvent>()
      api.turn(TurnRequest("fixed-id", "Hello", "thread-a"), events::add)
      val request = server.takeRequest(2, TimeUnit.SECONDS)!!
      assertEquals("/stocks/api/turn", request.url.encodedPath)
      assertEquals("Bearer session-token", request.headers["Authorization"])
      assertEquals(origin, request.headers["Origin"])
      assertTrue(request.headers["Accept"]!!.contains("mode=live"))
      val body = wireJson.parseToJsonElement(request.body!!.utf8()).jsonObject
      assertEquals("fixed-id", body.string("requestId"))
      assertEquals("thread-a", body.string("threadId"))
      assertEquals(2, events.size)
    }
  }
  @Test fun `truncated stream is recoverable and is not success`() = runBlocking {
    MockWebServer().use { server ->
      server.start()
      server.enqueue(MockResponse.Builder().addHeader("Content-Type", "text/event-stream").body("data: {\"type\":\"paragraph\",\"text\":\"Partial\"}\n\n").build())
      val api = PecuApi({ "token" }, server.url("/").toString().trimEnd('/'))
      try { api.turn(TurnRequest("same-id", "Hello")) {}; fail("Expected interruption") }
      catch (error: PecuException) { assertTrue(error.message!!.contains("same request")) }
      assertEquals(1, server.requestCount)
    }
  }
  @Test fun `authentication failure does not retry a write`() = runBlocking {
    MockWebServer().use { server ->
      server.start()
      server.enqueue(MockResponse.Builder().code(401).body("{}").build())
      val api = PecuApi({ "expired" }, server.url("/").toString().trimEnd('/'))
      try { api.turn(TurnRequest("same-id", "Hello")) {}; fail("Expected auth error") }
      catch (error: PecuException) { assertTrue(error.message!!.contains("Sign in again")) }
      assertEquals(1, server.requestCount)
    }
  }
  @Test fun `cancelling a stalled turn releases its network call`() = runBlocking {
    MockWebServer().use { server ->
      server.start()
      server.enqueue(MockResponse.Builder().headersDelay(10, TimeUnit.SECONDS).body("{}").build())
      val api = PecuApi({ "token" }, server.url("/").toString().trimEnd('/'))
      val job = launch { api.turn(TurnRequest("same-id", "Hello")) {} }
      withContext(Dispatchers.IO) { assertNotNull(server.takeRequest(2, TimeUnit.SECONDS)) }
      withTimeout(1000) { job.cancelAndJoin() }
    }
  }
}
