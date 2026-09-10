package com.beegreat.convex.goals

import com.beegreat.convex.BeeConvexClient
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.withContext

/** Goals CRUD over the same Convex functions the Expo app calls. */
class GoalsRepository(private val convex: BeeConvexClient) {
  fun goals(): Flow<Result<List<GoalSummary>>> = convex.subscribe("goals:list")

  suspend fun create(title: String, finalGoal: String? = null): String =
    withContext(Dispatchers.IO) {
      convex.mutation<String>(
        "goals:create",
        buildMap {
          put("title", title)
          if (finalGoal != null) put("finalGoal", finalGoal)
        },
      )
    }

  suspend fun rename(goalId: String, title: String) =
    withContext(Dispatchers.IO) {
      convex.mutation("goals:update", mapOf("goalId" to goalId, "title" to title))
    }

  suspend fun remove(goalId: String) =
    withContext(Dispatchers.IO) { convex.mutation("goals:remove", mapOf("goalId" to goalId)) }
}
