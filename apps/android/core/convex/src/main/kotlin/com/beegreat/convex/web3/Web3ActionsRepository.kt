package com.beegreat.convex.web3

import com.beegreat.convex.BeeConvexClient
import com.beegreat.convex.ConvexDouble
import com.beegreat.convex.ConvexLong
import com.beegreat.convex.n
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonElement

@Serializable data class EoaRequest(val walletAddress: String, val chainId: ConvexDouble, val stepCount: ConvexDouble)

/** `web3Actions:status`. Result, progress, and error stay raw JSON until the Web3 phase renders them. */
@Serializable
data class Web3ActionView(
  val id: String,
  val summary: String,
  val kind: String,
  /** `pending`, `confirmed`, `executing`, `succeeded`, `failed`, `cancelled`, `expired`. */
  val status: String,
  val expiresAt: ConvexLong,
  val autoConfirmed: Boolean = false,
  val eoaRequest: EoaRequest? = null,
  val result: JsonElement? = null,
  val error: JsonElement? = null,
  val recoveryDetail: JsonElement? = null,
)

@Serializable data class EoaTransaction(val to: String, val data: String, val value: String)

@Serializable data class EoaPlan(val walletAddress: String, val chainId: ConvexDouble, val transactions: List<EoaTransaction>)

@Serializable data class EoaStep(val role: String, val transaction: EoaTransaction)

@Serializable data class FreshEoaPlan(val walletAddress: String, val chainId: ConvexDouble, val transactionSteps: List<EoaStep>)

@Serializable data class EoaProgress(val done: Boolean)

class Web3ActionsRepository(private val convex: BeeConvexClient) {
  fun status(actionId: String): Flow<Result<Web3ActionView?>> = convex.subscribe("web3Actions:status", mapOf("actionId" to actionId))

  /** The manual authorization that moves funds. Bound to the exact summary the user read. */
  suspend fun confirm(actionId: String, expectedSummary: String) =
    withContext(Dispatchers.IO) { convex.mutation("web3Actions:confirm", mapOf("actionId" to actionId, "expectedSummary" to expectedSummary)) }

  /** Claims the pending plan for the connected wallet without scheduling the server signer. */
  suspend fun beginEoaExecution(actionId: String, expectedSummary: String): EoaPlan =
    withContext(Dispatchers.IO) { convex.mutation<EoaPlan>("web3Actions:beginEoaExecution", mapOf("actionId" to actionId, "expectedSummary" to expectedSummary)) }

  /** Rebuilds the remaining steps with fresh quotes; called before every submission. */
  suspend fun refreshEoaExecution(actionId: String): FreshEoaPlan =
    withContext(Dispatchers.IO) { convex.action<FreshEoaPlan>("web3:refreshEoaSugarExecution", mapOf("actionId" to actionId)) }

  suspend fun recordEoaSubmission(actionId: String, index: Int, hash: String, role: String): EoaProgress =
    withContext(Dispatchers.IO) {
      convex.mutation<EoaProgress>("web3Actions:recordEoaSubmission", mapOf("actionId" to actionId, "index" to index.n, "hash" to hash, "role" to role))
    }

  suspend fun recordEoaReceipt(actionId: String, index: Int, hash: String): EoaProgress =
    withContext(Dispatchers.IO) { convex.mutation<EoaProgress>("web3Actions:recordEoaReceipt", mapOf("actionId" to actionId, "index" to index.n, "hash" to hash)) }

  /** `user_rejected`, `account_changed`, or `wallet_error`. */
  suspend fun reportEoaFailure(actionId: String, reason: String) =
    withContext(Dispatchers.IO) { convex.mutation("web3Actions:reportEoaFailure", mapOf("actionId" to actionId, "reason" to reason)) }

  suspend fun cancel(actionId: String): Boolean =
    withContext(Dispatchers.IO) { convex.mutation<Boolean?>("web3Actions:cancel", mapOf("actionId" to actionId)) ?: false }
}
