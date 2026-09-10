package com.beegreat.convex.tasks

import com.beegreat.convex.BeeConvexClient
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable

@Serializable data class TaskStatus(val id: String, val status: String)

class TasksRepository(private val convex: BeeConvexClient) {
  /** Live `todo`/`done` for the ids a beeui tasks card shows. */
  fun statuses(taskIds: List<String>): Flow<Result<List<TaskStatus>>> =
    convex.subscribe("tasks:statuses", mapOf("taskIds" to taskIds))

  suspend fun toggle(taskId: String) = withContext(Dispatchers.IO) { convex.mutation("tasks:toggle", mapOf("taskId" to taskId)) }
}
