package app.pecu

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.clerk.api.Clerk
import com.clerk.api.network.serialization.ClerkResult
import java.util.UUID
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.*
import kotlinx.serialization.encodeToString

data class ChatState(
  val thread: String? = null, val account: AccountState? = null, val draft: String = "",
  val loading: Boolean = false, val syncing: Boolean = false, val paging: Boolean = false, val error: String? = null,
  val pending: TurnRequest? = null, val retry: TurnRequest? = null,
)
data class LiveReply(val text: String = "", val stages: List<Stage> = emptyList())
data class AccountUi(val ready: Boolean = false, val signedIn: Boolean = false, val name: String = "", val image: String? = null, val busy: Boolean = false, val error: String? = null, val signingInWith: LoginProvider? = null)

data class SessionIdentity(val id: String?, val ready: Boolean = true, val name: String = "Account", val image: String? = null)

class PecuViewModel(private val saved: SavedStateHandle, private val historyDisk: HistoryDisk? = null,
  sessions: Flow<SessionIdentity>? = null, private val history: HistoryReader? = null) : ViewModel() {
  private val api by lazy { PecuApi(token = {
    when (val result = Clerk.auth.getToken()) {
      is ClerkResult.Success -> result.value
      is ClerkResult.Failure -> throw PecuException("Sign in again to reconnect to Pecu.")
    }
  }) }
  private val reader: HistoryReader get() = history ?: api
  private val _auth = MutableStateFlow(AccountUi())
  val auth = _auth.asStateFlow()
  private val _chat = MutableStateFlow(ChatState(thread = saved["thread"], draft = saved["draft"] ?: ""))
  val chat = _chat.asStateFlow()
  private val _live = MutableStateFlow(LiveReply())
  val live = _live.asStateFlow()
  private val _threads = MutableStateFlow(ThreadPage(emptyList()))
  val threads = _threads.asStateFlow()
  private val _portfolio = MutableStateFlow<Portfolio?>(null)
  val portfolio = _portfolio.asStateFlow()
  private val _inference = MutableStateFlow<Inference?>(null)
  val inference = _inference.asStateFlow()
  private val _pnl = MutableStateFlow<Analytics?>(null)
  val pnl = _pnl.asStateFlow()
  private val _panelError = MutableStateFlow<String?>(null)
  val panelError = _panelError.asStateFlow()
  private val _panelBusy = MutableStateFlow(false)
  val panelBusy = _panelBusy.asStateFlow()
  private val cache = LinkedHashMap<String?, AccountState>()
  private val cacheBytes = mutableMapOf<String?, Int>()
  private val restoredThreads = mutableSetOf<String?>()
  private val preloads = mutableMapOf<String?, Deferred<AccountState>>()
  private var warmJob: Job? = null
  private var saveJob: Job? = null
  private val drafts = mutableMapOf<String?, String>()
  private var accountId: String? = null
  private var loadJob: Job? = null
  private var sendJob: Job? = null
  private var panelJob: Job? = null
  private var threadJob: Job? = null

  init {
    viewModelScope.launch {
      (sessions ?: combine(Clerk.isInitialized, Clerk.sessionFlow, Clerk.userFlow) { initialized, session, user ->
        SessionIdentity(user?.id.takeIf { session != null }, initialized, user?.firstName ?: user?.username ?: "Account", user?.imageUrl)
      }).collect { session ->
          val id = session.id
          _auth.update { it.copy(ready = session.ready, signedIn = id != null, name = session.name, image = session.image) }
          if (id != accountId) {
            loadJob?.cancel(); sendJob?.cancel(); panelJob?.cancel(); threadJob?.cancel()
            warmJob?.cancel(); saveJob?.cancelAndJoin(); preloads.values.forEach { it.cancel() }; preloads.clear()
            accountId?.let { historyDisk?.remove(it) }; cacheBytes.clear(); restoredThreads.clear()
            cache.clear(); drafts.clear(); _live.value = LiveReply(); _portfolio.value = null; _inference.value = null; _pnl.value = null
            _threads.value = ThreadPage(emptyList()); _panelError.value = null
            val restored = saved.get<String>("owner") == id
            _chat.value = if (restored) ChatState(thread = saved["thread"], draft = saved["draft"] ?: "") else ChatState()
            saved["owner"] = id
            if (!restored) { saved["retry"] = null; saved["draft"] = ""; saved["thread"] = null }
            accountId = id
            if (id != null) {
              // Fetch fresh data concurrently; local snapshots never delay the request.
              reload(); refreshThreads()
              val snapshot = historyDisk?.read(id)
              if (snapshot != null && accountId == id) {
                snapshot.states.forEach { state ->
                  remember(state.threadId, state, restored = true, onlyIfMissing = true)
                }
                if (_threads.value.threads.isEmpty()) _threads.value = snapshot.threads
                val current = _chat.value
                val target = current.thread ?: snapshot.active
                if (current.account == null && cache.containsKey(target)) {
                  saved["thread"] = target
                  _chat.value = current.copy(thread = target, account = cache[target], loading = false, syncing = true)
                  if (target != current.thread) reload()
                }
                warmThreads()
              }
            }
          }
        }
    }
  }

  fun signIn(provider: LoginProvider) {
    if (!_auth.value.ready || _auth.value.busy) return
    val oauth = provider.resolve(Clerk.socialProviders.values)
    if (oauth == null) {
      _auth.update { it.copy(error = "${provider.label} sign-in is unavailable. Try again or use another account option.") }
      return
    }
    _auth.update { it.copy(busy = true, error = null, signingInWith = provider) }
    viewModelScope.launch {
      try {
        when (val result = Clerk.auth.signInWithOAuth(oauth)) {
          is ClerkResult.Failure -> _auth.update { it.copy(error = loginError(provider, result.error?.errors?.mapNotNull { error -> error.code }.orEmpty(), result.throwable is java.io.IOException)) }
          is ClerkResult.Success -> Unit
        }
      } catch (error: Exception) { if (error is CancellationException) throw error; _auth.update { it.copy(error = "Sign-in did not complete. Try again.") } }
      finally { _auth.update { it.copy(busy = false, signingInWith = null) } }
    }
  }
  fun signOut() { viewModelScope.launch { Clerk.auth.signOut() } }
  fun draft(value: String) { _chat.update { it.copy(draft = value.take(4000)) }; saved["draft"] = value.take(4000) }

  fun selectThread(id: String?) {
    if (_chat.value.pending != null) return
    drafts[_chat.value.thread] = _chat.value.draft
    saved["thread"] = id
    saved["draft"] = drafts[id].orEmpty()
    _chat.value = ChatState(thread = id, account = cache[id], draft = drafts[id].orEmpty(), syncing = id in restoredThreads)
    _live.value = LiveReply()
    persistHistory()
    reload()
  }
  fun newThread() {
    val id = UUID.randomUUID().toString().take(8)
    cache[id] = AccountState(wallet = _chat.value.account?.wallet, threadId = id)
    selectThread(id)
  }

  fun reload() {
    if (!_auth.value.signedIn) return
    loadJob?.cancel()
    val id = _chat.value.thread
    loadJob = viewModelScope.launch {
      _chat.update { it.copy(loading = it.account == null, error = null) }
      try {
        val result = preloads[id]?.await() ?: reader.state(id)
        if (_chat.value.thread == id) {
          restoredThreads.remove(id)
          remember(id, result)
          val recovered = saved.get<String>("retry")?.let { runCatching { wireJson.decodeFromString<TurnRequest>(it) }.getOrNull() }?.takeIf { it.threadId == id }
          val finished = recovered != null && result.messages.any { it.id.endsWith(":" + recovered.requestId) && it.reply != null }
          if (finished) saved["retry"] = null
          _chat.update { it.copy(account = result, loading = false, syncing = false, retry = if (finished) null else recovered ?: it.retry) }
        }
      } catch (error: Exception) { failure(error) }
      finally { if (_chat.value.thread == id) _chat.update { it.copy(loading = false) } }
    }
  }

  fun refreshThreads(older: Boolean = false) {
    threadJob?.cancel()
    threadJob = viewModelScope.launch {
      try {
        val page = reader.threads(if (older) _threads.value.olderCursor else null)
        _threads.value = if (older) page.copy(threads = (_threads.value.threads + page.threads).distinctBy { it.id }) else page
        persistHistory(); warmThreads()
      } catch (error: Exception) { failure(error) }
    }
  }
  fun olderMessages() {
    val current = _chat.value
    val cursor = current.account?.olderCursor ?: return
    if (current.paging || current.pending != null) return
    loadJob?.cancel()
    loadJob = viewModelScope.launch {
      _chat.update { it.copy(paging = true) }
      try {
        val page = api.messages(current.thread, cursor)
        _chat.update { it.copy(account = it.account?.copy(messages = page.messages, olderCursor = page.olderCursor, newerCursor = page.newerCursor)) }
      } catch (error: Exception) { failure(error) }
      finally { _chat.update { it.copy(paging = false) } }
    }
  }
  fun deleteThread(thread: Thread) {
    if (_chat.value.pending != null) return
    viewModelScope.launch {
      try {
        api.deleteThread(thread.id); preloads.remove(thread.id)?.cancel(); cache.remove(thread.id); cacheBytes.remove(thread.id); restoredThreads.remove(thread.id); drafts.remove(thread.id); persistHistory()
        if (_chat.value.thread == thread.id) newThread()
        refreshThreads()
      } catch (error: Exception) { failure(error) }
    }
  }

  fun send(text: String = _chat.value.draft, answerTo: String? = null, retryOf: String? = null) {
    if (text.isBlank() || text.length > 4000 || _chat.value.syncing || !_auth.value.signedIn || _chat.value.pending != null || _chat.value.account?.newerCursor != null) return
    launchTurn(TurnRequest(UUID.randomUUID().toString(), text.trim(), _chat.value.thread, retryOf = retryOf, answerTo = answerTo))
  }
  fun reviewTransfer(command: String, wallet: String?): Boolean {
    val state = _chat.value
    val account = state.account ?: return false
    if (wallet == null || account.wallet != wallet || account.signer != null || account.yolo ||
      !_auth.value.signedIn || state.syncing || state.pending != null || account.newerCursor != null) return false
    launchTurn(TurnRequest(UUID.randomUUID().toString(), command, state.thread, reviewWallet = wallet))
    return true
  }
  fun retry() { _chat.value.retry?.let(::launchTurn) }
  fun resume(message: Message) {
    val id = message.id.substringAfterLast(':')
    if (runCatching { UUID.fromString(id) }.isSuccess) launchTurn(TurnRequest(id, message.text, _chat.value.thread))
  }
  private fun launchTurn(request: TurnRequest) {
    if (_chat.value.pending != null || request.threadId != _chat.value.thread) return
    loadJob?.cancel()
    saved["retry"] = wireJson.encodeToString(request)
    _chat.update { it.copy(pending = request, retry = request, draft = if (it.draft.trim() == request.text) "" else it.draft, error = null) }
    saved["draft"] = _chat.value.draft
    _live.value = LiveReply()
    sendJob = viewModelScope.launch {
      try {
        val reducer = StreamReducer()
        api.turn(request) { event ->
          reducer.accept(event)
          _live.update { live -> live.copy(text = reducer.text, stages = event.stage?.let { stage -> live.stages.filterNot { it.id == stage.id } + stage } ?: live.stages) }
        }
        val state = api.state(request.threadId)
        remember(request.threadId, state)
        _chat.update { it.copy(account = state, retry = null) }
        saved["retry"] = null
      } catch (error: Exception) {
        failure(error)
        try { val recovered = api.state(request.threadId); _chat.update { it.copy(account = recovered) } }
        catch (recoveryError: Exception) { if (recoveryError is CancellationException) throw recoveryError }
      } finally {
        _chat.update { it.copy(pending = null) }
        refreshThreads()
      }
    }
  }

  fun loadPortfolio(tokens: List<String> = listOf("ETH", "USDC", "AERO")) = panel { _portfolio.value = api.portfolio(tokens) }
  fun loadInference() = panel { _inference.value = api.inference() }
  fun loadPnl(days: Int) = panel {
    require(days in listOf(7, 30, 90, 365))
    val data = wireJson.parseToJsonElement(api.get("pnl", listOf("days" to days.toString())))
    val snapshot = (data as? kotlinx.serialization.json.JsonObject)?.get("snapshot") as? kotlinx.serialization.json.JsonObject
    _pnl.value = snapshot?.let { Analytics(it, "") }
  }
  fun connect(connect: Boolean) = panel { _inference.value = api.connect(connect) }
  private fun panel(block: suspend () -> Unit) {
    panelJob?.cancel()
    panelJob = viewModelScope.launch {
      _panelBusy.value = true; _panelError.value = null
      try { block() }
      catch (error: Exception) { if (error is CancellationException) throw error; _panelError.value = error.message ?: "Could not load this page. Try again." }
      finally { _panelBusy.value = false }
    }
  }
  private fun warmThreads() {
    if (warmJob?.isActive == true) return
    val owner = accountId ?: return
    val ids = _threads.value.threads.take(8).map { it.id }.filter { it != _chat.value.thread && !cache.containsKey(it) }
    warmJob = viewModelScope.launch {
      for (batch in ids.chunked(2)) {
        if (accountId != owner) break
        supervisorScope {
          batch.map { id ->
            val deferred = async { reader.state(id) }
            preloads[id] = deferred
            launch {
              try {
                val state = deferred.await()
                if (accountId == owner) remember(id, state, onlyIfMissing = true)
              } catch (error: Exception) { if (error is CancellationException) throw error }
              finally { if (preloads[id] === deferred) preloads.remove(id) }
            }
          }.joinAll()
        }
      }
    }
  }
  private fun persistHistory() {
    val owner = accountId ?: return
    val store = historyDisk ?: return
    saveJob?.cancel()
    saveJob = viewModelScope.launch {
      delay(250)
      val states = cache.values.filter { it.threadId != _chat.value.pending?.threadId || _chat.value.pending == null }.toList()
      store.write(owner, _threads.value, states, _chat.value.thread)
    }
  }
  private suspend fun remember(id: String?, state: AccountState, restored: Boolean = false, onlyIfMissing: Boolean = false) {
    val bytes = withContext(Dispatchers.Default) { wireJson.encodeToString(state).toByteArray().size }
    if (onlyIfMissing && cache.containsKey(id)) return
    if (restored) restoredThreads.add(id) else restoredThreads.remove(id)
    cache.remove(id); cache[id] = state; cacheBytes[id] = bytes
    while (cache.size > 12 || cacheBytes.values.sum() > 4 * 1024 * 1024) {
      val victim = cache.entries.firstOrNull { it.key != _chat.value.thread } ?: break
      cache.remove(victim.key); cacheBytes.remove(victim.key); restoredThreads.remove(victim.key)
    }
    persistHistory()
  }
  private fun failure(error: Exception) {
    if (error is CancellationException) throw error
    _chat.update { it.copy(error = if (error is PecuException) error.message else "The connection to Pecu dropped. Check for a reply, or retry the same request.") }
  }
}
