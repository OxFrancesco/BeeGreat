package app.pecu

import android.app.Application
import android.graphics.Bitmap
import app.pecu.dither.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.unit.*
import java.io.File
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [36], application = Application::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class DitherUiTest {
  @get:Rule val compose = createComposeRule()
  private val rows = listOf(12.0, 27.0, 18.0, 39.0, 31.0, 46.0).mapIndexed { i,v -> ChartRow(listOf("Mon","Tue","Wed","Thu","Fri","Sat")[i], mapOf("a" to v, "b" to (v * .45 + (i % 2) * 12))) }
  private val series = listOf(Area("a","Stocks",DitherColor.Orange), Area("b","Tokens",DitherColor.Blue,AreaVariant.Hatched))
  private val slices = listOf(PieDatum("nvda",62.0,"NVIDIA",DitherColor.Orange), PieDatum("apple",25.0,"Apple",DitherColor.Blue), PieDatum("meta",13.0,"Meta",DitherColor.Green))

  @Composable private fun Family(index: Int, height: Int = 190) {
    val chart = Modifier.fillMaxWidth().height(height.dp).testTag("family-$index")
    val options = ChartOptions(sparkles = false)
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
      Text(listOf("Area", "Line", "Bar", "Pie", "Radar", "Sparkline")[index], style = MaterialTheme.typography.titleMedium)
      when(index) {
        0 -> AreaChart(rows,series,chart,options.copy(stackType = StackType.Stacked))
        1 -> LineChart(rows,series,chart,options)
        2 -> BarChart(rows.mapIndexed { i,r -> if (i == 2) r.copy(values = mapOf("a" to -18.0,"b" to -9.0)) else r },series,chart,options.copy(referenceLines = listOf(ReferenceLine())))
        3 -> PieChart(slices,chart,pie = Pie(AreaVariant.Dotted,.55))
        4 -> RadarChart(rows,series,chart)
        5 -> Sparkline(rows.map { it.values["a"]!! },chart,color = DitherColor.Orange, options = options)
      }
    }
  }
  @Test @Config(qualifiers = "w900dp-h900dp-night-xhdpi")
  fun allFamiliesUnfolded() {
    compose.setContent { PecuTheme { Surface { Column(Modifier.fillMaxSize().padding(24.dp),verticalArrangement = Arrangement.spacedBy(18.dp)) {
      for (r in 0..2) Row(horizontalArrangement = Arrangement.spacedBy(24.dp)) { for(c in 0..1) Column(Modifier.weight(1f)) { Family(r * 2 + c,200) } }
      BlockLegend(series)
    } } } }
    for (i in 0..5) compose.onNodeWithTag("family-$i").assertIsDisplayed()
    save("dither-unfolded")
  }
  @Test @Config(qualifiers = "w320dp-h720dp-night-xhdpi")
  fun narrowScreenAndLargeFont() {
    compose.setContent { val density = LocalDensity.current; CompositionLocalProvider(LocalDensity provides Density(density.density,1.6f)) { PecuTheme { Surface { Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),verticalArrangement = Arrangement.spacedBy(18.dp)) { Family(2,240); Family(3,240); BlockLegend(series) } } } } }
    compose.onNodeWithTag("family-2").assertIsDisplayed()
    save("dither-cover-large-text")
    compose.onNodeWithText("Tokens").performScrollTo().assertIsDisplayed()
  }
  @Test @Config(qualifiers = "w412dp-h915dp-xhdpi")
  fun lightThemeAndAllTextures() {
    compose.setContent { PecuTheme { Surface { Column(Modifier.fillMaxSize().padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
      AreaVariant.entries.forEach { variant ->
        Text(variant.name,style = MaterialTheme.typography.titleMedium)
        AreaChart(rows,listOf(Area("a","Stocks",DitherColor.Orange,variant)),Modifier.fillMaxWidth().height(148.dp),ChartOptions(sparkles = false))
      }
    } } } }
    save("dither-textures-light")
  }
  @Test @Config(qualifiers = "w412dp-h915dp-night-xhdpi")
  fun touchScrubLegendAndAccessibleData() {
    lateinit var state: ChartState
    var selected: String? = null
    compose.setContent { PecuTheme { Surface { Column(Modifier.fillMaxSize().padding(20.dp)) {
      state = rememberChartState()
      AreaChart(rows,series,Modifier.fillMaxWidth().height(260.dp).testTag("interactive"),ChartOptions(sparkles = false),state,onSelectionChange = { selected = it })
      Legend(series,state=state,onSelectionChange = { selected = it })
    } } } }
    compose.onNodeWithText("Tokens").performClick()
    compose.runOnIdle { assertEquals("b",selected) }
    compose.onNodeWithText("Tokens").assertIsOn().performClick()
    compose.runOnIdle { assertNull(selected) }
    compose.onNodeWithTag("interactive").performTouchInput { swipeLeft() }
    compose.runOnIdle { assertNotNull(state.hoverIndex) }
    save("dither-touch-tooltip")
    val actions = compose.onNodeWithContentDescription("Area chart").fetchSemanticsNode().config[SemanticsActions.CustomActions]
    compose.runOnIdle { assertTrue(actions.first { it.label == "Next data point" }.action()) }
    compose.runOnIdle { assertTrue(actions.first { it.label == "Clear selection" }.action()) }
    compose.runOnIdle { assertNull(state.hoverIndex); assertNull(state.selectedKey) }
  }
  @Test @Config(qualifiers = "w412dp-h915dp-night-xhdpi")
  fun pieSelectionAndEmptyChart() {
    lateinit var state: ChartState
    compose.setContent { PecuTheme { Surface { Column(Modifier.fillMaxSize().padding(20.dp)) {
      state = rememberChartState()
      PieChart(slices,Modifier.fillMaxWidth().height(280.dp).testTag("pie"),pie = Pie(AreaVariant.Dotted,.5),state=state)
      PieChart(emptyList(),Modifier.fillMaxWidth().height(150.dp),description="Empty holdings")
    } } } }
    compose.onNodeWithTag("pie").performTouchInput { click(androidx.compose.ui.geometry.Offset(width * .75f,height * .5f)) }
    compose.runOnIdle { assertEquals("nvda",state.selectedKey) }
    compose.onNodeWithText("62").assertIsDisplayed()
    compose.onNodeWithContentDescription("Empty holdings").assert(SemanticsMatcher.expectValue(androidx.compose.ui.semantics.SemanticsProperties.StateDescription,"No data"))
    save("dither-pie-selection")
  }
  @Test @Config(qualifiers = "w412dp-h915dp-night-xhdpi")
  fun standaloneComponentsAndBloom() {
    var clicks = 0
    compose.setContent { PecuTheme { Surface { Column(Modifier.fillMaxSize().padding(20.dp),verticalArrangement = Arrangement.spacedBy(24.dp)) {
      Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
        DitherAvatar("Pecu",animate=false); DitherAvatar("Francesco",animate=false,mirror=AvatarMirror.Vertical,bloom=BloomConfig.High)
      }
      DitherGradient(PixelColor.Named(DitherColor.Orange),Modifier.fillMaxWidth().height(120.dp),to=PixelColor.Named(DitherColor.Blue),direction=GradientDirection.Right)
      DitherButton({ clicks++ },Modifier.fillMaxWidth(),color=PixelColor.Named(DitherColor.Orange)) { Text("Continue") }
      DitherButton({ clicks++ },Modifier.fillMaxWidth(),enabled=false) { Text("Unavailable") }
      AreaChart(rows,series,Modifier.fillMaxWidth().height(230.dp),ChartOptions(bloom=BloomConfig.High,sparkles=false))
    } } } }
    compose.onNodeWithText("Continue").performClick()
    compose.onNodeWithText("Unavailable").assertIsNotEnabled()
    compose.runOnIdle { assertEquals(1,clicks) }
    save("dither-pixels-bloom")
  }
  @Test @Config(qualifiers = "w412dp-h915dp-night-xhdpi")
  fun animatedReplayAndReducedMotion() {
    var replay by mutableIntStateOf(0)
    compose.mainClock.autoAdvance = false
    compose.setContent { PecuTheme { Surface { Column(Modifier.fillMaxSize().padding(20.dp),verticalArrangement=Arrangement.spacedBy(12.dp)) {
      Text("Stock allocation",style=MaterialTheme.typography.titleLarge)
      PieChart(slices,Modifier.fillMaxWidth().height(260.dp),pie=Pie(AreaVariant.Dotted,.55),options=ChartOptions(margins=Margins.Zero,animate=true,replayToken=replay,sparkles=false))
      AreaChart(rows,series,Modifier.fillMaxWidth().height(230.dp),ChartOptions(animate=true,replayToken=replay,sparkles=false))
      BarChart(rows,series,Modifier.fillMaxWidth().height(230.dp),ChartOptions(animate=true,reducedMotion=true,sparkles=false))
    } } } }
    compose.mainClock.advanceTimeBy(32)
    if (System.getProperty("pecu.recordDither") == "true") repeat(32) { i ->
      compose.mainClock.advanceTimeBy(65)
      save("dither-recording/frame-${i.toString().padStart(3,'0')}")
    } else compose.mainClock.advanceTimeBy(1100)
    save("dither-animation-final")
    compose.runOnIdle { replay++ }
    compose.mainClock.advanceTimeBy(1100)
    save("dither-replay-final")
  }
  @Test @Config(qualifiers = "w412dp-h915dp-night-xhdpi")
  fun avatarRepaintsWhenItsSeedChangesWithoutAnimation() {
    var name by mutableStateOf("Pecu")
    compose.setContent { PecuTheme { Surface { DitherAvatar(name,Modifier.size(100.dp),animate=false) } } }
    val before = compose.onNodeWithContentDescription("Pecu avatar").captureToImage().asAndroidBitmap()
    compose.runOnIdle { name = "Francesco" }
    val after = compose.onNodeWithContentDescription("Francesco avatar").captureToImage().asAndroidBitmap()
    assertFalse(before.sameAs(after))
  }
  private fun save(name: String) {
    val bitmap = compose.onRoot().captureToImage().asAndroidBitmap()
    val file = File("build/outputs/screenshots/$name.png"); file.parentFile!!.mkdirs()
    file.outputStream().use { bitmap.compress(Bitmap.CompressFormat.PNG,100,it) }
  }
}
