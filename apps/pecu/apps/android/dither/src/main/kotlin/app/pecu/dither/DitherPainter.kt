package app.pecu.dither

import android.graphics.Bitmap
import androidx.compose.ui.graphics.toArgb
import kotlin.math.*

internal val bayer = doubleArrayOf(0.5, 8.5, 2.5, 10.5, 12.5, 4.5, 14.5, 6.5, 3.5, 11.5, 1.5, 9.5, 15.5, 7.5, 13.5, 5.5).map { it / 16 }.toDoubleArray()
internal fun threshold(x: Int, y: Int) = bayer[(y and 3) * 4 + (x and 3)]
internal fun easeInOut(t: Double) = if (t < .5) 4 * t * t * t else 1 - (-2 * t + 2).pow(3) / 2
internal fun easeOut(t: Double) = 1 - (1 - t).pow(3)

/** A bounded, reused pixel buffer. No Bitmap/Color/Offset allocation in the cell loop. */
internal class PixelBuffer(val cols: Int, val rows: Int) {
  val pixels = IntArray(cols * rows)
  val bitmap = Bitmap.createBitmap(cols, rows, Bitmap.Config.ARGB_8888)
  fun clear() = pixels.fill(0)
  fun put(x: Int, y: Int, rgb: Int, alpha: Double) {
    if (x !in 0 until cols || y !in 0 until rows || alpha <= 0) return
    val a = (alpha.coerceIn(0.0, 1.0) * 255).roundToInt()
    val index = y * cols + x
    val old = pixels[index]; val oldA = old ushr 24
    if (oldA == 0 || a == 255) { pixels[index] = (a shl 24) or (rgb and 0xffffff); return }
    val remaining = oldA * (255 - a) / 255
    val outA = a + remaining
    var result = outA shl 24
    for (shift in 16 downTo 0 step 8) {
      val v = (((rgb ushr shift) and 255) * a + ((old ushr shift) and 255) * remaining) / outA
      result = result or (v shl shift)
    }
    pixels[index] = result
  }
  fun upload() { bitmap.setPixels(pixels, 0, cols, 0, 0, cols, rows) }
  fun column(x: Int, top: Double, floor: Double, rgb: Int, variant: AreaVariant, intensity: Double, dim: Double, stacked: Boolean, sparse: Double = 0.0) {
    val t = top.roundToInt(); val f = floor.roundToInt(); val depth = f - t
    if (depth <= 0) { put(x, t, rgb, .72 * dim); return }
    val bias = (if (variant == AreaVariant.Dotted) .12 else 0.0) + (if (stacked) .2 else 0.0) - sparse
    for (y in max(0, t) until min(rows, f)) {
      var density = (y - t).toDouble() / depth
      if (stacked) density = .5 + .5 * density
      if (variant == AreaVariant.Hatched && ((x + y) and 3) >= 2) continue
      val lit = variant == AreaVariant.Solid || density > threshold(x, y) - .1 * intensity - bias
      if (variant == AreaVariant.Dotted && !lit) continue
      val k = (.3 + density * .7) * (1 + .22 * intensity)
      put(x, y, rgb, (if (lit) k else k * .4) * dim)
    }
    put(x, t, rgb, .72 * dim)
    if (depth > 1) put(x, t + 1, rgb, .36 * dim)
  }
}

internal data class Frame(val progress: Double = 1.0, val intensity: Double = 0.0, val hover: Int? = null, val selected: String? = null, val tick: Int = 0)
internal class ChartGeometry(
  val type: ChartType,
  val data: List<ChartRow>,
  val series: List<Series>,
  val pieData: List<PieDatum>,
  val pie: Pie,
  val stack: StackType,
  val width: Double,
  val height: Double,
) {
  val bands = computeBands(data, series, stack)
  val scale = buildYScale(bands.min, bands.max)
  val slices = pieSlices(pieData)
  val cx = width / 2; val cy = height / 2
  val radius = max(0.0, min(width, height) / 2 - 8)
  val inner = radius * pie.innerRadius
  val radarMax = data.flatMap { row -> series.mapNotNull { row.values[it.key]?.takeIf(Double::isFinite) } }.maxOrNull()?.coerceAtLeast(1e-12) ?: 1.0
  fun x(index: Int) = if (type == ChartType.Bar) {
    val slot = barSlot(index, 0, data.size, 1, width, StackType.Stacked); slot.x + slot.width / 2
  } else pointX(index, data.size, width)
  fun polygon(seriesIndex: Int, progress: Double = 1.0): DoubleArray = DoubleArray(data.size * 2) { n ->
    val i = n / 2; val angle = TOP + i * TAU / max(data.size, 1)
    val r = ((data[i].values[series[seriesIndex].key] ?: 0.0).takeIf(Double::isFinite) ?: 0.0).coerceAtLeast(0.0) / radarMax * radius * progress
    if (n % 2 == 0) cx + cos(angle) * r else cy + sin(angle) * r
  }
  fun indexAt(x: Double, y: Double): Int? {
    if (x !in 0.0..width || y !in 0.0..height) return null
    if (type == ChartType.Pie || type == ChartType.Radar) {
      val r = hypot(x - cx, y - cy)
      if (r > radius + 6 || (type == ChartType.Pie && r < inner)) return null
      val angle = atan2(y - cy, x - cx)
      return (if (type == ChartType.Pie) sliceAtAngle(slices, angle) else axisAtAngle(data.size, angle)).takeIf { it >= 0 }
    }
    if (data.isEmpty()) return null
    return if (type == ChartType.Bar) indexAtBand(x, data.size, width) else nearestIndex(x, data.size, width)
  }
  fun interpolatedBand(seriesIndex: Int, x: Double): Band? {
    if (data.isEmpty()) return null
    val t = (x / width.coerceAtLeast(1.0)).coerceIn(0.0, 1.0) * (data.size - 1)
    val left = floor(t).toInt(); val right = ceil(t).toInt(); val fraction = t - left
    val key = series[seriesIndex].key
    if (data[left].values[key]?.isFinite() != true || data[right].values[key]?.isFinite() != true) return null
    val a = bands.series[seriesIndex][left]; val b = bands.series[seriesIndex][right]
    return Band(a.floor + (b.floor - a.floor) * fraction, a.top + (b.top - a.top) * fraction)
  }
  fun seriesAt(x: Double, y: Double): String? {
    val index = indexAt(x, y) ?: return null
    if (type == ChartType.Pie) return pieData[index].key
    if (type == ChartType.Radar) return series.indices.reversed().firstOrNull { pointInPolygon(x, y, polygon(it)) }?.let { series[it].key }
    return series.indices.reversed().firstOrNull { si ->
      if (!series[si].isClickable || data[index].values[series[si].key]?.isFinite() != true) false else {
        val band = if (type == ChartType.Bar) bands.series[si][index] else interpolatedBand(si, x) ?: return@firstOrNull false
        val top = scale.y(band.top, height); val floor = scale.y(band.floor, height)
        if (type == ChartType.Bar) {
          val slot = barSlot(index, si, data.size, series.size, width, stack)
          x in slot.x..(slot.x + slot.width) && y in min(top, floor)..max(top, floor)
        } else if (series[si].kind == SeriesKind.Line) abs(y - top) < 12
        else y in min(top, floor)..max(top, floor)
      }
    }?.let { series[it].key }
  }
}

internal class ChartPainter(val geometry: ChartGeometry) {
  val buffer = PixelBuffer((geometry.width / 2).roundToInt().coerceIn(8, 520), (geometry.height / 2).roundToInt().coerceIn(8, 200))
  private val g = geometry
  private val cols = buffer.cols; private val rows = buffer.rows
  private val colors = g.series.map { it.color.fill.toArgb() }
  private val pieColors = g.pieData.map { it.color.fill.toArgb() }
  private val tops = g.bands.series.map { layer -> resample(layer.map { g.scale.y(it.top, (rows - 1).toDouble()) }.toDoubleArray(), cols) }
  private val floors = g.bands.series.map { layer -> resample(layer.map { g.scale.y(it.floor, (rows - 1).toDouble()) }.toDoubleArray(), cols) }
  private val valid = g.series.map { spec -> BooleanArray(cols) { x ->
    if (g.data.isEmpty()) false else {
      val t = x.toDouble() / max(cols - 1, 1) * (g.data.size - 1)
      g.data[floor(t).toInt()].values[spec.key]?.isFinite() == true && g.data[ceil(t).toInt()].values[spec.key]?.isFinite() == true
    }
  } }
  private var lastFrame: Frame? = null
  fun paint(frame: Frame): Bitmap {
    if (lastFrame == frame) return buffer.bitmap
    buffer.clear()
    when (g.type) {
      ChartType.Pie -> paintPie(frame)
      ChartType.Radar -> paintRadar(frame)
      ChartType.Bar -> paintBars(frame)
      else -> paintContinuous(frame)
    }
    buffer.upload(); lastFrame = frame
    return buffer.bitmap
  }
  private fun dim(frame: Frame, key: String) = if (frame.selected != null && frame.selected != key) .3 else 1.0
  private fun paintContinuous(f: Frame) {
    val reveal = easeInOut(f.progress) * cols
    g.series.forEachIndexed { si, spec ->
      val isLine = spec.kind == SeriesKind.Line
      val stacked = g.stack != StackType.Default && !isLine
      for (x in 0 until cols) {
        if (x > reveal) break
        if (!valid[si][x]) continue
        val top = tops[si][x]
        val base = if (isLine) min(rows - 1.0, top + max(6.0, round(rows * .16))) else floors[si][x]
        buffer.column(x, min(top, base), max(top, base), colors[si], spec.variant, f.intensity, dim(f, spec.key), stacked, if (stacked) 0.0 else si * .14)
      }
      // Deterministic stars share upstream's seed/phase recipe; tick zero is the steady reduced-motion frame.
      if (f.tick >= 0) repeat(max(4, (cols / 14.0).roundToInt())) { i ->
        val seed = i * 67 + 13 + si * 131
        val xi = seed % max(g.data.size, 1)
        if (g.data.getOrNull(xi)?.values?.get(spec.key)?.isFinite() != true) return@repeat
        val sx = (xi.toDouble() / max(g.data.size - 1, 1) * (cols - 1)).roundToInt()
        if (sx > reveal) return@repeat
        val floor = if (isLine) min(rows - 1.0, tops[si][sx] + max(6.0, round(rows * .16))) else floors[si][sx]
        val sy = (tops[si][sx] + ((seed * 53 + 7) % 100) / 100.0 * (floor - tops[si][sx])).roundToInt()
        val tw = if (f.tick == 0) .85 else (sin((f.tick + seed * 41 % 360) * .35) + 1) / 2
        val lift = tw * (.7 + .3 * f.intensity) * dim(f, spec.key)
        if (lift >= .55) {
          buffer.put(sx, sy, colors[si], lift)
          if (tw > .9) { val a = lift * .6 * (tw - .9) * 10; buffer.put(sx - 1, sy, colors[si], a); buffer.put(sx + 1, sy, colors[si], a); buffer.put(sx, sy - 1, colors[si], a); buffer.put(sx, sy + 1, colors[si], a) }
        }
      }
    }
  }
  private fun paintBars(f: Frame) {
    g.series.forEachIndexed { si, spec -> g.data.forEachIndexed { i, row ->
      if (row.values[spec.key]?.isFinite() != true) return@forEachIndexed
      val start = if (g.data.size > 1) i.toDouble() / (g.data.size - 1) * .55 else 0.0
      val progress = easeOut(((f.progress - start) / .45).coerceIn(0.0, 1.0))
      val band = g.bands.series[si][i]
      val base = g.scale.y(band.floor, rows - 1.0)
      val grown = base + (g.scale.y(band.top, rows - 1.0) - base) * progress
      val slot = barSlot(i, si, g.data.size, g.series.size, g.width, g.stack)
      val c0 = (slot.x / g.width * cols).roundToInt(); val c1 = ((slot.x + slot.width) / g.width * cols).roundToInt()
      val active = f.hover == i
      val dim = dim(f, spec.key) * if (f.hover != null && !active) .5 else 1.0
      for (x in c0 until c1) buffer.column(x, min(grown, base), max(grown, base), colors[si], spec.variant, f.intensity + if (active) .4 else 0.0, dim, g.stack != StackType.Default)
    } }
  }
  private fun paintPie(f: Frame) {
    val reveal = TOP + easeInOut(f.progress) * TAU
    for (y in 0 until rows) for (x in 0 until cols) {
      val dx = (x + .5) * g.width / cols - g.cx; val dy = (y + .5) * g.height / rows - g.cy
      val r = hypot(dx, dy); if (r < g.inner) continue
      val angle = atan2(dy, dx); val normalized = ((angle - TOP) % TAU + TAU) % TAU + TOP
      if (normalized > reveal) continue
      val si = sliceAtAngle(g.slices, angle); if (si < 0) continue
      val active = f.hover == si; val outer = g.radius + if (active) 6 * f.intensity else 0.0
      if (r > outer) continue
      val dim = dim(f, g.pieData[si].key)
      if (outer - r < if (active) 2.4 else 1.4) { buffer.put(x, y, pieColors[si], dim); continue }
      val density = (r - g.inner) / max(outer - g.inner, 1.0)
      texture(x, y, pieColors[si], g.pie.variant, density, f.intensity + if (active) .4 * f.intensity else 0.0, dim, .35)
    }
  }
  private fun paintRadar(f: Frame) {
    val polygons = g.series.indices.map { g.polygon(it, easeInOut(f.progress)) }
    for (y in 0 until rows) for (x in 0 until cols) {
      val px = (x + .5) * g.width / cols; val py = (y + .5) * g.height / rows
      var covered = false
      polygons.forEachIndexed { si, poly ->
        if (!pointInPolygon(px, py, poly)) return@forEachIndexed
        val dist = distToPolygonEdge(px, py, poly)
        val dim = dim(f, g.series[si].key)
        if (dist < 1.4) { buffer.put(x, y, colors[si], dim); covered = true }
        else if (texture(x, y, colors[si], g.series[si].variant, 1 - min(1.0, dist / max(g.radius * .45, 1.0)), f.intensity, dim, .32, si * .2, covered)) covered = true
      }
    }
    polygons.forEachIndexed { si, poly -> for (i in g.data.indices) {
      val x = (poly[i * 2] * cols / g.width).roundToInt(); val y = (poly[i * 2 + 1] * rows / g.height).roundToInt()
      val radius = if (f.hover == i) 1 else 0
      for (dx in -radius..radius) for (dy in -radius..radius) buffer.put(x + dx, y + dy, colors[si], dim(f, g.series[si].key))
    } }
  }
  private fun texture(x: Int, y: Int, color: Int, variant: AreaVariant, density: Double, intensity: Double, dim: Double, base: Double, sparse: Double = 0.0, covered: Boolean = false): Boolean {
    if (variant == AreaVariant.Hatched && ((x + y) and 3) >= 2) return false
    val lit = variant == AreaVariant.Solid || density > threshold(x, y) - .1 * intensity - (if (variant == AreaVariant.Dotted) .12 else 0.0) + sparse
    if (!lit && (variant == AreaVariant.Dotted || covered)) return false
    val k = (base + density * (1 - base)) * (1 + .22 * intensity)
    buffer.put(x, y, color, (if (lit) k else k * .4) * dim)
    return true
  }
}
