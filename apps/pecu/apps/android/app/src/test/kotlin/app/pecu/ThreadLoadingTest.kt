package app.pecu

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.viewModelScope
import java.io.File
import java.nio.file.Files
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.test.*
import org.junit.Assert.*
import org.junit.After
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class ThreadLoadingTest {
  private val models = mutableListOf<PecuViewModel>()
  private val dispatcher = StandardTestDispatcher()
  private lateinit var directory: File
  @Before fun setup() { Dispatchers.setMain(dispatcher); directory = Files.createTempDirectory("pecu-history-test").toFile() }
  @After fun cleanup() { models.forEach { it.viewModelScope.cancel() }; dispatcher.scheduler.runCurrent(); Dispatchers.resetMain(); directory.deleteRecursively() }
  private fun state(id: String?) = AccountState(threadId = id, wallet = "0x" + "1".repeat(40), messages = listOf(Message(id ?: "default", "Question", 1, reply = Reply("Answer"))))
  private class Reader : HistoryReader {
    val requests = mutableMapOf<String?, CompletableDeferred<AccountState>>()
    override suspend fun state(thread: String?): AccountState = requests.getOrPut(thread) { CompletableDeferred() }.await()
    override suspend fun threads(before: ThreadCursor?) = ThreadPage((1..20).map { Thread("thread-$it", "Thread $it", 1, 1, 1) })
  }
  @Test fun recentThreadsWarmTwoAtATimeBeforeSelectionAndDoNotBlockTheSelectedRead() = runTest(dispatcher) {
    val reader = Reader()
    val model = PecuViewModel(SavedStateHandle(), sessions = MutableStateFlow(SessionIdentity("alice")), history = reader).also { models += it }
    runCurrent()
    assertEquals(setOf(null, "thread-1", "thread-2"), reader.requests.keys)
    reader.requests["thread-1"]!!.complete(state("thread-1"))
    reader.requests["thread-2"]!!.complete(state("thread-2"))
    withContext(Dispatchers.Default) { delay(30) }; runCurrent()
    model.selectThread("thread-1"); runCurrent()
    assertNotNull(model.chat.value.account)
    assertEquals("thread-1", model.chat.value.account?.messages?.first()?.id)
    assertFalse(model.chat.value.loading)
    assertTrue(reader.requests.size <= 5)
  }
  @Test fun restartReadsAccountScopedHistoryWhileTheNetworkIsStillPending() = runTest(dispatcher) {
    val disk = HistoryDisk(directory)
    disk.write("alice", ThreadPage(listOf(Thread(null, "First", 1, 1, 1))), listOf(state(null)))
    val reader = Reader()
    val sessions = MutableStateFlow(SessionIdentity("alice"))
    val model = PecuViewModel(SavedStateHandle(), disk, sessions, reader).also { models += it }
    repeat(10) { runCurrent(); withContext(Dispatchers.Default) { delay(10) } }
    assertEquals("default", model.chat.value.account?.messages?.first()?.id)
    assertFalse(model.chat.value.loading)
    assertTrue(model.chat.value.syncing)
    model.send("/confirm ABC123")
    assertNull(model.chat.value.pending)
    reader.requests[null]!!.complete(state(null))
    repeat(10) { runCurrent(); withContext(Dispatchers.Default) { delay(10) } }
    assertFalse(model.chat.value.syncing)
    reader.requests.clear()
    sessions.value = SessionIdentity("bob")
    repeat(10) { runCurrent(); withContext(Dispatchers.Default) { delay(10) } }
    assertNull(disk.read("alice"))
    assertTrue(disk.read("bob")?.states.isNullOrEmpty())
  }
  @Test fun diskBoundsHistoriesAndDoesNotReturnAnotherOwnersData() = runTest {
    val disk = HistoryDisk(directory)
    disk.write("alice", ThreadPage(emptyList()), (1..30).map { state("thread-$it") })
    assertEquals(12, disk.read("alice")?.states?.size)
    assertNull(disk.read("bob"))
    disk.remove("alice")
    assertNull(disk.read("alice"))
  }
}
