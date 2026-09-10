package com.beegreat.convex.focus

import com.beegreat.convex.BeeConvexClient
import com.beegreat.convex.ConvexDouble
import com.beegreat.convex.ConvexLong
import com.beegreat.convex.n
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable

@Serializable
data class HiveBalances(val honeyBalance: ConvexDouble, val honeycombScore: ConvexDouble, val royalJellyBalance: ConvexDouble)

@Serializable data class GolieBee(val golieBeeId: String, val seed: String, val variant: String, val status: String)

@Serializable data class ActiveGoal(val goalId: String, val title: String, val finalGoal: String? = null, val golieBee: GolieBee)

@Serializable
data class ActiveHighlight(
  val highlightId: String,
  val goalId: String,
  val projectId: String,
  val taskId: String,
  val title: String,
  val expiresAt: ConvexLong,
)

@Serializable
data class VerifiedProgress(
  val eventId: String,
  val goalId: String,
  val taskId: String,
  val occurredAt: ConvexLong,
  val honeyDelta: ConvexDouble,
  val scoreDelta: ConvexDouble,
)

/** `firstFocus:getCurrent`. The economy block is large and lands with the Hive screen. */
@Serializable
data class CurrentHive(
  val hive: HiveBalances,
  val activeGoals: List<ActiveGoal>,
  val activeHighlight: ActiveHighlight? = null,
  val latestVerifiedProgress: VerifiedProgress? = null,
)

@Serializable
data class FirstFocusConfirmation(val goalTitle: String? = null, val projectTitle: String? = null, val taskTitle: String? = null)

@Serializable data class ConfirmPlanResult(val status: String)

@Serializable
data class CompleteHighlightResult(
  val status: String,
  val taskId: String,
  val honeyAwarded: ConvexDouble,
  val scoreAwarded: ConvexDouble,
  val honeyBalance: ConvexDouble,
  val honeycombScore: ConvexDouble,
)

class FirstFocusRepository(private val convex: BeeConvexClient) {
  fun current(): Flow<Result<CurrentHive>> = convex.subscribe("firstFocus:getCurrent")

  fun confirmation(requestId: String): Flow<Result<FirstFocusConfirmation?>> =
    convex.subscribe("firstFocus:getConfirmation", mapOf("requestId" to requestId))

  suspend fun confirmPlan(
    requestId: String,
    confirmed: Boolean,
    goalTitle: String,
    projectTitle: String,
    taskTitle: String,
    highlightExpiresAt: Long,
  ): ConfirmPlanResult =
    withContext(Dispatchers.IO) {
      convex.mutation<ConfirmPlanResult>(
        "firstFocus:confirmPlan",
        mapOf(
          "requestId" to requestId,
          "confirmed" to confirmed,
          "goalTitle" to goalTitle,
          "projectTitle" to projectTitle,
          "taskTitle" to taskTitle,
          "highlightExpiresAt" to highlightExpiresAt.n,
        ),
      )
    }

  suspend fun completeHighlight(requestId: String, taskId: String): CompleteHighlightResult =
    withContext(Dispatchers.IO) {
      convex.mutation<CompleteHighlightResult>("firstFocus:completeHighlight", mapOf("requestId" to requestId, "taskId" to taskId))
    }
}
