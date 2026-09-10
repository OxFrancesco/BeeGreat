package com.beegreat.contract

import com.beegreat.flue.FlueMessage
import com.beegreat.flue.FluePart
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import org.junit.Assert.assertEquals
import org.junit.Test

class ChatHistoryTest {
  private fun user(id: String, text: String, submissionId: String? = null, timestamp: String? = null) =
    FlueMessage(
      id = id,
      role = "user",
      purpose = "user",
      submissionId = submissionId,
      parts = listOf(FluePart.Text(text, "done")),
      metadata = timestamp?.let { JsonObject(mapOf("timestamp" to JsonPrimitive(it))) },
    )

  private fun assistant(id: String, text: String, state: String = "done") =
    FlueMessage(id = id, role = "assistant", purpose = "assistant", parts = listOf(FluePart.Text(text, state)))

  private fun row(message: FlueMessage, createdAt: Long, hidden: Boolean = false) =
    StoredChatMessage(message.id, encodeMessage(message), createdAt, hidden)

  @Test
  fun `stored rows come first, live messages replace their stored copies by key`() {
    val storedUser = user("submission:s1", "hi", submissionId = "s1")
    val storedReply = assistant("a1", "hello")
    val live = listOf(user("local:1", "hi", submissionId = "s1"), assistant("a1", "hello there", "streaming"))
    val merged = mergeConvexMessages(listOf(row(storedUser, 1), row(storedReply, 2)), live)
    assertEquals(listOf("local:1", "a1"), merged.map { it.id })
    assertEquals("hello there", merged[1].text)
  }

  @Test
  fun `hidden rows tombstone both key forms and system messages never render`() {
    val retried = user("submission:s2", "again", submissionId = "s2")
    val system = FlueMessage(id = "sys", role = "system", purpose = "advisory", display = "diagnostic")
    val merged = mergeConvexMessages(listOf(row(retried, 5, hidden = true)), listOf(user("u2", "again", submissionId = "s2"), system))
    assertEquals(emptyList<String>(), merged.map { it.id })
  }

  @Test
  fun `metadata timestamps order messages, missing ones fall back to arrival`() {
    val late = assistant("late", "x").copy(metadata = JsonObject(mapOf("timestamp" to JsonPrimitive("2026-01-02T00:00:00Z"))))
    val early = user("early", "y", timestamp = "2026-01-01T00:00:00Z")
    val merged = mergeConvexMessages(listOf(row(late, 100)), listOf(early))
    assertEquals(listOf("early", "late"), merged.map { it.id })
  }

  @Test
  fun `changed detection keys admitted user turns by submission and skips local echoes`() {
    val messages = listOf(user("local:1", "typing"), user("local:2", "sent", submissionId = "s9"), assistant("a", "reply"))
    val changed = changedMessagesForConvexSync(messages, emptyMap())
    assertEquals(listOf("submission:s9", "a"), changed.map { it.id })
    val known = changed.associate { it.id to it.contentJson }
    assertEquals(emptyList<ChatMessageSyncEnvelope>(), changedMessagesForConvexSync(messages, known))
  }
}
