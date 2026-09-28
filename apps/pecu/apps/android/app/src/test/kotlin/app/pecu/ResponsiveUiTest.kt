package app.pecu

import android.app.Application
import android.graphics.Bitmap
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.lifecycle.SavedStateHandle
import androidx.compose.foundation.layout.*
import androidx.compose.material3.Surface
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import java.io.File
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [36], application = Application::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class ResponsiveUiTest {
  @get:Rule val compose = createComposeRule()

  @Test @Config(qualifiers = "w412dp-h915dp-xhdpi")
  fun coverScreen() = render("cover")

  @Test @Config(qualifiers = "w900dp-h750dp-xhdpi")
  fun unfoldedScreen() = render("unfolded")

  @Test @Config(qualifiers = "w320dp-h640dp-xhdpi")
  fun smallScreen() = render("small")

  @Test @Config(qualifiers = "w412dp-h915dp-xhdpi")
  fun transactionPreviewShowsExactPersistedStep() {
    val model = PecuViewModel(SavedStateHandle())
    val state = wireJson.decodeFromString<AccountState>(javaClass.getResource("/state.json")!!.readText())
    val preview = state.messages[1].reply!!.preview!!.copy(expiresAt = System.currentTimeMillis() + 600_000)
    compose.setContent { PecuTheme { Surface { Column(Modifier.fillMaxWidth().padding(20.dp)) { PreviewCard(preview, false, model) } } } }
    save("preview")
    compose.onNodeWithText("Send 1 USDC").assertIsDisplayed()
    compose.onNodeWithText("Confirm").assertIsEnabled()
    save("preview")
  }

  @Test @Config(qualifiers = "w412dp-h915dp-night-xhdpi")
  fun darkScreen() = render("dark")

  @Test @Config(qualifiers = "w412dp-h915dp-xhdpi")
  fun coverConversation() = renderConversation("cover-chat", false)

  @Test @Config(qualifiers = "w900dp-h750dp-xhdpi")
  fun unfoldedConversation() = renderConversation("unfolded-chat", true)

  private fun renderConversation(name: String, expanded: Boolean) {
    val model = PecuViewModel(SavedStateHandle())
    val state = wireJson.decodeFromString<AccountState>(javaClass.getResource("/state.json")!!.readText())
    val message = state.messages[1]
    val preview = message.reply!!.preview!!.copy(expiresAt = System.currentTimeMillis() + 600_000)
    val account = state.copy(messages = listOf(message.copy(reply = message.reply.copy(preview = preview))), olderCursor = null)
    compose.setContent { PecuTheme { PecuApp(model, AccountUi(ready = true, signedIn = true, name = "Test account"), ChatState(account = account)) } }
    compose.onNodeWithText("Confirm").assertIsDisplayed()
    compose.onNodeWithContentDescription("Message Pecu").assertIsDisplayed()
    if (expanded) compose.onNodeWithText("New thread").assertIsDisplayed()
    save(name)
  }

  private fun render(name: String) {
    compose.setContent { PecuTheme { LoginScreen(AccountUi(ready = true), {}, motionEnabled = false) } }
    compose.onNodeWithText("Sign in to Pecu").assertIsDisplayed()
    compose.onNodeWithText("Continue with Google").assertIsDisplayed().assertIsEnabled()
    compose.onNodeWithText("Continue with X").assertIsDisplayed().assertIsEnabled()
    compose.onNodeWithContentDescription("Message Pecu").assertDoesNotExist()
    compose.onNodeWithContentDescription("Pause animation").assertDoesNotExist()
    save(name)
  }

  @Test @Config(qualifiers = "w320dp-h640dp-xhdpi")
  fun largeTextKeepsBothProvidersReachable() {
    compose.setContent {
      val density = androidx.compose.ui.platform.LocalDensity.current
      androidx.compose.runtime.CompositionLocalProvider(androidx.compose.ui.platform.LocalDensity provides androidx.compose.ui.unit.Density(density.density, 1.6f)) {
        PecuTheme { LoginScreen(AccountUi(ready = true), {}, motionEnabled = false) }
      }
    }
    compose.onNodeWithText("Continue with Google").performScrollTo().assertIsDisplayed()
    compose.onNodeWithText("Continue with X").performScrollTo().assertIsDisplayed()
    save("login-large-text")
  }

  @Test @Config(qualifiers = "w412dp-h915dp-xhdpi")
  fun signedOutAppOpensLoginWithoutAChatComposer() {
    android.provider.Settings.Global.putFloat(androidx.test.core.app.ApplicationProvider.getApplicationContext<Application>().contentResolver, android.provider.Settings.Global.ANIMATOR_DURATION_SCALE, 0f)
    val model = PecuViewModel(SavedStateHandle())
    compose.setContent { PecuTheme { PecuApp(model) } }
    compose.onNodeWithText("Sign in to Pecu").assertIsDisplayed()
    compose.onNodeWithContentDescription("Message Pecu").assertDoesNotExist()
    compose.onNodeWithContentDescription("Pause animation").assertDoesNotExist()
  }

  @Test @Config(qualifiers = "w412dp-h915dp-night-xhdpi")
  fun providerErrorRemainsReadableAndRetryable() {
    var selected: LoginProvider? = null
    val error = loginError(LoginProvider.X, listOf("form_param_value_invalid"))
    compose.setContent { PecuTheme { LoginScreen(AccountUi(ready = true, error = error), { selected = it }, motionEnabled = false) } }
    compose.onNodeWithText(error).assertIsDisplayed()
    compose.onNodeWithText("Continue with X").performClick()
    org.junit.Assert.assertEquals(LoginProvider.X, selected)
    save("login-error")
  }

  @Test @Config(qualifiers = "w320dp-h640dp-xhdpi")
  fun pendingSignInDisablesBothProviders() {
    compose.setContent { PecuTheme { LoginScreen(AccountUi(ready = true, busy = true, signingInWith = LoginProvider.X), {}, motionEnabled = false) } }
    compose.onNodeWithContentDescription("Opening X…").assertIsNotEnabled()
    compose.onNodeWithText("Continue with Google").assertIsNotEnabled()
    save("login-pending")
  }

  @Test @Config(qualifiers = "w412dp-h915dp-night-xhdpi")
  fun animatedMascotPlaysWithoutControls() {
    compose.setContent { PecuTheme { LoginScreen(AccountUi(ready = true), {}, motionEnabled = true) } }
    compose.waitUntil(10_000) { compose.onAllNodesWithTag("login-mascot-animation", useUnmergedTree = true).fetchSemanticsNodes().isNotEmpty() }
    save("login-motion")
    if (System.getProperty("pecu.recordLogin") == "true") {
      repeat(36) { index ->
        java.lang.Thread.sleep(83)
        compose.mainClock.advanceTimeBy(83)
        save("login-recording/frame-${index.toString().padStart(3, '0')}")
      }
    }
    compose.onNodeWithContentDescription("Pause animation").assertDoesNotExist()
    compose.onNodeWithContentDescription("Play animation").assertDoesNotExist()
    compose.onNodeWithText("Continue with X").assertIsDisplayed()
    save("login-playing")
  }
  @Test @Config(qualifiers = "w412dp-h915dp-night-xhdpi")
  fun positionCardsKeepExactValuesInDetails() {
    val fixture = wireJson.decodeFromString<PositionFixture>(javaClass.getResource("/positions.json")!!.readText())
    compose.setContent { PecuTheme { Surface { Column(Modifier.fillMaxSize().padding(24.dp)) { PositionCards(fixture.snapshot.positions) } } } }
    compose.onNodeWithText("≈2.004 USDC").assertIsDisplayed()
    compose.onNodeWithText("0.000641062895327367 WETH unstaked\n0 WETH staked").assertDoesNotExist()
    save("positions-cover")
    compose.onAllNodesWithText("Details")[0].performClick()
    compose.onNodeWithText("0.000641062895327367 WETH unstaked\n0 WETH staked").assertIsDisplayed()
    save("positions-details")
    compose.onNodeWithText("Hide details").performClick()
    compose.onNodeWithText("Position 77018794").assertDoesNotExist()
  }

  @Test @Config(qualifiers = "w900dp-h750dp-night-xhdpi")
  fun historicalPositionsRenderAsCardsInChat() = positionChat("positions-unfolded")

  @Test @Config(qualifiers = "w412dp-h915dp-night-xhdpi")
  fun coverPositionConversation() = positionChat("positions-chat-cover")

  private fun positionChat(name: String) {
    val fixture = wireJson.decodeFromString<PositionFixture>(javaClass.getResource("/positions.json")!!.readText())
    val model = PecuViewModel(SavedStateHandle())
    val state = wireJson.decodeFromString<AccountState>(javaClass.getResource("/state.json")!!.readText())
    val message = state.messages.first().copy(text = "Show my liquidity positions", reply = Reply(text = fixture.legacy, preview = null))
    compose.setContent { PecuTheme { PecuApp(model, AccountUi(ready = true, signedIn = true), ChatState(account = state.copy(messages = listOf(message), olderCursor = null))) } }
    compose.onNodeWithText(fixture.legacy).assertDoesNotExist()
    compose.onNodeWithText("≈0.5018 USDC").assertExists()
    save(name)
  }

  private fun save(name: String) {
    val image = compose.onRoot().captureToImage().asAndroidBitmap()
    val file = File("build/outputs/screenshots/$name.png")
    file.parentFile!!.mkdirs()
    file.outputStream().use { image.compress(Bitmap.CompressFormat.PNG, 100, it) }
  }
}
