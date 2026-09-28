package app.pecu.dither

import kotlin.math.*

internal const val TAU = PI * 2
internal const val TOP = -PI / 2

data class Band(val floor: Double, val top: Double)
data class Bands(val series: List<List<Band>>, val min: Double, val max: Double)
/** Matches d3 stackOffsetNone/Expand, including their signed cumulative stacks. */
fun computeBands(rows: List<ChartRow>, series: List<Series>, stack: StackType): Bands {
  val sums = rows.map { row -> series.sumOf { row.values[it.key]?.takeIf(Double::isFinite) ?: 0.0 } }
  val floors = DoubleArray(rows.size)
  var lo = 0.0; var hi = 0.0
  val bands = series.map { spec -> rows.mapIndexed { index, row ->
    var v = row.values[spec.key]?.takeIf(Double::isFinite) ?: 0.0
    if (stack == StackType.Percent && sums[index] != 0.0) v /= sums[index]
    val floor = if (stack == StackType.Default) 0.0 else floors[index]
    val top = floor + v
    floors[index] = top
    lo = min(lo, min(floor, top)); hi = max(hi, max(floor, top))
    Band(floor, top)
  } }
  return Bands(bands, lo, if (lo == 0.0 && hi == 0.0) 1.0 else hi)
}

data class LinearScale(val min: Double, val max: Double) {
  fun fraction(value: Double) = (value - min) / (max - min)
  fun y(value: Double, height: Double) = height * (1 - fraction(value))
  fun ticks(count: Int = 4): List<Double> {
    val step = tickStep(min, max, count.coerceAtLeast(1))
    if (step <= 0 || !step.isFinite()) return listOf(0.0)
    val first = ceil(min / step).toLong(); val last = floor(max / step).toLong()
    return (first..last).take(100).map { it * step }
  }
}
private fun tickStep(lo: Double, hi: Double, count: Int): Double {
  val step = (hi - lo) / count
  if (step <= 0 || !step.isFinite()) return 1.0
  val power = floor(log10(step)); val error = step / 10.0.pow(power)
  val factor = when { error >= sqrt(50.0) -> 10.0; error >= sqrt(10.0) -> 5.0; error >= sqrt(2.0) -> 2.0; else -> 1.0 }
  return factor * 10.0.pow(power)
}
fun buildYScale(min: Double, max: Double): LinearScale {
  var lo = min(0.0, min); var hi = max(0.0, max)
  if (lo == hi) hi = lo + 1
  repeat(10) {
    val step = tickStep(lo, hi, 10)
    val nextLo = floor(lo / step) * step; val nextHi = ceil(hi / step) * step
    if (nextLo == lo && nextHi == hi) return LinearScale(lo, hi)
    lo = nextLo; hi = nextHi
  }
  return LinearScale(lo, hi)
}
fun pointX(index: Int, length: Int, width: Double): Double = if (length <= 1) width / 2 else index * width / (length - 1)
fun nearestIndex(px: Double, length: Int, width: Double): Int = if (length <= 1 || width <= 0) 0 else ((px / width).coerceIn(0.0, 1.0) * (length - 1)).roundToInt()
fun indexAtBand(px: Double, length: Int, width: Double): Int = if (length <= 0 || width <= 0) 0 else min(length - 1, floor((px / width).coerceIn(0.0, .999) * length).toInt())
data class BarSlot(val x: Double, val width: Double)
fun barSlot(index: Int, seriesIndex: Int, length: Int, seriesCount: Int, width: Double, stack: StackType): BarSlot {
  val step = width / max(1.0, length - .28 + .36)
  val bandwidth = step * .72
  val x = (width - step * (length - .28)) / 2 + index * step
  if (stack != StackType.Default) return BarSlot(x + bandwidth * .05, bandwidth * .9)
  val slot = bandwidth / max(1, seriesCount)
  return BarSlot(x + seriesIndex * slot + slot * .08, slot * .84)
}

data class PieSlice(val key: String, val value: Double, val start: Double, val end: Double) { val mid get() = (start + end) / 2 }
fun pieSlices(data: List<PieDatum>): List<PieSlice> {
  val values = data.map { if (it.value.isFinite()) max(0.0, it.value) else 0.0 }
  // Normalize first to avoid overflow when individually finite values sum to infinity.
  val largest = values.maxOrNull()?.takeIf { it > 0 } ?: 1.0
  val total = values.sumOf { it / largest }.takeIf { it > 0 } ?: 1.0
  var angle = TOP
  return data.mapIndexed { index, item ->
    val start = angle; angle += values[index] / largest / total * TAU
    PieSlice(item.key, values[index], start, angle)
  }
}
fun sliceAtAngle(slices: List<PieSlice>, angle: Double): Int {
  if (!angle.isFinite()) return -1
  val normalized = ((angle - TOP) % TAU + TAU) % TAU + TOP
  return slices.indexOfFirst { normalized >= it.start && normalized < it.end }
}
fun axisAtAngle(length: Int, angle: Double): Int = if (length <= 0) -1 else (((angle - TOP) / TAU * length).roundToInt() % length + length) % length
fun pointInPolygon(x: Double, y: Double, poly: DoubleArray): Boolean {
  var inside = false; var j = poly.size - 2
  for (i in poly.indices step 2) {
    if ((poly[i + 1] > y) != (poly[j + 1] > y) && x < (poly[j] - poly[i]) * (y - poly[i + 1]) / (poly[j + 1] - poly[i + 1]) + poly[i]) inside = !inside
    j = i
  }
  return inside
}
fun distToPolygonEdge(x: Double, y: Double, poly: DoubleArray): Double {
  var best = Double.POSITIVE_INFINITY; var j = poly.size - 2
  for (i in poly.indices step 2) {
    val dx = poly[j] - poly[i]; val dy = poly[j + 1] - poly[i + 1]
    val t = (((x - poly[i]) * dx + (y - poly[i + 1]) * dy) / (dx * dx + dy * dy).coerceAtLeast(1e-12)).coerceIn(0.0, 1.0)
    best = min(best, hypot(poly[i] + t * dx - x, poly[i + 1] + t * dy - y)); j = i
  }
  return best
}
internal fun resample(src: DoubleArray, count: Int): DoubleArray = DoubleArray(count) { c ->
  if (src.isEmpty()) 0.0 else {
    val t = c.toDouble() / max(count - 1, 1) * max(src.size - 1, 1)
    val i = floor(t).toInt().coerceAtMost(src.lastIndex); val f = t - i
    src[i] + (src[min(i + 1, src.lastIndex)] - src[i]) * f
  }
}
