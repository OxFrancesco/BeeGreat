package com.beegreat.convex.devin

import com.beegreat.convex.BeeConvexClient
import kotlinx.coroutines.flow.Flow
import kotlinx.serialization.Serializable

@Serializable data class DevinPullRequest(val url: String, val state: String? = null)

@Serializable
data class DevinSession(
  val sessionId: String,
  val url: String,
  val title: String? = null,
  val status: String,
  val statusDetail: String? = null,
  val pullRequests: List<DevinPullRequest> = emptyList(),
)

class DevinRepository(private val convex: BeeConvexClient) {
  /** Live status for the Devin card; null until the session is recorded. */
  fun session(sessionId: String): Flow<Result<DevinSession?>> = convex.subscribe("devinData:get", mapOf("sessionId" to sessionId))
}
