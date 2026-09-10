package com.beegreat.convex.account

import com.beegreat.convex.BeeConvexClient
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable

@Serializable data class PreparedDeletion(val jobId: String)

@Serializable data class DeletionStatus(val status: String)

/** The three-step deletion handshake the Expo app runs; see `use-account-deletion.ts`. */
class AccountDeletionRepository(private val convex: BeeConvexClient) {
  suspend fun prepare(activationToken: String): PreparedDeletion =
    io { convex.mutation<PreparedDeletion>("accountDeletion:prepare", mapOf("confirmation" to "DELETE", "activationToken" to activationToken)) }

  suspend fun beginIdentityDeletion(jobId: String, activationToken: String) =
    io { convex.mutation("accountDeletion:beginIdentityDeletion", mapOf("jobId" to jobId, "activationToken" to activationToken)) }

  suspend fun activate(jobId: String, activationToken: String): DeletionStatus =
    io { convex.mutation<DeletionStatus>("accountDeletion:activate", mapOf("jobId" to jobId, "activationToken" to activationToken)) }

  suspend fun cancel(jobId: String, activationToken: String): DeletionStatus =
    io { convex.mutation<DeletionStatus>("accountDeletion:cancel", mapOf("jobId" to jobId, "activationToken" to activationToken)) }

  private suspend inline fun <T> io(crossinline block: suspend () -> T): T = withContext(Dispatchers.IO) { block() }
}
