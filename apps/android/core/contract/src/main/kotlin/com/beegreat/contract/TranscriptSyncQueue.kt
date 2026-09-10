package com.beegreat.contract

import com.beegreat.flue.FlueMessage
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

/** Thrown by [TranscriptSyncQueue.SyncBatch] when Convex rejects a batch as too large. */
class TranscriptTooLargeException(cause: Throwable? = null) : RuntimeException("TOO_LARGE", cause)

/**
 * Debounces live envelopes and serializes Convex writes without losing a
 * newer delta. Port of `packages/chat-sync/src/transcript-sync-queue.ts`.
 */
class TranscriptSyncQueue(
  private val scope: CoroutineScope,
  private val syncBatch: suspend (List<ChatMessageSyncEnvelope>) -> Unit,
  private val reportError: (Throwable) -> Unit,
) {
  private val lock = Mutex()
  private val sent = HashMap<String, String>()
  private val pending = LinkedHashMap<String, ChatMessageSyncEnvelope>()
  private val inFlight = LinkedHashMap<String, ChatMessageSyncEnvelope>()
  private var timer: Job? = null
  private var flushing = false
  private var retryCount = 0
  private var disposed = false

  fun enqueue(messages: List<FlueMessage>) {
    scope.launch {
      lock.withLock {
        if (disposed) return@withLock
        val known = HashMap(sent)
        for (message in inFlight.values) known[message.id] = message.contentJson
        for (message in pending.values) known[message.id] = message.contentJson
        for (message in changedMessagesForConvexSync(messages, known)) pending[message.id] = message
        schedule()
      }
    }
  }

  fun dispose() {
    disposed = true
    timer?.cancel()
    timer = null
  }

  private fun schedule(delayMs: Long = SYNC_DEBOUNCE_MS) {
    if (disposed || flushing || timer != null || pending.isEmpty()) return
    timer =
      scope.launch {
        delay(delayMs)
        lock.withLock { timer = null }
        flush()
      }
  }

  private suspend fun flush() {
    val batch =
      lock.withLock {
        if (disposed || flushing || pending.isEmpty()) return
        flushing = true
        val batch = pending.values.toList()
        pending.clear()
        for (message in batch) inFlight[message.id] = message
        batch
      }
    var retryDelay = SYNC_DEBOUNCE_MS
    try {
      for (offset in batch.indices step SYNC_BATCH_SIZE) {
        persistChunk(batch.subList(offset, minOf(offset + SYNC_BATCH_SIZE, batch.size)))
      }
      lock.withLock { retryCount = 0 }
    } catch (error: Throwable) {
      lock.withLock {
        if (!disposed) {
          for (message in inFlight.values) pending.putIfAbsent(message.id, message)
          inFlight.clear()
          val shouldReport = retryCount == 0
          retryDelay = minOf(1_000L shl retryCount.coerceAtMost(20), SYNC_RETRY_MAX_MS)
          retryCount += 1
          if (shouldReport) reportError(error)
        }
      }
    } finally {
      lock.withLock {
        flushing = false
        schedule(retryDelay)
      }
    }
  }

  private suspend fun markHandled(messages: List<ChatMessageSyncEnvelope>) =
    lock.withLock {
      for (message in messages) {
        sent[message.id] = message.contentJson
        inFlight.remove(message.id)
      }
    }

  private suspend fun persistChunk(messages: List<ChatMessageSyncEnvelope>) {
    try {
      syncBatch(messages)
      markHandled(messages)
    } catch (error: TranscriptTooLargeException) {
      if (messages.size > 1) {
        val middle = (messages.size + 1) / 2
        persistChunk(messages.subList(0, middle))
        persistChunk(messages.subList(middle, messages.size))
        return
      }
      // A deterministic rejection must not poison every later delta.
      markHandled(messages)
      reportError(error)
    }
  }

  private companion object {
    const val SYNC_DEBOUNCE_MS = 120L
    const val SYNC_RETRY_MAX_MS = 15_000L
    const val SYNC_BATCH_SIZE = 200
  }
}
