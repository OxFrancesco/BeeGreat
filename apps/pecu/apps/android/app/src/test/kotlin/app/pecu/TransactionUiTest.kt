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
class TransactionUiTest {
  @get:Rule val compose = createComposeRule()
  private val fixture = transactionFixture()
  private fun render(preview: Preview = fixture.preview, largeText: Boolean = false, onSend: (String) -> Unit = {}) {
    compose.setContent { PecuTheme {
      val density = LocalDensity.current
      CompositionLocalProvider(LocalDensity provides Density(density.density, if (largeText) 1.6f else density.fontScale)) {
        Surface { Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(20.dp)) { TransactionCard(preview, false, onSend) } }
      }
    } }
  }
  @Test fun completedStakeFitsAndDetailsAreReversible() {
    render()
    compose.onNodeWithText("CL100-WETH/USDC").assertIsDisplayed()
    compose.onNodeWithText("Transaction details").assertIsDisplayed()
    compose.onNodeWithText("77018794").assertDoesNotExist()
    compose.onAllNodesWithText("View transaction").assertCountEquals(2)
    compose.onNodeWithText("Confirm").assertDoesNotExist()
    save("transaction-cover")
    compose.onNodeWithText("Transaction details").performClick()
    compose.onNodeWithText("77018794").assertExists()
    compose.onNodeWithText("Hide details").performClick()
    compose.onNodeWithText("77018794").assertDoesNotExist()
  }
  @Test @Config(qualifiers = "w900dp-h750dp-night-xhdpi")
  fun unfoldedStake() { render(); save("transaction-unfolded") }
  @Test @Config(qualifiers = "w320dp-h640dp-night-xhdpi")
  fun largeTextCanReachDetails() {
    render(largeText = true)
    compose.onNodeWithText("Transaction details").performScrollTo().performClick()
    compose.onNodeWithText("77018794").performScrollTo().assertIsDisplayed()
    save("transaction-large-text")
  }
  @Test fun partialFailurePreservesRecoveryAndReceipts() {
    val steps = fixture.preview.plan!!.steps
    render(fixture.preview.copy(state = "failed", plan = Plan(listOf(steps[0], steps[1].copy(status = "failed", hash = null))), result = "Approval confirmed.\nStake failed. Check the transaction before retrying."))
    compose.onNodeWithText("Confirmed · Permission only").assertExists()
    compose.onNodeWithText("Failed").assertExists()
    compose.onNodeWithText("Stake failed. Check the transaction before retrying.", substring = true).assertExists()
    compose.onNodeWithText("Confirm").assertDoesNotExist()
    save("transaction-failure")
  }
  @Test fun pendingExactAmountAndCommandsArePreserved() {
    val commands = mutableListOf<String>()
    val preview = fixture.preview.copy(state = "pending", title = "Send", result = null, plan = null, text = "Send 0.000000000000000001 ETH to 0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\nWarning: Review the recipient.\nNetwork fee: not estimated yet.")
    render(preview, onSend = { commands.add(it) })
    compose.onNodeWithText("0.000000000000000001 ETH").assertIsDisplayed()
    compose.onNodeWithText("0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa").assertIsDisplayed()
    compose.onNodeWithText("Confirm").performClick()
    compose.onNodeWithText("Cancel").performClick()
    assertEquals(listOf("/confirm TEST12", "/cancel TEST12"), commands)
    save("transaction-review")
  }
  @Test fun completedStakeInChat() {
    val model = PecuViewModel(androidx.lifecycle.SavedStateHandle())
    val state = wireJson.decodeFromString<AccountState>(javaClass.getResource("/state.json")!!.readText())
    val message = state.messages.first().copy(text = "Stake my WETH/USDC position", reply = Reply(text = fixture.preview.result.orEmpty(), preview = fixture.preview))
    compose.setContent { PecuTheme { PecuApp(model, AccountUi(ready = true, signedIn = true), ChatState(account = state.copy(messages = listOf(message), olderCursor = null))) } }
    compose.onNodeWithText("CL100-WETH/USDC").assertIsDisplayed()
    compose.onNodeWithText("Transaction details").assertIsDisplayed()
    save("transaction-chat")
  }
  @Test fun executingOnlyChecksExistingPlan() {
    val commands = mutableListOf<String>()
    val plan = fixture.preview.plan!!
    render(fixture.preview.copy(state = "executing", result = null, plan = Plan(listOf(plan.steps[0], plan.steps[1].copy(status = "submitted")))), onSend = { commands.add(it) })
    compose.onNodeWithText("Waiting for receipt").assertExists()
    compose.onNodeWithText("Cancel").assertDoesNotExist()
    compose.onNodeWithText("Check status").performClick()
    assertEquals(listOf("/confirm TEST12"), commands)
    save("transaction-executing")
  }
  @Test fun locallyExpiredPreviewCannotExecute() {
    render(fixture.preview.copy(state = "pending", result = null, expiresAt = 1))
    compose.onNodeWithText("Expired without confirmation").assertExists()
    compose.onNodeWithText("Confirm").assertDoesNotExist()
    compose.onNodeWithText("Cancel").assertDoesNotExist()
  }
  private fun save(name: String) {
    val image = compose.onRoot().captureToImage().asAndroidBitmap()
    File("build/outputs/screenshots/$name.png").apply { parentFile!!.mkdirs() }.outputStream().use { image.compress(Bitmap.CompressFormat.PNG, 100, it) }
  }
}
