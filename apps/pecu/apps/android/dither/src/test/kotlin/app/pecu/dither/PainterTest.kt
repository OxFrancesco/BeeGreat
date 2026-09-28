package app.pecu.dither

import androidx.compose.ui.graphics.toArgb
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [36])
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class PainterTest {
  @Test fun upstreamOrderedDitherAlphaParity() {
    val fixture = javaClass.getResource("/upstream.tsv")!!.readText().lineSequence().map { it.split('\t') }.filter { it[0] == "column" }.toList()
    AreaVariant.entries.forEach { variant ->
      val buffer = PixelBuffer(8,16)
      buffer.column(3,2.0,14.0,DitherColor.Orange.fill.toArgb(),variant,0.0,1.0,false)
      fixture.filter { it[1].equals(variant.name,true) }.forEach { row ->
        assertEquals("${variant.name} row ${row[3]}",row[4].toDouble(),(buffer.pixels[row[3].toInt()*8+3] ushr 24)/255.0,2.0/255)
      }
    }
  }
  @Test fun allFamiliesRenderAndIdleFramesReuseBitmap() {
    val rows = listOf(ChartRow("a",mapOf("v" to 10.0)),ChartRow("b",mapOf("v" to -5.0)),ChartRow("c",mapOf("v" to 15.0)))
    ChartType.entries.forEach { type -> AreaVariant.entries.forEach { variant ->
      val painter = ChartPainter(ChartGeometry(type,rows,listOf(Series("v",variant=variant,kind=if(type==ChartType.Line) SeriesKind.Line else SeriesKind.Area)),listOf(PieDatum("a",10.0),PieDatum("b",5.0)),Pie(variant,.5),StackType.Default,300.0,200.0))
      val bitmap = painter.paint(Frame())
      assertTrue("$type $variant must paint",painter.buffer.pixels.any { it != 0 })
      val pixels = painter.buffer.pixels.copyOf()
      assertSame(bitmap,painter.paint(Frame()))
      assertArrayEquals(pixels,painter.buffer.pixels)
      assertTrue(painter.buffer.cols <= 520); assertTrue(painter.buffer.rows <= 200)
    } }
  }
  @Test fun pieHoleAndMissingValuesRemainTransparent() {
    val geometry = ChartGeometry(ChartType.Pie,emptyList(),emptyList(),listOf(PieDatum("a",100.0)),Pie(innerRadius=.6),StackType.Default,200.0,200.0)
    val painter = ChartPainter(geometry); painter.paint(Frame())
    assertEquals(0,painter.buffer.pixels[50*100+50]); assertNull(geometry.indexAt(100.0,100.0))
    assertEquals("a",geometry.seriesAt(180.0,100.0))
    val missing = ChartPainter(ChartGeometry(ChartType.Area,listOf(ChartRow("a",mapOf("v" to null))),listOf(Area("v")),emptyList(),Pie(),StackType.Default,200.0,200.0))
    missing.paint(Frame()); assertTrue(missing.buffer.pixels.all { it == 0 })
  }
  @Test fun bloomKeepsCrispBufferAndSupportsAllPresets() {
    val buffer = PixelBuffer(32,32)
    for(y in 12..20) for(x in 12..20) buffer.put(x,y,0xffff9632.toInt(),1.0)
    val original = buffer.pixels.copyOf()
    val bloom = BloomPainter(32,32)
    listOf(BloomConfig.Low,BloomConfig.High,BloomConfig.Aura).forEach { config ->
      val bitmap = bloom.paint(buffer,config,1)
      assertSame(bitmap,bloom.paint(buffer,config,1))
      assertTrue(bitmap.getPixel(15,16) ushr 24 > 0)
      assertArrayEquals(original,buffer.pixels)
    }
  }
  @Test fun continuousHitsFollowTheVisibleSlopeAndMissingGaps() {
    val rows = listOf(ChartRow("a",mapOf("v" to 0.0)),ChartRow("b",mapOf("v" to 100.0)))
    val g = ChartGeometry(ChartType.Area,rows,listOf(Area("v")),emptyList(),Pie(),StackType.Default,100.0,100.0)
    assertEquals("v",g.seriesAt(25.0,80.0)); assertNull(g.seriesAt(25.0,60.0))
    val missing = ChartGeometry(ChartType.Area,rows+ChartRow("c",mapOf("v" to null)),listOf(Area("v")),emptyList(),Pie(),StackType.Default,100.0,100.0)
    assertNull(missing.interpolatedBand(0,75.0))
  }
  @Test fun nativePainterTiming() {
    val rows = (0..199).map { ChartRow(it.toString(),mapOf("a" to (20 + it%30).toDouble(),"b" to (10 + it%20).toDouble())) }
    val results = ChartType.entries.map { type ->
      val g = ChartGeometry(type,rows.take(if(type==ChartType.Radar) 8 else 200),listOf(Area("a"),Area("b")),listOf(PieDatum("a",60.0),PieDatum("b",40.0)),Pie(innerRadius=.5),StackType.Default,600.0,240.0)
      val painter = ChartPainter(g)
      repeat(4) { painter.paint(Frame(intensity=it/4.0)) }
      val samples = (1..12).map { i -> val start=System.nanoTime(); painter.paint(Frame(intensity=i/12.0)); (System.nanoTime()-start)/1e6 }.sorted()
      "${type.name}\t${samples[6]}\t${samples.last()}\t${painter.buffer.cols*painter.buffer.rows}"
    }
    java.io.File("build/reports/painter-timing.tsv").apply { parentFile.mkdirs(); writeText("chart\tmedianMs\tmaxMs\tcells\n"+results.joinToString("\n")) }
  }
}
