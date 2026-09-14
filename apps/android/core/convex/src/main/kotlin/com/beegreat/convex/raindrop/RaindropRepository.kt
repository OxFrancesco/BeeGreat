package com.beegreat.convex.raindrop

import com.beegreat.convex.BeeConvexClient
import com.beegreat.convex.ConvexLong
import com.beegreat.convex.connections.AuthorizationStart
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable

@Serializable
data class RaindropStatus(val state: String, val oauthAvailable: Boolean = false, val accountName: String? = null, val syncing: Boolean = false, val lastSyncedAt: ConvexLong? = null, val message: String? = null)
@Serializable
data class RaindropCollection(val id: ConvexLong, val title: String, val parentId: ConvexLong? = null)
@Serializable
data class RaindropBookmark(
  val id: ConvexLong, val url: String, val title: String, val excerpt: String, val note: String,
  val tags: List<String>, val collectionId: ConvexLong, val important: Boolean, val cover: String, val updatedAt: String,
)
@Serializable
data class RaindropPage(val items: List<RaindropBookmark>, val hasMore: Boolean)

class RaindropRepository(private val convex: BeeConvexClient) {
  fun status(): Flow<Result<RaindropStatus>> = convex.subscribe("raindrop:status")
  suspend fun begin(): AuthorizationStart = io { convex.action<AuthorizationStart>("raindropActions:beginAuthorization") }
  suspend fun complete(code: String, state: String) = io { convex.action("raindropActions:completeAuthorization", mapOf("code" to code, "state" to state)) }
  suspend fun connectToken(token: String) = io { convex.action("raindropActions:connectToken", mapOf("token" to token)) }
  suspend fun disconnect() = io { convex.mutation("raindrop:disconnect") }
  suspend fun sync() = io { convex.action("raindropActions:sync") }
  suspend fun collections(): List<RaindropCollection> = io { convex.action<List<RaindropCollection>>("raindropActions:collections") }
  suspend fun bookmarks(collectionId: Long, search: String, page: Int): RaindropPage = io {
    convex.action<RaindropPage>("raindropActions:bookmarks", mapOf("collectionId" to collectionId.toDouble(), "search" to search, "page" to page.toDouble()))
  }
  suspend fun save(id: Long?, url: String, title: String, note: String, tags: List<String>, collectionId: Long, important: Boolean): RaindropBookmark = io {
    convex.action<RaindropBookmark>("raindropActions:save", buildMap {
      if (id != null) put("id", id.toDouble())
      put("url", url); put("title", title); put("note", note); put("tags", tags)
      put("collectionId", collectionId.toDouble()); put("important", important)
    })
  }
  suspend fun trash(id: Long) = io { convex.action("raindropActions:trash", mapOf("id" to id.toDouble())) }
  private suspend inline fun <T> io(crossinline block: suspend () -> T): T = withContext(Dispatchers.IO) { block() }
}
