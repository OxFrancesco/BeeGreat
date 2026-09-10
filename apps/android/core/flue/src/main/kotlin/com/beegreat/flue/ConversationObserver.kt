package com.beegreat.flue

import kotlin.time.Duration.Companion.milliseconds
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.timeout
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.TimeoutCancellationException

enum class ObservationPhase {
  Loading,
  Connecting,
  Live,
  Absent,
  Error,
  Closed,
}

data class ObservationSnapshot(
  val conversation: FlueConversationState? = null,
  val offset: String? = null,
  val phase: ObservationPhase = ObservationPhase.Loading,
  val error: Throwable? = null,
)

/**
 * Observes one conversation across history catch-up and live updates. Port of
 * `createAgentConversationObservation` in `@flue/sdk`:
 *
 * - hydrate from `history()`, then follow `updates` from the snapshot offset;
 * - drop chunks at or below the last applied position (SSE redelivery);
 * - re-hydrate when a `stream-checkpoint` carries a different incarnation;
 * - declare the stream stale after 90s of silence and retry with backoff;
 * - 400 and three consecutive 401/403 are fatal, 404 means the conversation
 *   does not exist yet.
 */
class ConversationObserver(
  private val http: FlueHttp,
  private val live: LiveMode,
  private val scope: CoroutineScope,
) {
  private val _state = MutableStateFlow(ObservationSnapshot())
  val state: StateFlow<ObservationSnapshot> = _state.asStateFlow()

  private var job: Job? = null
  private var closed = false
  private var streamState: FlueConversationState? = null
  private var lastApplied: ChunkPosition? = null
  private var observedIncarnation: String? = null
  private var reconnectAttempt = 0
  private var authFailureStreak = 0

  fun start() {
    if (job != null || closed) return
    begin()
  }

  fun refresh() {
    if (closed) return
    job?.cancel()
    begin()
  }

  fun close() {
    if (closed) return
    closed = true
    job?.cancel()
    job = null
    _state.value = _state.value.copy(phase = ObservationPhase.Closed, error = null)
  }

  private fun begin() {
    reconnectAttempt = 0
    authFailureStreak = 0
    job = scope.launch { hydrateLoop() }
  }

  private suspend fun hydrateLoop() {
    while (scope.isActive) {
      _state.value = _state.value.copy(phase = if (streamState == null) ObservationPhase.Loading else ObservationPhase.Connecting, error = null)
      val history =
        try {
          http.history()
        } catch (e: CancellationException) {
          throw e
        } catch (e: Throwable) {
          if ((e as? FlueApiError)?.status == 404) {
            streamState = null
            reconnectAttempt = 0
            _state.value = ObservationSnapshot(phase = ObservationPhase.Absent)
            return
          }
          if (!scheduleRetry(e)) return
          continue
        }
      authFailureStreak = 0
      streamState = FlueConversationState.from(history)
      lastApplied = null
      observedIncarnation = history.incarnation
      _state.value = ObservationSnapshot(streamState, history.offset, ObservationPhase.Connecting)
      when (follow(history.offset)) {
        FollowOutcome.Resync -> continue
        FollowOutcome.Retry -> continue
        FollowOutcome.Stop -> return
      }
    }
  }

  private enum class FollowOutcome {
    Resync,
    Retry,
    Stop,
  }

  private suspend fun follow(offset: String): FollowOutcome {
    _state.value = _state.value.copy(phase = ObservationPhase.Live, error = null)
    var currentOffset = offset
    try {
      http.updates(currentOffset, live).timeout(STALE_STREAM_TIMEOUT_MS.milliseconds).collect { batch ->
        for (item in batch.items) {
          val chunk = http.withAttachmentUrls(parseChunk(item))
          if (chunk is Chunk.Checkpoint) {
            if (observedIncarnation != null && chunk.incarnation != observedIncarnation) throw ResyncSignal
            continue
          }
          val state = streamState ?: throw IllegalStateException("Agent conversation updates require materialized state.")
          val position = chunk.position ?: continue
          if (lastApplied?.let { position <= it } == true) continue
          streamState = state.apply(chunk)
          lastApplied = position
          _state.value = ObservationSnapshot(streamState, currentOffset, ObservationPhase.Live)
          reconnectAttempt = 0
          authFailureStreak = 0
        }
        currentOffset = batch.nextOffset
        _state.value = _state.value.copy(offset = currentOffset)
      }
      return if (scheduleRetry(IllegalStateException("Agent conversation stream ended unexpectedly."))) FollowOutcome.Retry else FollowOutcome.Stop
    } catch (e: ResyncSignal) {
      return FollowOutcome.Resync
    } catch (e: TimeoutCancellationException) {
      return if (scheduleRetry(IllegalStateException("Agent conversation stream stalled: no activity for ${STALE_STREAM_TIMEOUT_MS}ms."))) FollowOutcome.Retry else FollowOutcome.Stop
    } catch (e: CancellationException) {
      throw e
    } catch (e: Throwable) {
      return if (scheduleRetry(e)) FollowOutcome.Retry else FollowOutcome.Stop
    }
  }

  /** Publishes the error and waits out the backoff. False when the error is fatal. */
  private suspend fun scheduleRetry(error: Throwable): Boolean {
    val status = (error as? FlueApiError)?.status
    if (status == 401 || status == 403) authFailureStreak++
    if (status == 400 || authFailureStreak >= AUTH_FAILURE_LIMIT) {
      _state.value = _state.value.copy(phase = ObservationPhase.Error, error = error)
      return false
    }
    _state.value = _state.value.copy(phase = ObservationPhase.Connecting, error = error)
    delay(retryBackoffMs(reconnectAttempt++))
    return true
  }

  private object ResyncSignal : RuntimeException() {
    private fun readResolve(): Any = ResyncSignal
  }

  companion object {
    const val AUTH_FAILURE_LIMIT = 3
    const val STALE_STREAM_TIMEOUT_MS = 90_000L

    fun retryBackoffMs(attempt: Int): Long = minOf(1000L shl attempt.coerceAtMost(20), 30_000L)
  }
}
