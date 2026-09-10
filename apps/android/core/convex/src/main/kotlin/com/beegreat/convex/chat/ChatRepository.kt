package com.beegreat.convex.chat

import com.beegreat.convex.BeeConvexClient
import com.beegreat.convex.ConvexInt
import com.beegreat.convex.ConvexLong
import com.beegreat.convex.n
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable

@Serializable
data class ChatThread(
  val id: ConvexInt,
  val createdAt: ConvexLong,
  val source: String? = null,
  val title: String? = null,
  val archivedAt: ConvexLong? = null,
)

@Serializable
data class ChatMessageRow(
  val id: String,
  val role: String,
  val contentJson: String,
  val hidden: Boolean? = null,
  val createdAt: ConvexLong,
  val updatedAt: ConvexLong,
)

@Serializable data class ChatMessagesPage(val page: List<ChatMessageRow>, val isDone: Boolean, val continueCursor: String)

@Serializable data class SyncEnvelope(val id: String, val role: String, val contentJson: String, val createdAt: Long)

/** The durable transcript and thread list, over the same `chat:*` functions the Expo app uses. */
class ChatRepository(private val convex: BeeConvexClient) {
  fun threads(): Flow<Result<List<ChatThread>>> = convex.subscribe("chat:listThreads")

  fun activeThread(): Flow<Result<Int>> = convex.subscribe("chat:getActiveThread")

  /** One page of the newest messages first. `cursor` continues from a previous page. */
  fun messagesPage(threadId: Int, numItems: Int, cursor: String?): Flow<Result<ChatMessagesPage>> =
    convex.subscribe(
      "chat:listMessagesPage",
      mapOf("threadId" to threadId.n, "paginationOpts" to mapOf("numItems" to numItems.n, "cursor" to cursor)),
    )

  suspend fun createThread(): Int = io { convex.mutation<Int>("chat:createThread") }

  suspend fun setActiveThread(threadId: Int) = io { convex.mutation("chat:setActiveThread", mapOf("threadId" to threadId.n)) }

  suspend fun setThreadTitle(threadId: Int, title: String) =
    io { convex.mutation("chat:setThreadTitle", mapOf("threadId" to threadId.n, "title" to title)) }

  suspend fun setThreadArchived(threadId: Int, archived: Boolean) =
    io { convex.mutation("chat:setThreadArchived", mapOf("threadId" to threadId.n, "archived" to archived)) }

  suspend fun hideMessages(threadId: Int, messageIds: List<String>) =
    io { convex.mutation("chat:hideMessages", mapOf("threadId" to threadId.n, "messageIds" to messageIds)) }

  suspend fun syncMessages(threadId: Int, messages: List<SyncEnvelope>) =
    io {
      convex.mutation(
        "chat:syncMessages",
        mapOf(
          "threadId" to threadId.n,
          "messages" to messages.map { mapOf("id" to it.id, "role" to it.role, "contentJson" to it.contentJson, "createdAt" to it.createdAt.n) },
        ),
      )
    }

  private suspend inline fun <T> io(crossinline block: suspend () -> T): T = withContext(Dispatchers.IO) { block() }
}
