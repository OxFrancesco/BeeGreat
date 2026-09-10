package com.beegreat.convex.jobs

import com.beegreat.convex.BeeConvexClient
import com.beegreat.convex.ConvexInt
import com.beegreat.convex.ConvexLong
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable

/** `once`, `interval`, or `calendar`; only the fields for that kind are present. */
@Serializable
data class JobSchedule(
  val kind: String,
  val at: ConvexLong? = null,
  val everyMs: ConvexLong? = null,
  val anchorAt: ConvexLong? = null,
  val frequency: String? = null,
  val interval: ConvexInt? = null,
  val firstOccurrenceAt: ConvexLong? = null,
  val timeZone: String? = null,
)

@Serializable
data class AgentJob(
  val id: String,
  val title: String,
  val instruction: String,
  val schedule: JobSchedule,
  /** active, paused, cancelled, completed. */
  val status: String,
  val delivery: List<String> = emptyList(),
  val threadId: ConvexInt,
  val nextRunAt: ConvexLong? = null,
  val lastRunAt: ConvexLong? = null,
  val consecutiveFailures: ConvexInt = 0,
  val createdAt: ConvexLong,
  val updatedAt: ConvexLong,
)

@Serializable
data class JobGrant(
  val jobId: String,
  val kind: String,
  val poolAddress: String,
  val allowedActions: List<String>,
  /** pending, active, revoked, expired. */
  val status: String,
  val approvedAt: ConvexLong? = null,
  val expiresAt: ConvexLong? = null,
)

class JobsRepository(private val convex: BeeConvexClient) {
  fun jobs(): Flow<Result<List<AgentJob>>> = convex.subscribe("agentJobs:list")

  fun grants(): Flow<Result<List<JobGrant>>> = convex.subscribe("agentJobGrants:list")

  suspend fun pause(jobId: String) = io { convex.mutation("agentJobs:pause", mapOf("jobId" to jobId)) }

  suspend fun resume(jobId: String) = io { convex.mutation<Double>("agentJobs:resume", mapOf("jobId" to jobId)) }

  suspend fun cancel(jobId: String) = io { convex.mutation("agentJobs:cancel", mapOf("jobId" to jobId)) }

  suspend fun runNow(jobId: String) = io { convex.mutation<String>("agentJobs:runNow", mapOf("jobId" to jobId)) }

  suspend fun approveGrant(jobId: String) = io { convex.mutation<Double>("agentJobGrants:approve", mapOf("jobId" to jobId)) }

  suspend fun revokeGrant(jobId: String) = io { convex.mutation("agentJobGrants:revoke", mapOf("jobId" to jobId)) }

  private suspend inline fun <T> io(crossinline block: suspend () -> T): T = withContext(Dispatchers.IO) { block() }
}
