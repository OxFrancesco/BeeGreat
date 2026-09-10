package com.beegreat.convex.projects

import com.beegreat.convex.BeeConvexClient
import com.beegreat.convex.ConvexInt
import com.beegreat.convex.n
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable

/** A coarse target: a quarter or a whole year. */
@Serializable
data class ProjectDue(val year: ConvexInt, val quarter: ConvexInt? = null) {
  val label: String
    get() = if (quarter != null) "Q$quarter $year" else year.toString()
}

@Serializable
data class ProjectDetail(
  val id: String,
  val title: String,
  val status: String,
  val due: ProjectDue? = null,
  val beeImageUrl: String? = null,
  val goalId: String,
  val goalTitle: String? = null,
)

class ProjectsRepository(private val convex: BeeConvexClient) {
  fun project(projectId: String): Flow<Result<ProjectDetail?>> = convex.subscribe("projects:get", mapOf("projectId" to projectId))

  suspend fun create(goalId: String, title: String): String =
    withContext(Dispatchers.IO) { convex.mutation<String>("projects:create", mapOf("goalId" to goalId, "title" to title)) }

  suspend fun rename(projectId: String, title: String) =
    withContext(Dispatchers.IO) { convex.mutation("projects:update", mapOf("projectId" to projectId, "title" to title)) }

  suspend fun remove(projectId: String) = withContext(Dispatchers.IO) { convex.mutation("projects:remove", mapOf("projectId" to projectId)) }

  suspend fun setDue(projectId: String, due: ProjectDue?) =
    withContext(Dispatchers.IO) {
      convex.mutation(
        "projects:setDue",
        mapOf("projectId" to projectId, "due" to due?.let { buildMap { put("year", it.year.n); it.quarter?.let { q -> put("quarter", q.n) } } }),
      )
    }
}
