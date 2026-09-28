@file:OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)
package app.pecu

import android.app.Application
import android.graphics.Bitmap
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.dp
import com.google.zxing.BinaryBitmap
import com.google.zxing.MultiFormatReader
import com.google.zxing.RGBLuminanceSource
import com.google.zxing.common.HybridBinarizer
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
class WalletUiTest {
  @get:Rule val compose = createComposeRule()
  private val wallet = "0x" + "1".repeat(40)
  private val recipient = "0x" + "2".repeat(40)
  private val portfolio = Portfolio(wallet, listOf(
    Balance("ETH", "ETH", amount = "0.000348107746868867"),
    Balance("USDC", "USDC", "0x" + "3".repeat(40), "0.045763"),
    Balance("AERO", "AERO", "0x" + "4".repeat(40), "0.008976274322356609"),
  ), holdings = Holdings(emptyList(), 1790503200000))
  private fun render(fontScale: Float = 1f, data: Portfolio = portfolio, account: AccountState = AccountState(wallet = wallet),
    busy: Boolean = false, error: String? = null, onLoad: (List<String>) -> Unit = {}, onPnl: (Int) -> Unit = {}, onReview: (String) -> Unit = {}) {
    compose.setContent { PecuTheme {
      val density = LocalDensity.current
      CompositionLocalProvider(LocalDensity provides Density(density.density, fontScale)) {
        Surface(Modifier.fillMaxSize(), color = androidx.compose.material3.MaterialTheme.colorScheme.background) {
          WalletContent(account, data, busy = busy, error = error, onLoadPortfolio = onLoad, onLoadPnl = onPnl, onReview = onReview)
        }
      }
    } }
  }
  @Test fun balancesLeadAndExactValuesStayAccessible() {
    render()
    compose.onNodeWithTag("wallet-qr").assertDoesNotExist()
    compose.onNodeWithText("≈0.000348").assertIsDisplayed()
    compose.onNodeWithText("0.000348107746868867 ETH").assertDoesNotExist()
    save("wallet-cover")
    compose.onNodeWithText("ETH").performClick()
    compose.onNodeWithText("0.000348107746868867 ETH").assertIsDisplayed()
    compose.onNodeWithText("ETH").performClick()
    compose.onNodeWithText("0.000348107746868867 ETH").assertDoesNotExist()
  }
  @Test fun receiveIsReversibleAndQrEncodesExactWallet() {
    render()
    compose.onNodeWithText("Receive").performClick()
    compose.waitUntil(10_000) { compose.onAllNodesWithTag("wallet-qr").fetchSemanticsNodes().isNotEmpty() }
    compose.onNodeWithTag("wallet-qr").performScrollTo().assertIsDisplayed()
    save("wallet-receive")
    val bitmap = walletQrBitmap(wallet)
    val pixels = IntArray(bitmap.width * bitmap.height)
    bitmap.getPixels(pixels, 0, bitmap.width, 0, 0, bitmap.width, bitmap.height)
    assertEquals(wallet, MultiFormatReader().decode(BinaryBitmap(HybridBinarizer(RGBLuminanceSource(bitmap.width, bitmap.height, pixels)))).text)
    compose.onNodeWithText("Close receive").performScrollTo().performClick()
    compose.onNodeWithTag("wallet-qr").assertDoesNotExist()
  }
  @Test @Config(qualifiers = "w900dp-h750dp-night-xhdpi")
  fun unfoldedShowsBalancesBesideReceive() {
    render()
    compose.onNodeWithText("Receive").performClick()
    compose.waitUntil(10_000) { compose.onAllNodesWithTag("wallet-qr").fetchSemanticsNodes().isNotEmpty() }
    compose.onNodeWithTag("wallet-qr").assertIsDisplayed()
    compose.onNodeWithText("≈0.000348").assertIsDisplayed()
    save("wallet-unfolded")
  }
  @Test @Config(qualifiers = "w900dp-h750dp-night-xhdpi")
  fun actualBottomSheetAllowsTheUnfoldedLayout() {
    compose.setContent { PecuTheme {
      ModalBottomSheet(onDismissRequest = {}, sheetMaxWidth = WalletSheetMaxWidth,
        sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)) {
        WalletContent(AccountState(wallet = wallet), portfolio, onLoadPortfolio = {}, onLoadPnl = {}, onReview = {})
      }
    } }
    compose.onNodeWithTag("wallet-sheet").assertWidthIsAtLeast(700.dp)
    compose.onNodeWithText("Receive").performClick()
    compose.waitUntil(10_000) { compose.onAllNodesWithTag("wallet-qr").fetchSemanticsNodes().isNotEmpty() }
    val balance = compose.onNodeWithText("≈0.000348").fetchSemanticsNode().boundsInRoot
    val qr = compose.onNodeWithTag("wallet-qr").fetchSemanticsNode().boundsInRoot
    assertTrue(qr.left > balance.right)
    compose.onNodeWithTag("wallet-qr").assertIsDisplayed()
  }
  @Test @Config(qualifiers = "w320dp-h640dp-night-xhdpi")
  fun largeTextCanAddTokensWithoutLosingEarlierOnes() {
    var requested = emptyList<String>()
    render(1.6f, portfolio.copy(balances = portfolio.balances + Balance("DAI", "DAI", amount = "1")), onLoad = { requested = it })
    save("wallet-large-text")
    compose.onNodeWithText("Add token").performScrollTo().performClick()
    compose.onNodeWithText("Ticker or token address").performScrollTo().performTextInput("WETH")
    compose.onNodeWithText("Add", useUnmergedTree = true).performScrollTo().performClick()
    assertEquals(listOf("ETH", "USDC", "AERO", "DAI", "WETH"), requested)
    save("wallet-large-text-add")
    compose.onNodeWithText("Cancel adding token").performScrollTo().performClick()
    compose.onNodeWithText("Ticker or token address").assertDoesNotExist()
    compose.onNodeWithText("Receive").performScrollTo().performClick()
    compose.waitUntil(10_000) { compose.onAllNodesWithTag("wallet-qr").fetchSemanticsNodes().isNotEmpty() }
    compose.onNodeWithTag("wallet-qr").performScrollTo().assertIsDisplayed()
    save("wallet-large-text-receive")
  }
  @Test fun reviewKeepsExactAmountAndDoesNotExecuteTransfer() {
    var command: String? = null
    render(onReview = { command = it })
    compose.onNodeWithText("Send").performClick()
    compose.onNodeWithText("Review transfer").performScrollTo().assertIsNotEnabled()
    compose.onNodeWithText("Amount").performScrollTo().performTextInput("0.000000000000000001")
    compose.onNodeWithText("Recipient on Base").performScrollTo().performTextInput(recipient)
    compose.onNodeWithText("Review transfer").performScrollTo().performClick()
    assertEquals("/send 0.000000000000000001 USDC to $recipient", command)
    save("wallet-send")
  }
  @Test fun errorRetainsRetryAndPnlHasReverseAction() {
    var requested = emptyList<String>()
    var days = 0
    render(error = "Balances could not refresh.", onLoad = { requested = it }, onPnl = { days = it })
    compose.onNodeWithText("Retry").performScrollTo().performClick()
    assertEquals(listOf("ETH", "USDC", "AERO"), requested)
    compose.onNodeWithText("Trading P&L").performScrollTo().performClick()
    assertEquals(30, days)
    compose.onNodeWithText("90d").performScrollTo().performClick()
    assertEquals(90, days)
    compose.onNodeWithText("Hide P&L").performScrollTo().performClick()
    compose.onNodeWithText("90d").assertDoesNotExist()
  }
  @Test @Config(qualifiers = "w412dp-h915dp-notnight-xhdpi")
  fun lightThemeKeepsControlsAndAmountsReadable() { render(); save("wallet-light") }
  private fun save(name: String) {
    val image = compose.onRoot().captureToImage().asAndroidBitmap()
    File("build/outputs/screenshots/$name.png").apply { parentFile!!.mkdirs() }.outputStream().use { image.compress(Bitmap.CompressFormat.PNG, 100, it) }
  }
}
