package com.beegreat.convex.health

import com.beegreat.convex.BeeConvexClient
import com.beegreat.convex.ConvexInt
import com.beegreat.convex.ConvexLong
import com.beegreat.convex.n
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable

/** One Bee Healthy day: mood, water, and the short daily note. */
@Serializable
data class HealthDay(
  val localDate: String,
  /** `awful`, `bad`, `okay`, `good`, `great`, or null. */
  val mood: String? = null,
  val hydrationMl: ConvexInt,
  val journal: String,
  val timeZone: String,
  val createdAt: ConvexLong,
  val updatedAt: ConvexLong,
)

@Serializable
data class JournalPhoto(
  val id: String,
  val kind: String,
  val url: String,
  val mimeType: String,
  val fileName: String? = null,
  val width: ConvexInt? = null,
  val height: ConvexInt? = null,
  val createdAt: ConvexLong,
)

@Serializable
data class JournalEntry(
  val id: String,
  val localDate: String,
  val timeZone: String,
  val occurredAt: ConvexLong,
  val title: String,
  val body: String,
  val tags: List<String> = emptyList(),
  val isPinned: Boolean = false,
  val isFavorite: Boolean = false,
  val coverPhoto: JournalPhoto? = null,
  val attachmentCount: ConvexInt = 0,
  val createdAt: ConvexLong,
  val updatedAt: ConvexLong,
)

@Serializable data class JournalMonthDay(val localDate: String, val entryCount: ConvexInt, val hasPhoto: Boolean)

@Serializable data class StreakDay(val localDate: String, val done: Boolean?)
@Serializable data class TrackerStreak(val current: ConvexInt, val currentCapped: Boolean, val best: ConvexInt, val windowDays: ConvexInt, val completedDays: ConvexInt, val days: List<StreakDay>)
@Serializable data class HealthWeekDay(val localDate: String, val mood: String?, val hydrationMl: ConvexInt)
@Serializable data class HealthCalendarDay(val localDate: String, val mood: Boolean, val water: Double, val journal: Boolean?)
@Serializable data class HealthOverview(val mood: TrackerStreak, val water: TrackerStreak, val journal: TrackerStreak, val week: List<HealthWeekDay>, val calendar: List<HealthCalendarDay>)
@Serializable data class HydrationAdjustment(val appliedDeltaMl: ConvexInt)

class HealthRepository(private val convex: BeeConvexClient) {
  fun overview(throughDate: String): Flow<Result<HealthOverview>> = convex.subscribe("healthJournal:overview", mapOf("throughDate" to throughDate))

  fun day(localDate: String): Flow<Result<HealthDay?>> = convex.subscribe("healthJournal:getByDate", mapOf("localDate" to localDate))

  fun recentDays(throughDate: String, limit: Int): Flow<Result<List<HealthDay>>> =
    convex.subscribe("healthJournal:listRecent", mapOf("limit" to limit.n, "throughDate" to throughDate))

  suspend fun setMood(localDate: String, timeZone: String, mood: String): HealthDay =
    io { convex.mutation<HealthDay>("healthJournal:setMood", mapOf("localDate" to localDate, "timeZone" to timeZone, "mood" to mood)) }

  suspend fun adjustHydration(localDate: String, timeZone: String, deltaMl: Int) =
    io { convex.mutation<HydrationAdjustment>("healthJournal:adjustHydration", mapOf("localDate" to localDate, "timeZone" to timeZone, "deltaMl" to deltaMl.n)) }

  suspend fun importLegacy() = io { convex.mutation("journalEntries:importLegacy") }

  fun searchEntries(query: String): Flow<Result<List<JournalEntry>>> = convex.subscribe("journalEntries:search", mapOf("query" to query))

  fun recentEntries(throughDate: String, limit: Int): Flow<Result<List<JournalEntry>>> =
    convex.subscribe("journalEntries:listRecent", mapOf("limit" to limit.n, "throughDate" to throughDate))

  fun dayEntries(localDate: String): Flow<Result<List<JournalEntry>>> = convex.subscribe("journalEntries:listDay", mapOf("localDate" to localDate))

  fun month(monthStart: String): Flow<Result<List<JournalMonthDay>>> = convex.subscribe("journalEntries:listMonth", mapOf("monthStart" to monthStart))

  fun entry(entryId: String): Flow<Result<JournalEntry?>> = convex.subscribe("journalEntries:get", mapOf("entryId" to entryId))

  fun photos(entryId: String): Flow<Result<List<JournalPhoto>>> = convex.subscribe("journalEntries:listPhotos", mapOf("entryId" to entryId))

  suspend fun createDraft(localDate: String, timeZone: String, occurredAt: Long): JournalEntry =
    io { convex.mutation<JournalEntry>("journalEntries:createDraft", mapOf("localDate" to localDate, "timeZone" to timeZone, "occurredAt" to occurredAt.n)) }

  /** Optimistic-concurrency update; Convex rejects with `CONFLICT` when `expectedUpdatedAt` is stale. */
  suspend fun update(
    entryId: String,
    expectedUpdatedAt: Long,
    title: String? = null,
    body: String? = null,
    tags: List<String>? = null,
    isPinned: Boolean? = null,
    isFavorite: Boolean? = null,
  ): JournalEntry =
    io {
      convex.mutation<JournalEntry>(
        "journalEntries:update",
        buildMap {
          put("entryId", entryId)
          put("expectedUpdatedAt", expectedUpdatedAt.n)
          if (title != null) put("title", title)
          if (body != null) put("body", body)
          if (tags != null) put("tags", tags)
          if (isPinned != null) put("isPinned", isPinned)
          if (isFavorite != null) put("isFavorite", isFavorite)
        },
      )
    }

  suspend fun remove(entryId: String) = io { convex.mutation("journalEntries:remove", mapOf("entryId" to entryId)) }

  suspend fun removePhoto(photoId: String) = io { convex.mutation("journalEntries:removePhoto", mapOf("photoId" to photoId)) }

  /** The site URL to POST photo bytes to; the caller appends `entryId` and dimensions. */
  suspend fun photoUploadUrl(): String = io { convex.mutation<String>("journalEntries:generatePhotoUploadUrl") }

  private suspend inline fun <T> io(crossinline block: suspend () -> T): T = withContext(Dispatchers.IO) { block() }
}
