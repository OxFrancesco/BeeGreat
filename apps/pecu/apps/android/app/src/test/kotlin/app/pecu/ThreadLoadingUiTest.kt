package app.pecu

import android.app.Application
import android.graphics.Bitmap
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.viewModelScope
import java.io.File
import java.nio.file.Files
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.MutableStateFlow
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [36], application = Application::class, qualifiers = "w412dp-h915dp-night-xhdpi")
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class ThreadLoadingUiTest {
  @get:Rule val compose = createComposeRule()
  @Test fun restoredMessagesAndThreadSwitchRenderWithNetworkResponsesHeld() {
    val directory = Files.createTempDirectory("pecu-native-history-ui").toFile()
    val disk = HistoryDisk(directory)
    val states = listOf(null, "thread-a").map { id -> AccountState(threadId = id, wallet = "0x" + "1".repeat(40), messages = listOf(
      Message(id ?: "default", if (id == null) "Show my recent activity" else "Explain liquidity pools", 1,
        reply = Reply(if (id == null) "Your saved conversation is ready." else "A liquidity pool holds tokens that people can trade against.")))) }
    runBlocking { disk.write("fixture-user", ThreadPage(emptyList()), states) }
    val response = CompletableDeferred<AccountState>()
    val reader = object : HistoryReader {
      override suspend fun state(thread: String?) = response.await()
      override suspend fun threads(before: ThreadCursor?) = ThreadPage(emptyList())
    }
    val model = PecuViewModel(SavedStateHandle(), disk, MutableStateFlow(SessionIdentity("fixture-user")), reader)
    try {
      compose.setContent { PecuTheme { PecuApp(model) } }
      compose.waitUntil(10_000) { model.chat.value.account != null }
      compose.waitUntil(10_000) { compose.onAllNodesWithText("Your saved conversation is ready.").fetchSemanticsNodes().isNotEmpty() }
      compose.onNodeWithText("Your saved conversation is ready.").assertIsDisplayed()
      assertFalse(response.isCompleted)
      assertFalse(model.chat.value.loading)
      compose.runOnIdle { model.selectThread("thread-a") }
      compose.onNodeWithText("Explain liquidity pools").assertIsDisplayed()
      compose.waitUntil(10_000) { compose.onAllNodesWithText("A liquidity pool holds tokens that people can trade against.").fetchSemanticsNodes().isNotEmpty() }
      compose.onNodeWithText("A liquidity pool holds tokens that people can trade against.").assertIsDisplayed()
      assertFalse(response.isCompleted)
      val image = compose.onRoot().captureToImage().asAndroidBitmap()
      File("build/outputs/screenshots/thread-restored.png").apply { parentFile!!.mkdirs() }.outputStream().use { image.compress(Bitmap.CompressFormat.PNG, 100, it) }
    } finally { model.viewModelScope.cancel(); directory.deleteRecursively() }
  }
}
