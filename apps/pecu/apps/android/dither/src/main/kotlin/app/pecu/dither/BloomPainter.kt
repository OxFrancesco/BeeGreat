package app.pecu.dither

import android.graphics.Bitmap
import kotlin.math.*

/** Separable blur at backing resolution works on API 26 as well as newer devices. */
internal class BloomPainter(private val width: Int, private val height: Int) {
  private val channels = Array(4) { FloatArray(width * height) }
  private val scratch = FloatArray(width * height)
  private val result = IntArray(width * height)
  private val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
  private var last: Pair<BloomConfig, Any>? = null
  fun paint(source: PixelBuffer, config: BloomConfig, revision: Any): Bitmap {
    if (last == config to revision) return bitmap
    val radius = (config.blur / 2).roundToInt().coerceIn(1, 64)
    source.pixels.forEachIndexed { i, pixel ->
      val a = (pixel ushr 24) / 255f
      channels[0][i] = a
      val r = (pixel ushr 16 and 255).toFloat(); val g = (pixel ushr 8 and 255).toFloat(); val b = (pixel and 255).toFloat()
      val luminance = .2126f * r + .7152f * g + .0722f * b
      channels[1][i] = ((luminance + (r - luminance) * config.saturate) * config.brightness).coerceIn(0f, 255f) * a
      channels[2][i] = ((luminance + (g - luminance) * config.saturate) * config.brightness).coerceIn(0f, 255f) * a
      channels[3][i] = ((luminance + (b - luminance) * config.saturate) * config.brightness).coerceIn(0f, 255f) * a
    }
    channels.forEach { channel -> repeat(3) { blur(channel, scratch, radius, true); blur(scratch, channel, radius, false) } }
    for (i in result.indices) {
      val a = channels[0][i]
      result[i] = if (a <= 0) 0 else ((a * 255).roundToInt().coerceIn(0, 255) shl 24) or
        ((channels[1][i] / a).roundToInt().coerceIn(0, 255) shl 16) or
        ((channels[2][i] / a).roundToInt().coerceIn(0, 255) shl 8) or
        (channels[3][i] / a).roundToInt().coerceIn(0, 255)
    }
    bitmap.setPixels(result, 0, width, 0, 0, width, height)
    last = config to revision
    return bitmap
  }
  private fun blur(input: FloatArray, output: FloatArray, radius: Int, horizontal: Boolean) {
    val length = if (horizontal) width else height; val lines = if (horizontal) height else width
    val stride = if (horizontal) 1 else width
    for (line in 0 until lines) {
      val base = if (horizontal) line * width else line
      var sum = 0f
      for (i in -radius..radius) if (i in 0 until length) sum += input[base + i * stride]
      for (i in 0 until length) {
        output[base + i * stride] = sum / (radius * 2 + 1)
        val remove = i - radius; val add = i + radius + 1
        if (remove >= 0) sum -= input[base + remove * stride]
        if (add < length) sum += input[base + add * stride]
      }
    }
  }
}
