package app.pecu

import android.app.Application
import android.graphics.Bitmap
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Surface
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.dp
import androidx.lifecycle.SavedStateHandle
import java.io.File
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
class ReceiptUiTest {
  @get:Rule val compose = createComposeRule()
  private val preview = transactionFixture().preview
  @Test fun standaloneOutcomeInChatUsesCompactReceiptButtons() = chat(false, "receipts-chat")
  @Test @Config(qualifiers = "w900dp-h750dp-night-xhdpi")
  fun unfoldedOutcome() = chat(false, "receipts-unfolded")
  @Test fun commandOutcomeIsNotRepeatedBelowItsCard() = chat(true, "receipts-deduplicated")
  private fun chat(withCard: Boolean, name: String) {
    val model = PecuViewModel(SavedStateHandle())
    val state = wireJson.decodeFromString<AccountState>(javaClass.getResource("/state.json")!!.readText())
    val original = Message("original", "Stake my WETH/USDC position", 1, reply = Reply("Review", preview))
    val outcome = Message("outcome", if (withCard) "/confirm ${preview.code}" else "Show my staking receipts", 2, reply = Reply(preview.result!!))
    compose.setContent { PecuTheme { PecuApp(model, AccountUi(ready = true, signedIn = true), ChatState(account = state.copy(messages = if (withCard) listOf(original, outcome) else listOf(outcome), olderCursor = null))) } }
    if (withCard) {
      compose.onAllNodesWithText("View transaction").assertCountEquals(2)
      compose.onNodeWithText("View transaction 1").assertDoesNotExist()
    } else {
      compose.onNodeWithText("View transaction 1").assertIsDisplayed()
      compose.onNodeWithText("View transaction 2").assertIsDisplayed()
    }
    save(name)
  }
  @Test @Config(qualifiers = "w320dp-h640dp-night-xhdpi")
  fun largeTextReceiptsOpenExactUrlAndDisclosureIsReversible() {
    val links = (1..5).map { receiptLink("https://basescan.org/tx/0x" + "$it".repeat(64))!! }
    var opened: String? = null
    compose.setContent { PecuTheme {
      val density = LocalDensity.current
      CompositionLocalProvider(LocalDensity provides Density(density.density, 1.6f)) {
        Surface { Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(20.dp)) { ReceiptLinks(links) { opened = it } } }
      }
    } }
    compose.onNodeWithText("View transaction 4").assertDoesNotExist()
    compose.onNodeWithText("Show all transactions").performScrollTo().performClick()
    compose.onNodeWithText("View transaction 5").performScrollTo().performClick()
    assertEquals(links[4].url, opened)
    save("receipts-large-text")
    compose.onNodeWithText("Show fewer transactions").performScrollTo().performClick()
    compose.onNodeWithText("View transaction 4").assertDoesNotExist()
  }
  private fun save(name: String) {
    val image = compose.onRoot().captureToImage().asAndroidBitmap()
    File("build/outputs/screenshots/$name.png").apply { parentFile!!.mkdirs() }.outputStream().use { image.compress(Bitmap.CompressFormat.PNG, 100, it) }
  }
}
