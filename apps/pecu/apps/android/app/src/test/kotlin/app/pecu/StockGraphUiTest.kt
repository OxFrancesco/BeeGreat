package app.pecu

import android.app.Application
import android.graphics.Bitmap
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.foundation.layout.*
import androidx.compose.material3.Surface
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.dp
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.lifecycle.SavedStateHandle
import java.io.File
import kotlinx.serialization.Serializable
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode

@Serializable data class LegacyStocksFixture(val text: String, val createdAt: Long)

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [36], application = Application::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class StockGraphUiTest {
  @get:Rule val compose = createComposeRule()
  private val fixture = wireJson.decodeFromString<LegacyStocksFixture>(javaClass.getResource("/legacy-stocks.json")!!.readText())

  @Test @Config(qualifiers = "w412dp-h915dp-night-xhdpi")
  fun historicalStockReplyRendersGraphByDefault() = renderChat("stocks-chat-cover")

  @Test @Config(qualifiers = "w900dp-h750dp-night-xhdpi")
  fun unfoldedHistoricalStocks() = renderChat("stocks-chat-unfolded")

  private fun renderChat(name: String) {
    val model = PecuViewModel(SavedStateHandle())
    val state = wireJson.decodeFromString<AccountState>(javaClass.getResource("/state.json")!!.readText())
    val message = Message("old-stocks", "/aero stocks", fixture.createdAt, reply = Reply(fixture.text))
    compose.setContent { PecuTheme { PecuApp(model, AccountUi(ready = true, signedIn = true), ChatState(account = state.copy(messages = listOf(message), olderCursor = null))) } }
    save(name)
    record(name, 0)
    compose.onNodeWithTag("stock-allocation-chart").assertIsDisplayed()
    compose.onNodeWithText(fixture.text).assertDoesNotExist()
    compose.onNodeWithText("Graph").assertIsSelected()
    compose.onNodeWithText("List").performClick()
    compose.onNodeWithTag("stock-allocation-chart").assertDoesNotExist()
    compose.onNodeWithText("0.00004267 shares").assertIsDisplayed()
    save("$name-list")
    record(name, 16)
    compose.onNodeWithText("Graph").performClick()
    compose.onNodeWithTag("stock-allocation-chart").assertIsDisplayed()
    record(name, 32)

  }

  @Test @Config(qualifiers = "w320dp-h640dp-night-xhdpi")
  fun structuredHoldingsAndLargeTextKeepBothViewsReachable() {
    val stocks = listOf(Stock("NVDAc", "NVIDIA", "0x0000000000000000000000000000000000000001", "100", "2"), Stock("AAPLc", "Apple", "0x0000000000000000000000000000000000000002", "100", "1"))
    compose.setContent {
      val density = LocalDensity.current
      CompositionLocalProvider(LocalDensity provides Density(density.density, 1.6f)) {
        PecuTheme { Surface { Column(Modifier.fillMaxSize().padding(12.dp)) { HoldingsView(Holdings(stocks, fixture.createdAt)) } } }
      }
    }
    compose.onNodeWithTag("stock-allocation-chart").assertIsDisplayed()
    compose.onNodeWithText("Graph").assertIsDisplayed()
    compose.onNodeWithText("List").assertIsDisplayed().performClick()
    compose.onNodeWithText("2 shares").assertIsDisplayed()
    compose.onNodeWithText("Graph").performClick()
    save("stocks-large-text")
  }

  @Test @Config(qualifiers = "w412dp-h915dp-night-xhdpi")
  fun unavailableHoldingsDoNotDrawAMisleadingChart() {
    val holdings = Holdings(listOf(Stock("NVDAc", "NVIDIA", "0x0000000000000000000000000000000000000001", null, null, "Unavailable")), fixture.createdAt)
    compose.setContent { PecuTheme { Surface { Column(Modifier.fillMaxSize().padding(24.dp)) { HoldingsView(holdings) } } } }
    compose.onNodeWithTag("stock-allocation-chart").assertDoesNotExist()
    compose.onNodeWithText("Holdings are temporarily unavailable.").assertIsDisplayed()
    compose.onNodeWithText("You don't own any stock tokens yet.").assertDoesNotExist()
    save("stocks-unavailable")
  }

  private fun record(name: String, offset: Int) {
    if (name != "stocks-chat-cover" || System.getProperty("pecu.recordStockGraph") != "true") return
    repeat(16) { index ->
      compose.mainClock.advanceTimeBy(125)
      save("stock-recording/frame-${(offset + index).toString().padStart(3, '0')}")
    }
  }

  private fun save(name: String) {
    val image = compose.onRoot().captureToImage().asAndroidBitmap()
    val file = File("build/outputs/screenshots/$name.png")
    file.parentFile!!.mkdirs()
    file.outputStream().use { image.compress(Bitmap.CompressFormat.PNG, 100, it) }
  }
}
