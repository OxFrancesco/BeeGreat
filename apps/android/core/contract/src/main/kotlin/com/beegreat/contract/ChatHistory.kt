package com.beegreat.contract

import com.beegreat.flue.FlueJson
import com.beegreat.flue.FlueMessage

// Port of packages/chat-sync/src/chat-history.ts.

data class StoredChatMessage(val id: String, val contentJson: String, val createdAt: Long, val hidden: Boolean = false)

data class ChatMessageSyncEnvelope(val id: String, val role: String, val contentJson: String, val createdAt: Long)

private const val LIVE_SYNC_TAIL_SIZE = 8

private fun messageKeys(message: FlueMessage): List<String> =
  buildList {
    add("id:${message.id}")
    if (message.isUser && message.submissionId != null) add("submission:${message.submissionId}")
  }

private fun messageTimestamp(message: FlueMessage, fallback: Long): Long = message.timestampMillis ?: fallback

/** True for the user/assistant turns Convex stores as chat history. */
private fun isSyncable(message: FlueMessage) = message.role != "system"

/** Gives admitted user turns a stable key while Flue reconciles its local echo. */
fun messagesForConvexSync(messages: List<FlueMessage>): List<FlueMessage> =
  messages.mapNotNull { message ->
    when {
      !isSyncable(message) -> null
      message.isUser && message.submissionId != null -> message.copy(id = "submission:${message.submissionId}")
      message.id.startsWith("local:") -> null
      else -> message
    }
  }

fun encodeMessage(message: FlueMessage): String = FlueJson.encodeToString(FlueMessage.serializer(), message)

/** Serializes only unknown messages and the active tail of a live snapshot. */
fun changedMessagesForConvexSync(messages: List<FlueMessage>, knownContent: Map<String, String>): List<ChatMessageSyncEnvelope> {
  val syncable = messagesForConvexSync(messages)
  val tailStart = maxOf(0, syncable.size - LIVE_SYNC_TAIL_SIZE)
  return syncable.mapIndexedNotNull { index, message ->
    val previous = knownContent[message.id]
    if (previous != null && index < tailStart) return@mapIndexedNotNull null
    val contentJson = encodeMessage(message)
    if (previous == contentJson) return@mapIndexedNotNull null
    ChatMessageSyncEnvelope(message.id, message.role, contentJson, messageTimestamp(message, index.toLong()))
  }
}

private fun isHiddenMessage(message: FlueMessage, hiddenIds: Set<String>) =
  message.id in hiddenIds || (message.isUser && message.submissionId != null && "submission:${message.submissionId}" in hiddenIds)

/** Combines the durable transcript with Flue's live streaming envelope. */
fun mergeConvexMessages(rows: List<StoredChatMessage>?, flueMessages: List<FlueMessage>): List<FlueMessage> {
  class Entry(var message: FlueMessage, var createdAt: Long)
  val ordered = ArrayList<Entry>()
  val position = HashMap<String, Int>()

  fun findPosition(message: FlueMessage) = messageKeys(message).firstNotNullOfOrNull { position[it] }

  for (row in rows ?: emptyList()) {
    val message = runCatching { FlueJson.decodeFromString(FlueMessage.serializer(), row.contentJson) }.getOrNull() ?: continue
    val createdAt = messageTimestamp(message, row.createdAt)
    val existing = findPosition(message)
    if (existing == null) {
      val index = ordered.size
      ordered += Entry(message, createdAt)
      for (key in messageKeys(message)) position[key] = index
    } else {
      val previous = ordered[existing]
      val keys = messageKeys(previous.message) + messageKeys(message)
      previous.message = message
      previous.createdAt = minOf(previous.createdAt, createdAt)
      for (key in keys) position[key] = existing
    }
  }

  val fallbackTimestamp = (ordered.maxOfOrNull { it.createdAt } ?: 0L) + 1
  for ((index, message) in flueMessages.withIndex()) {
    val createdAt = messageTimestamp(message, fallbackTimestamp + index)
    val existing = findPosition(message)
    if (existing == null) {
      val next = ordered.size
      for (key in messageKeys(message)) position[key] = next
      ordered += Entry(message, createdAt)
    } else {
      for (key in messageKeys(message)) position[key] = existing
      ordered[existing].message = message
    }
  }

  val hiddenIds = (rows ?: emptyList()).filter { it.hidden }.map { it.id }.toSet()
  return ordered
    .sortedBy { it.createdAt }
    .map { it.message }
    .filter { isSyncable(it) && it.display != "hidden" && it.display != "diagnostic" }
    .filterNot { isHiddenMessage(it, hiddenIds) }
}
