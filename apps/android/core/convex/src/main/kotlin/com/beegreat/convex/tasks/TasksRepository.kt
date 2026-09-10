package com.beegreat.convex.tasks

import com.beegreat.convex.BeeConvexClient
import com.beegreat.convex.ConvexLong
import com.beegreat.convex.n
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable

@Serializable data class TaskStatus(val id: String, val status: String)

@Serializable
data class Task(
  val id: String,
  val title: String,
  /** `todo` or `done`. */
  val status: String,
  val parentTaskId: String? = null,
  val labels: List<String> = emptyList(),
  val dueDate: ConvexLong? = null,
  val completedAt: ConvexLong? = null,
) {
  val done: Boolean
    get() = status == "done"
}

class TasksRepository(private val convex: BeeConvexClient) {
  fun listByProject(projectId: String): Flow<Result<List<Task>>> = convex.subscribe("tasks:listByProject", mapOf("projectId" to projectId))

  /** Live `todo`/`done` for the ids a beeui tasks card shows. */
  fun statuses(taskIds: List<String>): Flow<Result<List<TaskStatus>>> = convex.subscribe("tasks:statuses", mapOf("taskIds" to taskIds))

  suspend fun create(projectId: String, title: String, parentTaskId: String? = null): String =
    io {
      convex.mutation<String>(
        "tasks:create",
        buildMap {
          put("projectId", projectId)
          put("title", title)
          if (parentTaskId != null) put("parentTaskId", parentTaskId)
        },
      )
    }

  suspend fun toggle(taskId: String) = io { convex.mutation("tasks:toggle", mapOf("taskId" to taskId)) }

  suspend fun rename(taskId: String, title: String) = io { convex.mutation("tasks:update", mapOf("taskId" to taskId, "title" to title)) }

  suspend fun setDueDate(taskId: String, dueDate: Long?) =
    io { convex.mutation("tasks:setDueDate", mapOf("taskId" to taskId, "dueDate" to dueDate?.n)) }

  suspend fun remove(taskId: String) = io { convex.mutation("tasks:remove", mapOf("taskId" to taskId)) }

  private suspend inline fun <T> io(crossinline block: suspend () -> T): T = withContext(Dispatchers.IO) { block() }
}
