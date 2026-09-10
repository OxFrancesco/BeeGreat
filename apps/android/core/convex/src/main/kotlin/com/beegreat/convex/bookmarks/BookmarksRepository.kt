package com.beegreat.convex.bookmarks

import com.beegreat.convex.BeeConvexClient
import com.beegreat.convex.ConvexInt
import com.beegreat.convex.ConvexLong
import com.beegreat.convex.n
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.withContext
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class BookmarkMeta(
  val siteName: String? = null,
  val author: String? = null,
  val handle: String? = null,
  val imageUrl: String? = null,
  val faviconUrl: String? = null,
  val publishedAt: ConvexLong? = null,
  val tweetId: String? = null,
  val videoId: String? = null,
  val durationSeconds: ConvexInt? = null,
)

/** `bookmarkListItemValidator`; `bookmarks:get` returns the same fields plus `content`. */
@Serializable
data class Bookmark(
  @SerialName("_id") val id: String,
  val url: String,
  /** `website`, `tweet`, or `youtube`. */
  val kind: String,
  /** `pending`, `processing`, `ready`, or `failed`. */
  val status: String,
  val title: String? = null,
  val summary: String? = null,
  val labels: List<String> = emptyList(),
  val note: String? = null,
  val content: String? = null,
  val meta: BookmarkMeta? = null,
  val transcriptSource: String? = null,
  val errorCode: String? = null,
  val errorMessage: String? = null,
  val retryCount: ConvexInt = 0,
  val createdAt: ConvexLong,
  val updatedAt: ConvexLong,
) {
  val isWorking: Boolean
    get() = status == "pending" || status == "processing"
}

@Serializable data class BookmarksPage(val page: List<Bookmark>, val isDone: Boolean, val continueCursor: String)

@Serializable data class LabelCount(val label: String, val count: ConvexInt)

class BookmarksRepository(private val convex: BeeConvexClient) {
  fun page(kind: String?, label: String?, numItems: Int, cursor: String?): Flow<Result<BookmarksPage>> =
    convex.subscribe(
      "bookmarks:list",
      buildMap {
        if (kind != null) put("kind", kind)
        if (label != null) put("label", label)
        put("paginationOpts", mapOf("numItems" to numItems.n, "cursor" to cursor))
      },
    )

  fun searchPage(query: String, kind: String?, label: String?, numItems: Int, cursor: String?): Flow<Result<BookmarksPage>> =
    convex.subscribe(
      "bookmarks:searchPage",
      buildMap {
        put("query", query)
        if (kind != null) put("kind", kind)
        if (label != null) put("label", label)
        put("paginationOpts", mapOf("numItems" to numItems.n, "cursor" to cursor))
      },
    )

  fun labels(): Flow<Result<List<LabelCount>>> = convex.subscribe("bookmarks:labels")

  fun bookmark(bookmarkId: String): Flow<Result<Bookmark?>> = convex.subscribe("bookmarks:get", mapOf("bookmarkId" to bookmarkId))

  /** Returns the new bookmark id. Crawling happens server-side afterwards. */
  suspend fun add(url: String, note: String?): String =
    io { convex.mutation<String>("bookmarks:add", buildMap { put("url", url); if (!note.isNullOrBlank()) put("note", note) }) }

  suspend fun update(bookmarkId: String, title: String?, note: String?): Bookmark? =
    io {
      convex.mutation<Bookmark?>(
        "bookmarks:update",
        buildMap {
          put("bookmarkId", bookmarkId)
          if (title != null) put("title", title)
          if (note != null) put("note", note)
        },
      )
    }

  suspend fun changeLabel(bookmarkId: String, label: String, add: Boolean) =
    io { convex.mutation("bookmarks:changeLabel", mapOf("bookmarkId" to bookmarkId, "label" to label, "operation" to if (add) "add" else "remove")) }

  suspend fun remove(bookmarkId: String) = io { convex.mutation("bookmarks:remove", mapOf("bookmarkId" to bookmarkId)) }

  suspend fun retry(bookmarkId: String) = io { convex.mutation("bookmarks:retry", mapOf("bookmarkId" to bookmarkId)) }

  private suspend inline fun <T> io(crossinline block: suspend () -> T): T = withContext(Dispatchers.IO) { block() }
}
