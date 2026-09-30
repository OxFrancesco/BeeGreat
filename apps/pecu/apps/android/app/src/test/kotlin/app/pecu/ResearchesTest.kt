package app.pecu

import android.app.Application
import android.graphics.Bitmap
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createComposeRule
import java.io.File
import kotlinx.serialization.Serializable
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode

@Serializable private data class ResearchFixture(val list: ResearchList, val detail: Research, val action: ResearchActionResult)

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [36], application = Application::class, qualifiers = "w412dp-h915dp-xhdpi")
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class ResearchesTest {
  @get:Rule val compose = createComposeRule()
  private val fixture = wireJson.decodeFromString<ResearchFixture>(javaClass.getResource("/researches.json")!!.readText())

  @Test fun `shared fixture decodes with the web's periods and states`() {
    val (running, finished) = fixture.list.researches
    assertTrue(running.active)
    assertFalse(finished.active)
    assertEquals("23–29 Sep 2026", researchPeriod(finished))
    assertEquals("Last 30d", researchPeriod(finished.copy(window = "30d", period = null)))
    assertEquals("30 Sep–6 Oct 2026", researchPeriod(finished.copy(period = ResearchPeriod("2026-09-30", "2026-10-06"))))
    assertEquals("Specialists at work", researchStateText(running))
    assertEquals(1, fixture.list.limit.daily - fixture.list.limit.used)
    assertTrue(fixture.detail.markdown!!.contains("DeFi TVL"))
    assertEquals("Started Base research ABC234.", fixture.action.message)
  }

  @Test fun `research pushes open the report`() {
    val alert = automationAlert(mapOf("title" to "Base research ready", "body" to "Morpho vault deposits carried Base TVL", "tag" to "research:ABC234", "channel" to "x"))!!
    assertEquals("pecu://researches?code=ABC234", automationLink(alert).toString())
    assertEquals("pecu://agent", automationLink(alert.copy(tag = "research:bad")).toString())
  }

  @Test fun `home starts a run and lists reports`() {
    val started = mutableListOf<Pair<String, String>>()
    val opened = mutableListOf<String>()
    compose.setContent { PecuTheme { Surface(Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
      Column { ResearchHome(ResearchUi(list = fixture.list), { chain, window -> started += chain to window }, { opened += it }) }
    } } }
    compose.onNodeWithText("1 of 3 runs left today").assertIsDisplayed()
    compose.onNodeWithText("Morpho vault deposits carried Base TVL").assertIsDisplayed()
    save("research-home")
    compose.onNodeWithText("30d").performClick()
    compose.onNodeWithText("Start research").performClick()
    assertEquals(listOf("base" to "30d"), started)
    compose.onAllNodesWithText("Base · 23–29 Sep 2026").assertCountEquals(2)
  }

  @Test fun `a running report offers cancel and names the stage that did not finish`() {
    val actions = mutableListOf<String>()
    compose.setContent { PecuTheme { Surface(Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
      Column { ResearchDetail(fixture.list.researches.first(), busy = false, onAct = { kind, _, _, _ -> actions += kind }, onBack = {}) }
    } } }
    compose.onNodeWithText("Did not finish · 3 reads").assertIsDisplayed()
    compose.onNodeWithText("X data is busy").assertIsDisplayed()
    save("research-running")
    compose.onNodeWithText("Cancel").performClick()
    assertEquals(listOf("cancel"), actions)
  }

  private fun save(name: String) {
    val image = compose.onRoot().captureToImage().asAndroidBitmap()
    File("build/outputs/screenshots/$name.png").apply { parentFile!!.mkdirs() }.outputStream().use { image.compress(Bitmap.CompressFormat.PNG, 100, it) }
  }
}
