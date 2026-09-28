package app.pecu.dither

import android.animation.ValueAnimator
import androidx.compose.animation.core.*
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.clickable
import androidx.compose.foundation.hoverable
import androidx.compose.foundation.interaction.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.*
import androidx.compose.ui.semantics.*
import androidx.compose.ui.unit.*
import kotlin.math.*

enum class AvatarMirror { Auto, Horizontal, Vertical }
enum class GradientDirection { Up, Down, Left, Right }
sealed interface PixelColor {
  data class Named(val color: DitherColor) : PixelColor
  data class Hue(val degrees: Float) : PixelColor { init { require(degrees.isFinite()) } }
}
internal fun PixelColor.fill(): Color = when(this) {
  is PixelColor.Named -> color.fill
  is PixelColor.Hue -> Color.hsl(((degrees % 360) + 360) % 360, .85f, .58f)
}
internal fun fnv1a(text: String): Int { var hash = 0x811c9dc5.toInt(); text.forEach { hash = (hash xor it.code) * 0x01000193 }; return hash }
internal class XorShift(seed: Int) {
  private var state = if (seed == 0) 0x9e3779b9.toInt() else seed
  fun next(): Double { state = state xor (state shl 13); state = state xor (state ushr 17); state = state xor (state shl 5); return (state.toLong() and 0xffffffffL) / 4294967296.0 }
}
internal data class AvatarModel(val on: BooleanArray, val density: DoubleArray, val hue: Float)
internal fun avatarModel(name: String, hue: Float?, mirror: AvatarMirror): AvatarModel {
  val random = XorShift(fnv1a(name)); val bits = BooleanArray(32) { random.next() < .5 }
  val drawnVertical = random.next() < .5; val drawnHue = floor(random.next() * 180).toFloat() * 2
  val halfDensity = DoubleArray(32) { .55 + random.next() * .45 }
  val vertical = if (mirror == AvatarMirror.Auto) drawnVertical else mirror == AvatarMirror.Vertical
  fun index(n: Int): Int { val r = n / 8; val c = n % 8; return if (vertical) min(r, 7 - r) * 8 + c else r * 4 + min(c, 7 - c) }
  return AvatarModel(BooleanArray(64) { bits[index(it)] }, DoubleArray(64) { halfDensity[index(it)] }, hue ?: drawnHue)
}

@Composable fun DitherAvatar(name: String, modifier: Modifier = Modifier, hue: Float? = null, mirror: AvatarMirror = AvatarMirror.Auto, bloom: BloomConfig? = null, animate: Boolean = true, animationDuration: Int = 600, replayToken: Int = 0, reducedMotion: Boolean = false) {
  val model = remember(name, hue, mirror) { avatarModel(name, hue, mirror) }
  val progress = entranceProgress(listOf(name, hue, mirror), ChartOptions(animate = animate, animationDuration = animationDuration, replayToken = replayToken, reducedMotion = reducedMotion))
  PixelCanvas(modifier.size(64.dp).semantics { contentDescription = "$name avatar" }, 32, 32, bloom, { listOf(name, hue, mirror, progress.value) }) { buffer ->
    val rgb = PixelColor.Hue(model.hue).fill().toArgb(); val p = easeOut(progress.value.toDouble())
    for (r in 0..7) for (c in 0..7) {
      val i = r * 8 + c; if (!model.on[i]) continue
      val cellAlpha = ((p - threshold(c, r) * .7) / .3).coerceIn(0.0, 1.0)
      val density = model.density[i]; val base = .35 + .65 * density
      for (py in 0..3) for (px in 0..3) {
        val x = c * 4 + px; val y = r * 4 + py
        buffer.put(x, y, rgb, (if (density > threshold(x, y)) base else base * .35) * cellAlpha)
      }
    }
  }
}

@Composable fun DitherGradient(from: PixelColor, modifier: Modifier = Modifier, to: PixelColor? = null, direction: GradientDirection = GradientDirection.Up, cell: Float = 3f, opacity: Float = 1f, bloom: BloomConfig? = null) {
  require(cell.isFinite() && cell > 0 && opacity in 0f..1f)
  BoxWithConstraints(modifier) {
    val cols = (maxWidth.value / cell).roundToInt().coerceIn(4, 960); val rows = (maxHeight.value / cell).roundToInt().coerceIn(4, 600)
    val revision = listOf(from, to, direction, opacity)
    PixelCanvas(Modifier.fillMaxSize(), cols, rows, bloom, { revision }) { buffer ->
      val rgb = from.fill().toArgb(); val end = to?.fill()?.toArgb()
      for (y in 0 until rows) for (x in 0 until cols) {
        val t = when(direction) { GradientDirection.Up -> 1 - (y + .5) / rows; GradientDirection.Down -> (y + .5) / rows; GradientDirection.Left -> 1 - (x + .5) / cols; GradientDirection.Right -> (x + .5) / cols }
        val density = 1 - t; val lit = density > threshold(x, y)
        if (end != null) buffer.put(x, y, if (lit) rgb else end, opacity.toDouble())
        else buffer.put(x, y, rgb, (if (lit) .35 + .65 * density else .12 * density) * opacity)
      }
    }
  }
}

@Composable fun DitherButton(onClick: () -> Unit, modifier: Modifier = Modifier, color: PixelColor = PixelColor.Named(DitherColor.Blue), variant: AreaVariant = AreaVariant.Gradient, bloom: BloomConfig? = null, enabled: Boolean = true, content: @Composable RowScope.() -> Unit) {
  val interaction = remember { MutableInteractionSource() }
  val pressed by interaction.collectIsPressedAsState(); val hovered by interaction.collectIsHoveredAsState()
  val intensity = animateFloatAsState(if (!enabled) 0f else if (pressed) 1.5f else if (hovered) 1f else 0f, tween(if (ValueAnimator.areAnimatorsEnabled()) 160 else 0), label = "Dither button")
  Box(modifier.heightIn(min = 48.dp).clip(RoundedCornerShape(8.dp)).alpha(if (enabled) 1f else .4f).hoverable(interaction, enabled).clickable(interactionSource = interaction, indication = null, enabled = enabled, role = Role.Button, onClick = onClick), contentAlignment = Alignment.Center) {
    BoxWithConstraints(Modifier.matchParentSize()) {
      val cols = (maxWidth.value / 2).roundToInt().coerceIn(4, 520); val rows = (maxHeight.value / 2).roundToInt().coerceIn(4, 200)
      PixelCanvas(Modifier.fillMaxSize(), cols, rows, bloom, { listOf(intensity.value, color, variant) }) { buffer ->
        val rgb = color.fill().toArgb(); val lift = intensity.value
        for (y in 0 until rows) for (x in 0 until cols) {
          val density = when(variant) { AreaVariant.Gradient -> .25 + .75 * ((y + .5) / rows); AreaVariant.Dotted -> .5; else -> .75 }
          if (variant == AreaVariant.Hatched && ((x + y) and 3) >= 2) continue
          val lit = variant == AreaVariant.Solid || density > threshold(x, y) - .1 * lift - if (variant == AreaVariant.Dotted) .12 else 0.0
          if (variant == AreaVariant.Dotted && !lit) continue
          val k = (.3 + density * .7) * (1 + .22 * lift)
          buffer.put(x, y, rgb, if (lit) k else k * .4)
        }
        for (x in 0 until cols) { buffer.put(x, 0, rgb, .5 + .25 * lift); buffer.put(x, rows - 1, rgb, .5 + .25 * lift) }
        for (y in 0 until rows) { buffer.put(0, y, rgb, .5 + .25 * lift); buffer.put(cols - 1, y, rgb, .5 + .25 * lift) }
      }
    }
    Row(Modifier.padding(horizontal = 18.dp, vertical = 12.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp), content = content)
  }
}

@Composable private fun PixelCanvas(modifier: Modifier, cols: Int, rows: Int, bloom: BloomConfig?, revision: () -> Any, paint: (PixelBuffer) -> Unit) {
  val buffer = remember(cols, rows) { PixelBuffer(cols, rows) }
  val glow = remember(buffer, bloom != null) { if (bloom != null) BloomPainter(cols, rows) else null }
  val cache = remember(buffer) { arrayOfNulls<Any>(1) }
  Canvas(modifier) {
    val key = revision()
    if (key != cache[0]) { buffer.clear(); paint(buffer); buffer.upload(); cache[0] = key }
    val target = IntSize(size.width.roundToInt(), size.height.roundToInt())
    drawImage(buffer.bitmap.asImageBitmap(), dstSize = target, filterQuality = FilterQuality.None)
    bloom?.let {
      drawImage(glow!!.paint(buffer, it, key).asImageBitmap(), dstSize = target, alpha = it.opacity, filterQuality = FilterQuality.Low,
        blendMode = when(it.blend) { BloomBlend.PlusLighter -> BlendMode.Plus; BloomBlend.Screen -> BlendMode.Screen; BloomBlend.Lighten -> BlendMode.Lighten })
    }
  }
}
