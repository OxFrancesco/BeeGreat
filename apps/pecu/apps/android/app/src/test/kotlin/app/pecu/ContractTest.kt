package app.pecu

import org.junit.Assert.*
import org.junit.Test
import java.io.StringReader
import kotlinx.serialization.encodeToString

class ContractTest {
  @Test fun `TypeScript generated fixtures decode on Android`() {
    val state = wireJson.decodeFromString<AccountState>(javaClass.getResource("/state.json")!!.readText())
    assertEquals("Which token?", state.messages[0].reply!!.question!!.question)
    assertEquals("transfer", state.messages[1].reply!!.preview!!.plan!!.steps.single().kind)
    assertEquals("flows", state.messages[2].reply!!.analytics.single().snapshot.string("kind"))
    assertEquals(Cursor(100, 1), state.olderCursor)
    val events = wireJson.decodeFromString<List<StreamEvent>>(javaClass.getResource("/events.json")!!.readText())
    assertEquals("Reading balances", events.first().stage!!.label)
    assertTrue(events[1].replace)
  }
  @Test fun `live snapshots replace and legacy paragraphs append`() {
    val reducer = StreamReducer()
    reducer.accept(StreamEvent("paragraph", text = "Hello"))
    reducer.accept(StreamEvent("paragraph", text = "world"))
    assertEquals("Hello\n\nworld", reducer.text)
    reducer.accept(StreamEvent("paragraph", text = "Hello world!", replace = true))
    assertEquals("Hello world!", reducer.text)
    reducer.accept(StreamEvent("complete", status = "complete"))
    assertTrue(reducer.complete)
  }
  @Test fun `heartbeats CRLF multiline and unicode decode without loss`() {
    val frames = ": keep-alive\r\n\r\ndata: {\"type\":\"paragraph\",\r\ndata: \"text\":\"€ café 🐌\",\"replace\":true}\r\n\r\ndata: {\"type\":\"complete\",\"status\":\"complete\"}\r\n\r\n"
    val events = mutableListOf<StreamEvent>()
    readFrames(StringReader(frames).buffered(), events::add)
    assertEquals(2, events.size)
    assertEquals("€ café 🐌", events.first().text)
  }
  @Test fun `busy does not count as completion`() {
    val reducer = StreamReducer()
    assertThrows(PecuException::class.java) { reducer.accept(StreamEvent("complete", status = "busy")) }
    assertFalse(reducer.complete)
  }
  @Test fun `wallet confirmations fail closed for expiry and linked signers`() {
    val preview = Preview("ABC123", text = "Send 1 USDC", state = "pending", expiresAt = 100)
    assertTrue(preview.canConfirm(99))
    assertFalse(preview.canConfirm(100))
    assertFalse(preview.copy(signer = "0x123").canConfirm(99))
    for (state in listOf("succeeded", "cancelled", "failed", "expired", "unknown")) assertFalse(preview.copy(state = state).canConfirm(99))
    assertTrue(preview.copy(state = "executing").canConfirm(101))
  }
  @Test fun `wire ignores additions and old replies retain defaults`() {
    val state = wireJson.decodeFromString<AccountState>("""{"wallet":null,"yolo":false,"future":true,"messages":[{"id":"m","text":"Hello","createdAt":1,"reply":{"text":"Hi","preview":null}}]}""")
    assertEquals("Hi", state.messages.single().reply?.text)
    assertFalse(state.messages.single().reply!!.holdingsOnly)
  }
  @Test fun `request retains deduplication and thread scope without client identity`() {
    val request = TurnRequest("123", "Read balances", threadId = "test", answerTo = "question")
    val encoded = wireJson.encodeToString(request)
    assertFalse(encoded.contains("senderId"))
    assertFalse(encoded.contains("userId"))
    assertFalse(encoded.contains("retryOf"))
    assertEquals(request, wireJson.decodeFromString<TurnRequest>(encoded))
  }
  @Test fun `history reconciliation replaces a pending reply without duplicates`() {
    val pending = Message("m", "Hello", 100)
    val complete = pending.copy(reply = Reply("Hi"))
    assertEquals(listOf(complete), mergeMessages(listOf(pending), listOf(complete)))
  }
}
