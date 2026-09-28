package app.pecu.dither

import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.Saver
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.graphics.Color
import java.text.DecimalFormat

/** The original Dither Kit seed palette, including line and marker colors. */
enum class DitherColor(val fill: Color, val line: Color, val star: Color) {
  Green(Color(0xFF28D26E), Color(0xFF96FFB4), Color(0xFFC8FFDC)),
  Blue(Color(0xFF358FF3), Color(0xFF96C8FF), Color(0xFFCDE4FF)),
  Purple(Color(0xFF966EFF), Color(0xFFC8AFFF), Color(0xFFE1D2FF)),
  Pink(Color(0xFFF05ABE), Color(0xFFFFAADC), Color(0xFFFFCDEB)),
  Orange(Color(0xFFFF9632), Color(0xFFFFC382), Color(0xFFFFDCAF)),
  Red(Color(0xFFF04646), Color(0xFFFF968C), Color(0xFFFFC3B9)),
  Grey(Color(0xFF5C5C64), Color(0xFF8C8C96), Color(0xFFA5A5AF));
}
enum class AreaVariant { Gradient, Dotted, Hatched, Solid }
enum class StrokeVariant { Solid, Dashed, Dotted }
enum class SeriesKind { Area, Line, Bar, Radar }
enum class StackType { Default, Stacked, Percent }
enum class ChartType { Area, Line, Bar, Pie, Radar }
enum class DotVariant { Border, ColoredBorder, Filled }
enum class TooltipVariant { Default, FrostedGlass }
enum class BloomBlend { PlusLighter, Screen, Lighten }
data class BloomConfig(val blur: Float, val brightness: Float, val opacity: Float, val saturate: Float = 1f, val blend: BloomBlend = BloomBlend.PlusLighter) {
  init { require(blur.isFinite() && blur >= 0 && brightness.isFinite() && brightness >= 0 && opacity in 0f..1f && saturate.isFinite() && saturate >= 0) }
  companion object {
    val Low = BloomConfig(3f, 1.35f, .7f, 1.4f)
    val High = BloomConfig(5f, 1.5f, .78f, 1.5f)
    val Aura = BloomConfig(15f, 2.9f, .1f, 3f)
  }
}
data class Dot(val variant: DotVariant = DotVariant.Border, val radius: Float = 2f)
data class ActiveDot(val variant: DotVariant = DotVariant.ColoredBorder, val radius: Float = 3f)
data class Series(
  val key: String,
  val label: String = key,
  val color: DitherColor = DitherColor.Blue,
  val kind: SeriesKind = SeriesKind.Area,
  val variant: AreaVariant = AreaVariant.Gradient,
  val strokeVariant: StrokeVariant = StrokeVariant.Solid,
  val isClickable: Boolean = true,
  val dot: Dot? = null,
  val activeDot: ActiveDot? = ActiveDot(),
)
fun Area(key: String, label: String = key, color: DitherColor = DitherColor.Blue, variant: AreaVariant = AreaVariant.Gradient) = Series(key, label, color, SeriesKind.Area, variant)
fun Line(key: String, label: String = key, color: DitherColor = DitherColor.Blue, variant: AreaVariant = AreaVariant.Gradient) = Series(key, label, color, SeriesKind.Line, variant)
fun Bar(key: String, label: String = key, color: DitherColor = DitherColor.Blue, variant: AreaVariant = AreaVariant.Gradient) = Series(key, label, color, SeriesKind.Bar, variant)
fun Radar(key: String, label: String = key, color: DitherColor = DitherColor.Blue, variant: AreaVariant = AreaVariant.Gradient) = Series(key, label, color, SeriesKind.Radar, variant)
data class Pie(val variant: AreaVariant = AreaVariant.Gradient, val innerRadius: Double = 0.0) {
  init { require(innerRadius.isFinite() && innerRadius in 0.0..<1.0) }
}
data class ChartRow(val label: String, val values: Map<String, Double?>)
data class PieDatum(val key: String, val value: Double, val label: String = key, val color: DitherColor = DitherColor.Blue)
data class Margins(val top: Float = 10f, val right: Float = 12f, val bottom: Float = 28f, val left: Float = 44f) {
  init { require(listOf(top, right, bottom, left).all { it.isFinite() && it >= 0 }) }
  companion object { val Zero = Margins(0f, 0f, 0f, 0f); val Polar = Margins(24f, 32f, 24f, 32f) }
}
data class Grid(val horizontal: Boolean = true, val vertical: Boolean = false, val stroke: StrokeVariant = StrokeVariant.Dashed)
data class XAxis(val maxTicks: Int = 8, val tickMargin: Float = 8f, val formatter: (String, Int) -> String = { text, _ -> text })
data class YAxis(val tickCount: Int = 4, val tickMargin: Float = 8f, val formatter: (Double) -> String = ::compactValue)
data class ReferenceLine(val y: Double = 0.0, val label: String? = null, val stroke: StrokeVariant = StrokeVariant.Dashed)
data class Tooltip(val variant: TooltipVariant = TooltipVariant.Default, val valueFormatter: (Double, String) -> String = { value, _ -> compactValue(value) })
/** Motion is opt-in for data screens. Sparkles only schedule frames while hovered. */
data class ChartOptions(
  val stackType: StackType = StackType.Default,
  val margins: Margins = Margins(),
  val grid: Grid? = Grid(),
  val xAxis: XAxis? = XAxis(),
  val yAxis: YAxis? = YAxis(),
  val referenceLines: List<ReferenceLine> = emptyList(),
  val tooltip: Tooltip? = Tooltip(),
  val animate: Boolean = false,
  val animationDuration: Int = 900,
  val replayToken: Int = 0,
  val interactive: Boolean = true,
  val markerIndex: Int? = null,
  val hovered: Boolean = false,
  val bloom: BloomConfig? = null,
  val bloomOnHover: Boolean = false,
  val sparkles: Boolean = true,
  val reducedMotion: Boolean = false,
) { init { require(animationDuration >= 0) } }

@Stable class ChartState(selectedKey: String? = null) {
  var selectedKey by mutableStateOf(selectedKey)
  var focusKey by mutableStateOf<String?>(null)
  var hoverIndex by mutableStateOf<Int?>(null)
  fun toggle(key: String) { selectedKey = if (selectedKey == key) null else key }
  fun clear() { selectedKey = null; focusKey = null; hoverIndex = null }
  companion object { val Saver = Saver<ChartState, String>(save = { it.selectedKey.orEmpty() }, restore = { ChartState(it.ifEmpty { null }) }) }
}
@Composable fun rememberChartState(selectedKey: String? = null): ChartState = rememberSaveable(saver = ChartState.Saver) { ChartState(selectedKey) }
fun compactValue(value: Double): String {
  if (!value.isFinite()) return "Unavailable"
  val scale = when { kotlin.math.abs(value) >= 1e9 -> 1e9 to "B"; kotlin.math.abs(value) >= 1e6 -> 1e6 to "M"; kotlin.math.abs(value) >= 1e3 -> 1e3 to "K"; else -> 1.0 to "" }
  return DecimalFormat("0.##").format(value / scale.first) + scale.second
}
