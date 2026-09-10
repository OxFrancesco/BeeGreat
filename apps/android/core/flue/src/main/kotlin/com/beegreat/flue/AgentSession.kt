package com.beegreat.flue

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.launchIn
import kotlinx.coroutines.flow.onEach
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive

enum class AgentStatus {
  Idle,
  Connecting,
  Submitted,
  Streaming,
  Error,
}

data class FailedSend(val id: String, val message: String, val error: Throwable)

data class AgentSnapshot(
  val messages: List<FlueMessage> = emptyList(),
  val status: AgentStatus = AgentStatus.Idle,
  val historyReady: Boolean = false,
  val error: Throwable? = null,
  val failedSends: List<FailedSend> = emptyList(),
  val settlements: List<FlueSettlement> = emptyList(),
)

private data class PendingSend(val localId: String, val submissionId: String? = null, val optimistic: FlueMessage)

/**
 * Optimistic send state layered over a [ConversationObserver]. Port of
 * `AgentSession` and `agent-reducer.ts` in `@flue/react`: a local echo shows
 * until its canonical copy or settlement arrives, the canonical user message
 * is re-keyed to the echo's id so the row stays stable, and `status` is
 * derived from streaming parts, pending sends, and the newest local
 * settlement.
 */
class AgentSession(
  private val http: FlueHttp,
  live: LiveMode,
  private val scope: CoroutineScope,
) {
  private val observer = ConversationObserver(http, live, scope)
  private val _state = MutableStateFlow(AgentSnapshot())
  val state: StateFlow<AgentSnapshot> = _state.asStateFlow()

  private var conversation: FlueConversationState? = null
  private var observedPhase = ObservationPhase.Loading
  private var observedError: Throwable? = null
  private var pendingSends: List<PendingSend> = emptyList()
  private var failedOptimistic: List<FlueMessage> = emptyList()
  private var failedSends: List<FailedSend> = emptyList()
  private val localIdBySubmission = LinkedHashMap<String, String>()
  private val localSubmissionIds = ArrayList<String>()
  private var activeSubmissionIds: List<String> = emptyList()
  private var historyReady = false
  private var localCounter = 0

  fun start() {
    observer.state.onEach { applyObservation(it) }.launchIn(scope)
    observer.start()
  }

  fun refresh() = observer.refresh()

  fun close() = observer.close()

  fun attachmentUrl(id: String) = http.attachmentUrl(id)

  suspend fun sendMessage(text: String, images: List<DeliveredAttachment> = emptyList()) {
    val localId = "local:${++localCounter}"
    synchronized(this) {
      val settled = conversation?.settlements?.map { it.submissionId }?.toSet() ?: emptySet()
      pendingSends = pendingSends + PendingSend(localId, optimistic = optimisticMessage(localId, text, images))
      localSubmissionIds.removeAll { it in settled }
      failedSends = emptyList()
      failedOptimistic = emptyList()
      observedError = null
      converge()
    }
    try {
      val receipt = http.send(text, images)
      synchronized(this) {
        pendingSends = pendingSends.map { if (it.localId == localId) it.copy(submissionId = receipt.submissionId) else it }
        localIdBySubmission[receipt.submissionId] = localId
        if (receipt.submissionId !in localSubmissionIds) localSubmissionIds += receipt.submissionId
        if (receipt.submissionId !in activeSubmissionIds) activeSubmissionIds = activeSubmissionIds + receipt.submissionId
        converge()
      }
      if (observer.state.value.phase == ObservationPhase.Absent) observer.refresh()
    } catch (e: Throwable) {
      synchronized(this) {
        val failed = pendingSends.firstOrNull { it.localId == localId }
        pendingSends = pendingSends.filter { it.localId != localId }
        if (failed != null) {
          failedOptimistic = failedOptimistic + failed.optimistic
          failedSends = failedSends + FailedSend(failed.localId, text, e)
        }
        converge()
      }
      throw e
    }
  }

  suspend fun abort() = http.abort()

  private fun applyObservation(observed: ObservationSnapshot) {
    synchronized(this) {
      observedPhase = observed.phase
      observedError = observed.error
      when (observed.phase) {
        ObservationPhase.Error -> {
          _state.value = _state.value.copy(status = AgentStatus.Error, error = observed.error)
          return
        }
        ObservationPhase.Absent -> {
          conversation = null
          historyReady = true
        }
        else -> if (observed.conversation != null) {
          conversation = observed.conversation
          historyReady = true
        }
      }
      converge()
    }
  }

  private fun converge() {
    val conversation = conversation
    val settledIds = conversation?.settlements?.map { it.submissionId }?.toSet() ?: emptySet()
    val canonical =
      (conversation?.messages ?: emptyList()).map { message ->
        val localId = if (message.isUser && message.submissionId != null) localIdBySubmission[message.submissionId] else null
        if (localId != null) message.copy(id = localId) else message
      }
    val canonicalSubmissionIds = conversation?.messages?.mapNotNull { it.submissionId }?.toSet() ?: emptySet()

    val stillPending = ArrayList<PendingSend>()
    val echoes = ArrayList<FlueMessage>()
    for (pending in pendingSends) {
      val confirmed = pending.submissionId?.let { it in canonicalSubmissionIds || it in settledIds } ?: false
      if (confirmed) continue
      stillPending += pending
      echoes += pending.optimistic
    }
    pendingSends = stillPending

    val ownStreaming = conversation?.messages?.any { it.isAssistant && it.parts.any(FluePart::isStreaming) } ?: false
    val settlementBySubmission = conversation?.settlements?.associateBy { it.submissionId } ?: emptyMap()
    val lastSettledLocal = localSubmissionIds.asReversed().firstNotNullOfOrNull { settlementBySubmission[it] }
    val failedSettlement = lastSettledLocal?.takeIf { it.outcome == "failed" }
    activeSubmissionIds = activeSubmissionIds.filter { it !in settledIds }
    val hasFailedSend = failedSends.isNotEmpty()

    val status =
      when {
        failedSettlement != null -> AgentStatus.Error
        ownStreaming -> AgentStatus.Streaming
        pendingSends.isNotEmpty() -> AgentStatus.Submitted
        activeSubmissionIds.isNotEmpty() -> AgentStatus.Streaming
        hasFailedSend -> AgentStatus.Error
        else -> AgentStatus.Idle
      }
    val connecting = observedPhase == ObservationPhase.Loading || observedPhase == ObservationPhase.Connecting
    val error =
      when {
        failedSettlement != null -> IllegalStateException(settlementError(failedSettlement))
        status == AgentStatus.Error && hasFailedSend -> failedSends.last().error
        connecting -> observedError
        else -> null
      }
    _state.value =
      AgentSnapshot(
        messages = canonical + echoes + failedOptimistic,
        status = if (status == AgentStatus.Idle && connecting) AgentStatus.Connecting else status,
        historyReady = historyReady,
        error = error,
        failedSends = failedSends,
        settlements = conversation?.settlements ?: emptyList(),
      )
  }

  private fun optimisticMessage(localId: String, text: String, images: List<DeliveredAttachment>) =
    FlueMessage(
      id = localId,
      role = "user",
      purpose = "user",
      display = "visible",
      parts =
        listOf<FluePart>(FluePart.Text(text, "done")) +
          images.map { FluePart.File(mediaType = it.mimeType, url = "data:${it.mimeType};base64,${it.data}", filename = it.filename) },
    )

  private fun settlementError(settlement: FlueSettlement): String =
    runCatching { settlement.error?.jsonObject?.get("message")?.jsonPrimitive?.contentOrNull }.getOrNull()
      ?: "Agent submission failed"
}
