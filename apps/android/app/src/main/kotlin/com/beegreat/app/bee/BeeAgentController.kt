package com.beegreat.app.bee

import android.util.Log
import com.beegreat.app.BuildConfig
import com.beegreat.contract.ChatMessageSyncEnvelope
import com.beegreat.contract.StoredChatMessage
import com.beegreat.contract.TranscriptSyncQueue
import com.beegreat.contract.TranscriptTooLargeException
import com.beegreat.contract.isFirstFocusConfirmation
import com.beegreat.contract.isHighlightCompletion
import com.beegreat.contract.mergeConvexMessages
import com.beegreat.convex.chat.ChatMessagesPage
import com.beegreat.convex.chat.ChatRepository
import com.beegreat.convex.chat.SyncEnvelope
import com.beegreat.convex.focus.ActiveHighlight
import com.beegreat.convex.focus.FirstFocusRepository
import com.beegreat.convex.user.UserRepository
import com.beegreat.flue.AgentSession
import com.beegreat.flue.AgentStatus
import com.beegreat.flue.DeliveredAttachment
import com.beegreat.flue.FlueApiError
import com.beegreat.flue.FlueHttp
import com.beegreat.flue.FlueMessage
import com.beegreat.flue.LiveMode
import com.clerk.api.Clerk
import com.clerk.api.network.serialization.ClerkResult
import dev.convex.android.ConvexError
import java.util.TimeZone
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.filterNotNull
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.flow.launchIn
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.onEach
import kotlinx.coroutines.launch
import okhttp3.OkHttpClient

const val BEE_AGENT_NAME = "bee"
private const val CHAT_HISTORY_PAGE_SIZE = 100

data class BeeAgentState(
  val thread: Long = 0,
  val messages: List<FlueMessage> = emptyList(),
  val status: AgentStatus = AgentStatus.Idle,
  val historyReady: Boolean = false,
  val errorMessage: String? = null,
  val canLoadOlder: Boolean = false,
  val loadingOlder: Boolean = false,
) {
  val busy: Boolean
    get() = status == AgentStatus.Submitted || status == AgentStatus.Streaming
}

/**
 * The Bee conversation for the signed-in user. Port of `useVoiceAgent` minus
 * audio (Phase 5): one Flue session per active thread, the transcript
 * mirrored into Convex, thread titling, slash commands, first-focus and
 * highlight commands that take the authenticated Convex path instead of a
 * second agent interpretation. Lives in [com.beegreat.app.AppContainer] so it
 * survives tab switches.
 */
class BeeAgentController(
  private val chat: ChatRepository,
  private val firstFocus: FirstFocusRepository,
  private val user: UserRepository,
  private val http: OkHttpClient,
  private val scope: CoroutineScope,
  private val agentUrl: String = BuildConfig.AGENT_URL,
  private val liveMode: LiveMode = LiveMode.Sse,
) {
  private val _state = MutableStateFlow(BeeAgentState())
  val state: StateFlow<BeeAgentState> = _state.asStateFlow()

  private val _voiceError = MutableStateFlow<String?>(null)

  /** Set by the voice layer; shown in place of transport errors. */
  val voiceError: MutableStateFlow<String?> = _voiceError

  private var userId: String? = null
  private var thread = 0L
  private var session: AgentSession? = null
  private var sessionScope: CoroutineScope? = null
  private var syncQueue: TranscriptSyncQueue? = null
  private var activeHighlight: ActiveHighlight? = null
  private var titledThread: Long? = null
  private var reconnectAttempts = 0
  private var reconnectJob: Job? = null
  private val pageCursors = MutableStateFlow<List<String?>>(listOf(null))
  private var latestContinueCursor: String? = null
  private var pendingFirstFocus: (suspend () -> Boolean)? = null
  private var confirmingFirstFocus = false

  private var started = false

  fun start() {
    if (started) return
    started = true
    combine(Clerk.userFlow.map { it?.id }.distinctUntilChanged(), chat.activeThread().map { it.getOrNull() ?: 0L }.distinctUntilChanged()) { id, active -> id to active }
      .distinctUntilChanged()
      .onEach { (id, active) -> openConversation(id, active) }
      .launchIn(scope)
    firstFocus.current().onEach { activeHighlight = it.getOrNull()?.activeHighlight }.launchIn(scope)
    Clerk.userFlow.map { it?.id }.filterNotNull().distinctUntilChanged()
      .onEach { runCatching { user.syncTimeZone(TimeZone.getDefault().id) } }
      .launchIn(scope)
  }

  /** The newest first-focus preview card registers the exact mutation it would run on tap. */
  fun registerPendingFirstFocus(confirm: suspend () -> Boolean): () -> Unit {
    pendingFirstFocus = confirm
    return { if (pendingFirstFocus === confirm) pendingFirstFocus = null }
  }

  private fun openConversation(id: String?, active: Long) {
    closeSession()
    userId = id
    thread = active
    titledThread = null
    pageCursors.value = listOf(null)
    _state.value = BeeAgentState(thread = active)
    if (id == null) return
    // Thread 0 keeps the original `userId` conversation; later threads append
    // `~N` and the agent strips it to recover the user id.
    val conversationId = if (active > 0L) "$id~$active" else id
    val newScope = CoroutineScope(SupervisorJob() + scope.coroutineContext.minusKey(Job))
    sessionScope = newScope
    val flue = FlueHttp("$agentUrl/agents/$BEE_AGENT_NAME/$conversationId", ::authHeaders, http)
    val newSession = AgentSession(flue, liveMode, newScope)
    session = newSession
    val queue = TranscriptSyncQueue(newScope, { batch -> persist(active, batch) }) { Log.w(TAG, "chat.sync_delta", it) }
    syncQueue = queue
    newSession.start()

    newSession.state.onEach { queue.enqueue(it.messages) }.launchIn(newScope)

    combine(newSession.state, storedRows(active), pageCursors) { agent, pages, cursors ->
        val rows = pages.filterNotNull().flatMap { it.page }.asReversed().map { StoredChatMessage(it.id, it.contentJson, it.createdAt, it.hidden ?: false) }
        val lastPage = pages.lastOrNull()
        latestContinueCursor = lastPage?.continueCursor
        val merged = mergeConvexMessages(rows, agent.messages)
        BeeAgentState(
          thread = active,
          messages = merged,
          status = agent.status,
          historyReady = agent.historyReady,
          errorMessage = friendlyErrorMessage(agent.error),
          canLoadOlder = lastPage != null && !lastPage.isDone,
          loadingOlder = pages.size < cursors.size,
        )
      }
      .combine(_voiceError) { agentState, voice -> if (voice != null) agentState.copy(errorMessage = voice) else agentState }
      .onEach { next ->
        _state.value = next
        titleThreadIfNeeded(active, next.messages)
        watchAuthHiccup()
      }
      .launchIn(newScope)
  }

  /** One subscription per loaded page, combined newest page first like `usePaginatedQuery`. */
  @OptIn(ExperimentalCoroutinesApi::class)
  private fun storedRows(threadId: Long) =
    pageCursors.flatMapLatest { cursors ->
      val flows = cursors.map { cursor -> chat.messagesPage(threadId, CHAT_HISTORY_PAGE_SIZE, cursor).map { it.getOrNull() } }
      if (flows.isEmpty()) flowOf(emptyList()) else combine(flows) { it.toList() }
    }

  fun loadOlder() {
    val pages = pageCursors.value
    val last = _state.value
    if (!last.canLoadOlder || last.loadingOlder) return
    // The cursor for the next page is the last loaded page's continueCursor.
    val lastCursor = latestContinueCursor ?: return
    if (lastCursor in pages) return
    pageCursors.value = pages + lastCursor
  }

  private fun closeSession() {
    reconnectJob?.cancel()
    reconnectJob = null
    session?.close()
    session = null
    syncQueue?.dispose()
    syncQueue = null
    sessionScope?.cancel()
    sessionScope = null
  }

  private suspend fun persist(threadId: Long, batch: List<ChatMessageSyncEnvelope>) {
    try {
      chat.syncMessages(threadId, batch.map { SyncEnvelope(it.id, it.role, it.contentJson, it.createdAt) })
    } catch (e: ConvexError) {
      if (e.data.contains("TOO_LARGE")) throw TranscriptTooLargeException(e)
      throw e
    }
  }

  private fun titleThreadIfNeeded(threadId: Long, messages: List<FlueMessage>) {
    if (titledThread == threadId) return
    val first = messages.firstOrNull { it.isUser } ?: return
    val text = first.parts.filterIsInstance<com.beegreat.flue.FluePart.Text>().joinToString(" ") { it.text }
    if (text.isBlank()) return
    titledThread = threadId
    scope.launch { runCatching { chat.setThreadTitle(threadId, text.take(64)) } }
  }

  /**
   * The observer treats three 401s as fatal, but right after launch or resume
   * Clerk's token can lag. Swap in a fresh session with backoff.
   */
  private fun watchAuthHiccup() {
    val error = session?.state?.value?.error
    if (!isAuthHiccup(error)) {
      if (error == null) reconnectAttempts = 0
      return
    }
    if (reconnectJob?.isActive == true) return
    val delayMs = minOf(1500L shl reconnectAttempts.coerceAtMost(10), 15_000L)
    reconnectAttempts++
    reconnectJob = scope.launch {
      delay(delayMs)
      openConversation(userId, thread)
    }
  }

  suspend fun resetConversation() {
    _voiceError.value = null
    chat.createThread()
  }

  suspend fun sendText(text: String) {
    val command = text.trim().lowercase()
    if (command == "/clear" || command == "/new") {
      resetConversation()
      return
    }
    _voiceError.value = null
    val current = session ?: return
    if (isFirstFocusConfirmation(text)) {
      when (confirmPendingFirstFocus()) {
        PendingConfirmation.Confirmed -> {
          current.sendMessage(
            "[BeeGreat app event] The first-focus plan was confirmed and persisted successfully. Acknowledge it; do not create or mutate the plan again."
          )
          return
        }
        PendingConfirmation.Failed -> return
        PendingConfirmation.None -> Unit
      }
    }
    val highlight = activeHighlight
    if (isHighlightCompletion(text) && highlight != null) {
      try {
        val result = firstFocus.completeHighlight("complete-highlight:${highlight.highlightId}", highlight.taskId)
        current.sendMessage(
          "[BeeGreat app event] Highlight \"${highlight.title}\" was completed successfully. The verified award was ${result.honeyAwarded.toLong()} Honey and ${result.scoreAwarded.toLong()} Honeycomb Score. Acknowledge this completion and reward only; do not call a completion tool or create, update, or mutate any data again."
        )
      } catch (e: Exception) {
        Log.w(TAG, "highlight.complete", e)
        _voiceError.value = e.message ?: "This Highlight could not be completed."
      }
      return
    }
    try {
      current.sendMessage(text)
    } catch (e: Exception) {
      Log.w(TAG, "agent.send_message", e)
      _voiceError.value = "Your message wasn’t sent. Check your connection and try again."
      throw e
    }
  }

  suspend fun sendImages(text: String, images: List<DeliveredAttachment>) {
    val current = session ?: return
    _voiceError.value = null
    current.sendMessage(text, images)
  }

  /** Tombstones the last turn in Convex and re-submits its text as a fresh turn. */
  suspend fun retryLastReply() {
    val snapshot = _state.value
    if (snapshot.busy) return
    val messages = snapshot.messages
    val lastUserIndex = messages.indexOfLast { it.isUser }
    if (lastUserIndex < 0) return
    val retried = messages[lastUserIndex].text
    if (retried.isBlank()) return
    val ids =
      messages.drop(lastUserIndex).flatMap { message ->
        buildList {
          add(message.id)
          if (message.isUser && message.submissionId != null) add("submission:${message.submissionId}")
        }
      }
    try {
      chat.hideMessages(snapshot.thread, ids)
      sendText(retried)
    } catch (e: Exception) {
      Log.w(TAG, "chat.retry", e)
      _voiceError.value = "The retry didn’t go through. Check your connection and try again."
    }
  }

  enum class PendingConfirmation {
    Confirmed,
    Failed,
    None,
  }

  private suspend fun confirmPendingFirstFocus(): PendingConfirmation {
    val confirm = pendingFirstFocus ?: return PendingConfirmation.None
    if (confirmingFirstFocus) return PendingConfirmation.None
    confirmingFirstFocus = true
    return try {
      if (confirm()) PendingConfirmation.Confirmed else PendingConfirmation.Failed
    } finally {
      confirmingFirstFocus = false
    }
  }

  /** Clerk's session can be briefly unavailable after launch; wait instead of sending a 401-bound request. */
  suspend fun authHeaders(): Map<String, String> {
    repeat(10) {
      val result = runCatching { Clerk.auth.getToken() }.getOrNull()
      if (result is ClerkResult.Success) return mapOf("authorization" to "Bearer ${result.value}")
      delay(500)
    }
    return emptyMap()
  }

  private fun isAuthHiccup(error: Throwable?): Boolean =
    error != null && ((error as? FlueApiError)?.status == 401 || Regex("401|sign in", RegexOption.IGNORE_CASE).containsMatchIn(error.message ?: ""))

  private fun friendlyErrorMessage(error: Throwable?): String? {
    if (error == null) return null
    if (isAuthHiccup(error)) return "Reconnecting to Bee…"
    if (error is FlueApiError || error is java.io.IOException) return "Bee couldn’t reach the hive — check your connection."
    return error.message
  }

  private companion object {
    const val TAG = "BeeGreat"
  }
}
