package com.beegreat.convex.nfc

import com.beegreat.convex.BeeConvexClient
import com.beegreat.convex.ConvexInt
import com.beegreat.convex.ConvexLong
import com.beegreat.convex.n
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.withContext
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/** `hydration` carries `amountMl`; `reminder` has no extra fields. */
@Serializable data class NfcDefinition(val type: String, val amountMl: ConvexInt? = null)

@Serializable
data class NfcAction(
  @SerialName("_id") val id: String,
  val label: String,
  val enabled: Boolean,
  val definition: NfcDefinition,
  val completionCount: ConvexInt,
  val tagUrl: String,
  val lastExecutedAt: ConvexLong? = null,
  val createdAt: ConvexLong,
  val updatedAt: ConvexLong,
)

@Serializable data class ExecutedAction(val label: String, val definition: NfcDefinition, val completionCount: ConvexInt)

@Serializable
data class NfcOutcome(val type: String, val localDate: String, val timeZone: String, val appliedMl: ConvexInt? = null, val appliedCount: ConvexInt? = null)

@Serializable data class NfcExecution(val duplicate: Boolean, val executionId: String, val action: ExecutedAction, val outcome: NfcOutcome)

@Serializable data class NfcUndo(val action: ExecutedAction, val outcome: NfcOutcome, val undoneAt: ConvexLong)

class NfcActionsRepository(private val convex: BeeConvexClient) {
  fun list(): Flow<Result<List<NfcAction>>> = convex.subscribe("nfcActions:list")

  suspend fun create(label: String, definition: NfcDefinition): NfcAction =
    io { convex.mutation<NfcAction>("nfcActions:create", mapOf("label" to label, "definition" to definition.toArgs())) }

  suspend fun update(actionId: String, expectedUpdatedAt: Long, label: String? = null, enabled: Boolean? = null, definition: NfcDefinition? = null): NfcAction =
    io {
      convex.mutation<NfcAction>(
        "nfcActions:update",
        buildMap {
          put("actionId", actionId)
          put("expectedUpdatedAt", expectedUpdatedAt.n)
          if (label != null) put("label", label)
          if (enabled != null) put("enabled", enabled)
          if (definition != null) put("definition", definition.toArgs())
        },
      )
    }

  suspend fun remove(actionId: String) = io { convex.mutation("nfcActions:remove", mapOf("actionId" to actionId)) }

  /** Idempotent per tap window; `duplicate` is true when the same tag was just tapped. */
  suspend fun execute(publicId: String, localDate: String, timeZone: String): NfcExecution =
    io { convex.mutation<NfcExecution>("nfcActions:execute", mapOf("publicId" to publicId, "localDate" to localDate, "timeZone" to timeZone)) }

  suspend fun undo(executionId: String): NfcUndo = io { convex.mutation<NfcUndo>("nfcActions:undo", mapOf("executionId" to executionId)) }

  private fun NfcDefinition.toArgs(): Map<String, Any?> = buildMap {
    put("type", type)
    if (type == "hydration") put("amountMl", (amountMl ?: 250).n)
  }

  private suspend inline fun <T> io(crossinline block: suspend () -> T): T = withContext(Dispatchers.IO) { block() }
}
