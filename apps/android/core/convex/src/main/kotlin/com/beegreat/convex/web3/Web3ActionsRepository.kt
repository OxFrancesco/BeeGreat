package com.beegreat.convex.web3

import com.beegreat.convex.BeeConvexClient
import com.beegreat.convex.ConvexDouble
import com.beegreat.convex.ConvexLong
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

class Web3ActionsRepository(private val convex: BeeConvexClient) {
  fun status(actionId: String): Flow<Result<Web3ActionView?>> = convex.subscribe("web3Actions:status", mapOf("actionId" to actionId))

  /** The manual authorization that moves funds. Bound to the exact summary the user read. */
  suspend fun confirm(actionId: String, expectedSummary: String) =
    withContext(Dispatchers.IO) { convex.mutation("web3Actions:confirm", mapOf("actionId" to actionId, "expectedSummary" to expectedSummary)) }

  suspend fun cancel(actionId: String): Boolean =
    withContext(Dispatchers.IO) { convex.mutation<Boolean?>("web3Actions:cancel", mapOf("actionId" to actionId)) ?: false }
}
