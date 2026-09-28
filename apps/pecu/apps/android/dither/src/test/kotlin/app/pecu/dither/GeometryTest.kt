package app.pecu.dither

import org.junit.Assert.*
import org.junit.Test

class GeometryTest {
  private val series = listOf(Area("a"), Area("b"))
  private val data = listOf(ChartRow("1", mapOf("a" to 10.0, "b" to 5.0)), ChartRow("2", mapOf("a" to 20.0, "b" to 15.0)), ChartRow("3", mapOf("a" to 30.0, "b" to 10.0)))
  @Test fun upstreamGeometryAndRandomParity() {
    javaClass.getResource("/upstream.tsv")!!.readText().lineSequence().filter { it.isNotBlank() }.forEach { line ->
      val p = line.split('\t')
      when(p[0]) {
        "band" -> { val result = computeBands(data, series, StackType.valueOf(p[1].replaceFirstChar(Char::uppercase))).series[if(p[2] == "a") 0 else 1][p[3].toInt()]; assertEquals(p[4].toDouble(), result.floor, 1e-12); assertEquals(p[5].toDouble(), result.top, 1e-12) }
        "scale" -> { val scale = buildYScale(p[1].toDouble(), p[2].toDouble()); assertEquals(p[3].toDouble(), scale.min, 1e-12); assertEquals(p[4].toDouble(), scale.max, 1e-12) }
        "hash" -> { val hash = fnv1a(p[1]); assertEquals(p[2].toLong(), hash.toLong() and 0xffffffffL); val random = XorShift(hash); p.drop(3).forEach { assertEquals(it.toDouble(), random.next(), 0.0) } }
        "resample" -> assertArrayEquals(p.drop(1).map(String::toDouble).toDoubleArray(), resample(doubleArrayOf(2.0,7.0,3.0), 7), 1e-12)
      }
    }
  }
  @Test fun negativeAndMissingDataRemainFinite() {
    val rows = listOf(ChartRow("a", mapOf("a" to -30.0)), ChartRow("b", mapOf("a" to Double.NaN)), ChartRow("c", emptyMap()))
    val bands = computeBands(rows, listOf(Area("a")), StackType.Default)
    assertEquals(-30.0, bands.min, 0.0); assertEquals(0.0, bands.max, 0.0)
    assertEquals(0.0, buildYScale(bands.min, bands.max).y(0.0, 200.0), 0.0)
    assertEquals(1.0, computeBands(emptyList(), series, StackType.Default).max, 0.0)
  }
  @Test fun pieHitTestingAndLargeValues() {
    val slices = pieSlices(listOf(PieDatum("a", Double.MAX_VALUE), PieDatum("b", Double.MAX_VALUE), PieDatum("zero", 0.0)))
    assertEquals(kotlin.math.PI, slices[0].end - slices[0].start, 1e-12)
    assertEquals(0, sliceAtAngle(slices, 0.0)); assertEquals(1, sliceAtAngle(slices, kotlin.math.PI))
    assertEquals(-1, sliceAtAngle(pieSlices(listOf(PieDatum("zero", 0.0))), 0.0))
    assertEquals(-1, sliceAtAngle(slices, Double.NaN))
  }
  @Test fun radarAndBarGeometry() {
    val polygon = doubleArrayOf(0.0,0.0,10.0,0.0,10.0,10.0,0.0,10.0)
    assertTrue(pointInPolygon(5.0,5.0,polygon)); assertFalse(pointInPolygon(20.0,5.0,polygon))
    assertEquals(5.0, distToPolygonEdge(5.0,5.0,polygon), 0.0)
    assertEquals(0, axisAtAngle(4, -kotlin.math.PI/2)); assertEquals(3, axisAtAngle(4, kotlin.math.PI))
    val a = barSlot(1,0,3,2,300.0,StackType.Default); val b = barSlot(1,1,3,2,300.0,StackType.Default)
    assertTrue(a.x + a.width < b.x)
    assertEquals(barSlot(1,0,3,2,300.0,StackType.Stacked), barSlot(1,1,3,2,300.0,StackType.Stacked))
    assertEquals(0, nearestIndex(-1.0,5,100.0)); assertEquals(4, nearestIndex(101.0,5,100.0))
    assertEquals(3, indexAtBand(120.0,4,100.0)); assertEquals(50.0, pointX(0,1,100.0),0.0)
  }
  @Test fun avatarMirrorsAndOverridesRetainPattern() {
    for (mirror in listOf(AvatarMirror.Horizontal,AvatarMirror.Vertical)) {
      val a = avatarModel("Pecu",null,mirror); val b = avatarModel("Pecu",210f,mirror)
      assertArrayEquals(a.on,b.on)
      for (r in 0..7) for(c in 0..7) assertEquals(a.on[r*8+c], a.on[if(mirror == AvatarMirror.Horizontal) r*8+7-c else (7-r)*8+c])
    }
  }
}
