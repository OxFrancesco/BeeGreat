package app.pecu.dither

import android.animation.ValueAnimator
import androidx.compose.animation.core.*
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.focusable
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.gestures.detectHorizontalDragGestures
import androidx.compose.foundation.layout.*
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.*
import androidx.compose.ui.graphics.drawscope.*
import androidx.compose.ui.input.key.*
import androidx.compose.ui.input.pointer.*
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.*
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.drawText
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.unit.*
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.repeatOnLifecycle
import kotlinx.coroutines.delay
import kotlin.math.*

@Composable fun AreaChart(data: List<ChartRow>, series: List<Series>, modifier: Modifier = Modifier, options: ChartOptions = ChartOptions(), state: ChartState = rememberChartState(), description: String = "Area chart", onHoverChange: (Int?) -> Unit = {}, onSelectionChange: (String?) -> Unit = {}) = Chart(ChartType.Area, data, series, emptyList(), Pie(), modifier, options, state, description, onHoverChange, onSelectionChange)
@Composable fun LineChart(data: List<ChartRow>, series: List<Series>, modifier: Modifier = Modifier, options: ChartOptions = ChartOptions(), state: ChartState = rememberChartState(), description: String = "Line chart", onHoverChange: (Int?) -> Unit = {}, onSelectionChange: (String?) -> Unit = {}) = Chart(ChartType.Line, data, series.map { it.copy(kind = SeriesKind.Line) }, emptyList(), Pie(), modifier, options, state, description, onHoverChange, onSelectionChange)
@Composable fun BarChart(data: List<ChartRow>, series: List<Series>, modifier: Modifier = Modifier, options: ChartOptions = ChartOptions(), state: ChartState = rememberChartState(), description: String = "Bar chart", onHoverChange: (Int?) -> Unit = {}, onSelectionChange: (String?) -> Unit = {}) = Chart(ChartType.Bar, data, series.map { it.copy(kind = SeriesKind.Bar) }, emptyList(), Pie(), modifier, options, state, description, onHoverChange, onSelectionChange)
@Composable fun PieChart(data: List<PieDatum>, modifier: Modifier = Modifier, pie: Pie = Pie(), options: ChartOptions = ChartOptions(margins = Margins.Zero, grid = null, xAxis = null, yAxis = null), state: ChartState = rememberChartState(), description: String = "Pie chart", onHoverChange: (Int?) -> Unit = {}, onSelectionChange: (String?) -> Unit = {}) = Chart(ChartType.Pie, emptyList(), emptyList(), data, pie, modifier, options, state, description, onHoverChange, onSelectionChange)
@Composable fun RadarChart(data: List<ChartRow>, series: List<Series>, modifier: Modifier = Modifier, options: ChartOptions = ChartOptions(margins = Margins.Polar, grid = null, xAxis = null, yAxis = null), state: ChartState = rememberChartState(), description: String = "Radar chart", onHoverChange: (Int?) -> Unit = {}, onSelectionChange: (String?) -> Unit = {}) = Chart(ChartType.Radar, data, series, emptyList(), Pie(), modifier, options, state, description, onHoverChange, onSelectionChange)
@Composable fun Sparkline(data: List<Double>, modifier: Modifier = Modifier, color: DitherColor = DitherColor.Green, variant: AreaVariant = AreaVariant.Gradient, options: ChartOptions = ChartOptions(), description: String = "Trend") {
  val rows = remember(data) { data.mapIndexed { index, value -> ChartRow(index.toString(), mapOf("v" to value)) } }
  AreaChart(rows, listOf(Area("v", description, color, variant)), modifier, options.copy(margins = Margins.Zero, grid = null, xAxis = null, yAxis = null, tooltip = null, interactive = false), description = description)
}

@Composable internal fun entranceProgress(key: Any, options: ChartOptions): State<Float> {
  val progress = remember { Animatable(1f) }
  val lifecycle = LocalLifecycleOwner.current.lifecycle
  LaunchedEffect(key, options.animate, options.animationDuration, options.replayToken, options.reducedMotion, lifecycle) {
    if (!options.animate || options.reducedMotion || !ValueAnimator.areAnimatorsEnabled() || options.animationDuration == 0) progress.snapTo(1f)
    else lifecycle.repeatOnLifecycle(Lifecycle.State.STARTED) {
      progress.snapTo(0f)
      progress.animateTo(1f, tween(options.animationDuration, easing = LinearEasing))
    }
  }
  return progress.asState()
}

@Composable private fun Chart(type: ChartType, data: List<ChartRow>, series: List<Series>, pieData: List<PieDatum>, pie: Pie, modifier: Modifier, options: ChartOptions, state: ChartState, description: String, onHoverChange: (Int?) -> Unit, onSelectionChange: (String?) -> Unit) {
  require(series.map { it.key }.distinct().size == series.size) { "Series keys must be unique" }
  require(pieData.map { it.key }.distinct().size == pieData.size) { "Slice keys must be unique" }
  val density = LocalDensity.current
  val progress = entranceProgress(listOf(data, pieData), options)
  val textMeasurer = rememberTextMeasurer()
  val colors = MaterialTheme.colorScheme
  val textStyle = MaterialTheme.typography.labelSmall.copy(color = colors.onSurfaceVariant, fontSize = 10.sp)
  val count = if (type == ChartType.Pie) pieData.size else data.size
  val marker = (state.hoverIndex ?: options.markerIndex)?.takeIf { it in 0 until count }
  var pointerActive by remember { mutableStateOf(false) }
  val hovered = marker != null || options.hovered
  val reduced = options.reducedMotion || !ValueAnimator.areAnimatorsEnabled()
  val intensity = animateFloatAsState(if (hovered) 1f else 0f, tween(if (reduced) 0 else 160), label = "Dither hover")
  val lifecycle = LocalLifecycleOwner.current.lifecycle
  var tick by remember { mutableIntStateOf(0) }
  LaunchedEffect(pointerActive, options.hovered, reduced, options.sparkles, lifecycle) {
    tick = 0
    if ((pointerActive || options.hovered) && !reduced && options.sparkles && type in listOf(ChartType.Area, ChartType.Line)) lifecycle.repeatOnLifecycle(Lifecycle.State.STARTED) {
      while (true) { delay(100); tick++ }
    }
  }
  val currentHover by rememberUpdatedState(onHoverChange)
  val currentSelection by rememberUpdatedState(onSelectionChange)
  val hover: (Int?) -> Unit = { state.hoverIndex = it; currentHover(it) }
  val select: (String?) -> Unit = { key -> if (key != null) { state.toggle(key); currentSelection(state.selectedKey) } }
  LaunchedEffect(count, data, pieData) {
    if (state.hoverIndex != null && state.hoverIndex !in 0 until count) hover(null)
    val keys = if (type == ChartType.Pie) pieData.map { it.key } else series.map { it.key }
    if (state.selectedKey != null && state.selectedKey !in keys) { state.selectedKey = null; currentSelection(null) }
  }
  fun move(delta: Int): Boolean {
    if (count == 0) return false
    hover(((marker ?: if (delta > 0) -1 else count) + delta).coerceIn(0, count - 1)); return true
  }
  BoxWithConstraints(modifier) {
    val totalWidth = maxWidth.value.toDouble(); val totalHeight = maxHeight.value.toDouble()
    val m = options.margins
    val plotWidth = (totalWidth - m.left - m.right).coerceAtLeast(0.0)
    val plotHeight = (totalHeight - m.top - m.bottom).coerceAtLeast(0.0)
    if (!plotWidth.isFinite() || !plotHeight.isFinite() || plotWidth <= 0 || plotHeight <= 0) return@BoxWithConstraints
    val geometry = remember(type, data, series, pieData, pie, options.stackType, plotWidth, plotHeight) { ChartGeometry(type, data, series, pieData, pie, options.stackType, plotWidth, plotHeight) }
    val painter = remember(geometry) { ChartPainter(geometry) }
    val glow = remember(painter, options.bloom != null) { if (options.bloom != null) BloomPainter(painter.buffer.cols, painter.buffer.rows) else null }
    val items = marker?.let { tooltipItems(type, data, series, pieData, it) }.orEmpty()
    val heading = marker?.let { if (type == ChartType.Pie) pieData[it].label else data[it].label }.orEmpty()
    fun hit(position: Offset): Int? = geometry.indexAt(position.x / density.density - m.left.toDouble(), position.y / density.density - m.top.toDouble())
    fun keyAt(position: Offset): String? = geometry.seriesAt(position.x / density.density - m.left.toDouble(), position.y / density.density - m.top.toDouble())
    val input = if (!options.interactive) Modifier else Modifier
      .pointerInput(geometry) { detectTapGestures(onTap = { hover(hit(it)); select(keyAt(it)) }, onLongPress = { hover(hit(it)) }) }
      .pointerInput(geometry) { detectHorizontalDragGestures(onDragStart = { pointerActive = true }, onDragEnd = { pointerActive = false }, onDragCancel = { pointerActive = false }, onHorizontalDrag = { change, _ -> hover(geometry.indexAt((change.position.x / density.density - m.left.toDouble()).coerceIn(0.0, plotWidth), (change.position.y / density.density - m.top.toDouble()).coerceIn(0.0, plotHeight))); change.consume() }) }
      .pointerInput(geometry) { awaitPointerEventScope { while (true) {
        val event = awaitPointerEvent()
        if (event.type == PointerEventType.Exit) { pointerActive = false; hover(null) }
        else if (event.type == PointerEventType.Move && event.changes.any { it.type == PointerType.Mouse }) { pointerActive = true; hover(hit(event.changes.first().position)) }
      } } }
      .onKeyEvent { event -> if (event.type != KeyEventType.KeyDown) false else when(event.key) {
        Key.DirectionRight -> move(1)
        Key.DirectionLeft -> move(-1)
        Key.Escape -> { state.clear(); currentHover(null); currentSelection(null); true }
        else -> false
      } }.focusable()
    Canvas(Modifier.fillMaxSize().then(input).semantics {
      contentDescription = description
      stateDescription = if (count == 0) "No data" else if (marker == null) "${count} data points" else (listOf(heading) + items.map { "${it.label} ${options.tooltip?.valueFormatter?.invoke(it.value, it.key) ?: compactValue(it.value)}" }).joinToString(", ")
      if (options.interactive) customActions = listOf(
        CustomAccessibilityAction("Next data point") { move(1) },
        CustomAccessibilityAction("Previous data point") { move(-1) },
        CustomAccessibilityAction("Clear selection") { state.clear(); currentHover(null); currentSelection(null); true },
      )
    }) {
      val unit = density.density
      translate(m.left * unit, m.top * unit) {
        val w = plotWidth.toFloat() * unit; val h = plotHeight.toFloat() * unit
        fun label(text: String, x: Float, y: Float, align: Float = .5f, maxWidth: Float = totalWidth.toFloat() * unit) {
          val measured = textMeasurer.measure(text, textStyle, maxLines = 1, overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis, constraints = Constraints(maxWidth = maxWidth.roundToInt().coerceAtLeast(1)))
          val left = (x - measured.size.width * align).coerceIn(-m.left * unit, max(-m.left * unit, w + m.right * unit - measured.size.width))
          drawText(measured, topLeft = Offset(left, y))
        }
        fun stroke(variant: StrokeVariant): PathEffect? = when(variant) { StrokeVariant.Solid -> null; StrokeVariant.Dashed -> PathEffect.dashPathEffect(floatArrayOf(4 * unit, 4 * unit)); StrokeVariant.Dotted -> PathEffect.dashPathEffect(floatArrayOf(unit, 3 * unit)) }
        if (type == ChartType.Radar) {
          for (level in 1..4) {
            val path = Path()
            for (i in data.indices) {
              val a = TOP + i * TAU / data.size
              val x = (geometry.cx + cos(a) * geometry.radius * level / 4).toFloat() * unit
              val y = (geometry.cy + sin(a) * geometry.radius * level / 4).toFloat() * unit
              if (i == 0) path.moveTo(x, y) else path.lineTo(x, y)
            }
            path.close(); drawPath(path, colors.outlineVariant, style = Stroke(unit))
          }
          data.forEachIndexed { i, row ->
            val a = TOP + i * TAU / data.size
            val end = Offset((geometry.cx + cos(a) * geometry.radius).toFloat() * unit, (geometry.cy + sin(a) * geometry.radius).toFloat() * unit)
            drawLine(colors.outlineVariant, Offset(w / 2, h / 2), end, unit)
            label(row.label, (geometry.cx + cos(a) * (geometry.radius + 12)).toFloat() * unit, (geometry.cy + sin(a) * (geometry.radius + 16)).toFloat() * unit - 5.sp.toPx(), maxWidth = w / 3)
          }
        } else if (type != ChartType.Pie) {
          options.grid?.let { grid ->
            if (grid.horizontal) geometry.scale.ticks(options.yAxis?.tickCount ?: 4).forEach { v -> val y = geometry.scale.y(v, h.toDouble()).toFloat(); drawLine(colors.outlineVariant, Offset(0f, y), Offset(w, y), unit, pathEffect = stroke(grid.stroke)) }
            if (grid.vertical) data.indices.forEach { i -> val x = geometry.x(i).toFloat() * unit; drawLine(colors.outlineVariant, Offset(x, 0f), Offset(x, h), unit, pathEffect = stroke(grid.stroke)) }
          }
        }
        val bitmap = painter.paint(Frame(progress.value.toDouble(), intensity.value.toDouble(), marker, state.selectedKey ?: state.focusKey, if (options.sparkles) tick else -1))
        drawImage(bitmap.asImageBitmap(), dstSize = IntSize(w.roundToInt(), h.roundToInt()), filterQuality = FilterQuality.None)
        options.bloom?.takeIf { !options.bloomOnHover || hovered }?.let { config ->
          val glowImage = glow!!.paint(painter.buffer, config, Frame(progress.value.toDouble(), intensity.value.toDouble(), marker, state.selectedKey ?: state.focusKey, tick))
          drawImage(glowImage.asImageBitmap(), dstSize = IntSize(w.roundToInt(), h.roundToInt()), alpha = config.opacity, blendMode = when(config.blend) { BloomBlend.PlusLighter -> BlendMode.Plus; BloomBlend.Screen -> BlendMode.Screen; BloomBlend.Lighten -> BlendMode.Lighten }, filterQuality = FilterQuality.Low)
        }
        if (type != ChartType.Pie && type != ChartType.Radar) {
          options.referenceLines.filter { it.y.isFinite() && it.y in geometry.scale.min..geometry.scale.max }.forEach { line ->
            val y = geometry.scale.y(line.y, h.toDouble()).toFloat()
            drawLine(colors.onSurfaceVariant.copy(alpha = .6f), Offset(0f, y), Offset(w, y), unit, pathEffect = stroke(line.stroke))
            line.label?.let { label(it, w, y - 14.sp.toPx(), 1f) }
          }
          options.xAxis?.let { axis ->
            val ticks = min(axis.maxTicks.coerceAtLeast(1), (w / (52.sp.toPx())).toInt().coerceAtLeast(1))
            val step = ceil(data.size.toDouble() / ticks).toInt().coerceAtLeast(1)
            data.forEachIndexed { i, row -> if (i % step == 0) label(axis.formatter(row.label, i), geometry.x(i).toFloat() * unit, h + axis.tickMargin * unit, maxWidth = w / ticks) }
          }
          options.yAxis?.let { axis -> geometry.scale.ticks(axis.tickCount).forEach { v -> label(axis.formatter(v), -axis.tickMargin * unit, geometry.scale.y(v, h.toDouble()).toFloat() - 5.sp.toPx(), 1f, (m.left - axis.tickMargin).coerceAtLeast(1f) * unit) } }
          if (marker != null) {
            val x = geometry.x(marker).toFloat() * unit
            drawLine(colors.onSurfaceVariant.copy(alpha = .5f), Offset(x, 0f), Offset(x, h), unit, pathEffect = stroke(StrokeVariant.Dashed))
          }
          if (progress.value >= 1f) series.forEachIndexed { si, spec ->
            val dim = if ((state.selectedKey ?: state.focusKey).let { it != null && it != spec.key }) .3f else 1f
            data.forEachIndexed { i, row ->
              if (row.values[spec.key]?.isFinite() != true) return@forEachIndexed
              val active = marker == i
              val dot = if (active) spec.activeDot?.let { Dot(it.variant, it.radius) } ?: spec.dot else spec.dot
              if (dot != null) {
                val at = Offset(geometry.x(i).toFloat() * unit, geometry.scale.y(geometry.bands.series[si][i].top, h.toDouble()).toFloat())
                if (active) drawCircle(spec.color.line.copy(alpha = .18f * dim), (dot.radius + 3) * unit, at)
                drawCircle(if (dot.variant == DotVariant.Filled) spec.color.star.copy(alpha = dim) else colors.surface, dot.radius * unit, at)
                drawCircle((if (dot.variant == DotVariant.Border) spec.color.star else spec.color.line).copy(alpha = dim), dot.radius * unit, at, style = Stroke(if (active) 2 * unit else unit))
              }
            }
            if (spec.strokeVariant != StrokeVariant.Solid && type != ChartType.Bar) {
              val path = Path(); var connected = false
              data.forEachIndexed { i, row ->
                if (row.values[spec.key]?.isFinite() != true) connected = false else {
                  val x = geometry.x(i).toFloat() * unit; val y = geometry.scale.y(geometry.bands.series[si][i].top, h.toDouble()).toFloat()
                  if (connected) path.lineTo(x, y) else path.moveTo(x, y); connected = true
                }
              }
              drawPath(path, spec.color.line.copy(alpha = dim), style = Stroke(unit, pathEffect = stroke(spec.strokeVariant)))
            }
          }
        }
      }
    }
    if (options.tooltip != null && marker != null && options.interactive && items.isNotEmpty()) {
      var tooltipSize by remember { mutableStateOf(IntSize.Zero) }
      val anchor = if (type == ChartType.Pie) {
        val angle = geometry.slices[marker].mid
        Offset((geometry.cx + cos(angle) * geometry.radius * .7).toFloat(), (geometry.cy + sin(angle) * geometry.radius * .7).toFloat())
      } else if (type == ChartType.Radar) {
        val angle = TOP + marker * TAU / data.size
        Offset((geometry.cx + cos(angle) * geometry.radius).toFloat(), (geometry.cy + sin(angle) * geometry.radius).toFloat())
      } else Offset(geometry.x(marker).toFloat(), series.indices.map { geometry.scale.y(geometry.bands.series[it][marker].top, plotHeight) }.minOrNull()?.toFloat() ?: 0f)
      val desired = IntOffset(
        ((anchor.x + m.left) * density.density - tooltipSize.width / 2f).roundToInt().coerceIn(0, (totalWidth * density.density - tooltipSize.width).toInt().coerceAtLeast(0)),
        ((anchor.y + m.top - 12) * density.density - tooltipSize.height).roundToInt().coerceIn(0, (totalHeight * density.density - tooltipSize.height).toInt().coerceAtLeast(0)),
      )
      val position by animateIntOffsetAsState(desired, tween(if (reduced) 0 else 160, easing = CubicBezierEasing(.23f, 1f, .32f, 1f)), label = "Dither tooltip")
      ChartTooltip(heading, items, options.tooltip, state.selectedKey ?: state.focusKey,
        Modifier.offset { position }.widthIn(max = maxWidth * .8f).onSizeChanged { tooltipSize = it }.padding(4.dp))
    }
  }
}
