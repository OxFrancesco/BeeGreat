package com.beegreat.app.voice

import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.beegreat.design.BeeTheme
import com.beegreat.design.Motion

private data class Honey(val glow: Color, val core: List<Color>, val rim: Color, val ripple: Color)

private val LIGHT = Honey(Color(0x80F2A93B), listOf(Color(0xFFFFF4DE), Color(0xFFFFDFB5), Color(0xFFEFA94F)), Color(0x59644A40), Color(0xFFEFA94F))
private val DARK = Honey(Color(0x59E8A765), listOf(Color(0xFFFFE9CB), Color(0xFFE8A765), Color(0xFF7A4E22)), Color(0x66FFE0C2), Color(0xFFFFE0C2))

/**
 * The Bee orb: a drop of honey that is the agent itself. Breathes while idle,
 * ripples while listening, glows while speaking. Port of `voice-orb.tsx`.
 */
@Composable
fun VoiceOrb(state: OrbState, onClick: () -> Unit, size: Dp = 208.dp, enabled: Boolean = true, modifier: Modifier = Modifier) {
  val honey = if (BeeTheme.colors.isDark) DARK else LIGHT
  val reduced = Motion.reducedMotion()
  val transition = rememberInfiniteTransition(label = "orb")
  val breathe by transition.animateFloat(1f, if (reduced || state != OrbState.Idle) 1f else 1.04f, infiniteRepeatable(tween(2400, easing = Motion.easeInOut), RepeatMode.Reverse), label = "breathe")
  val glow by transition.animateFloat(1f, if (reduced || state != OrbState.Speaking) 1f else 1.25f, infiniteRepeatable(tween(700, easing = Motion.easeInOut), RepeatMode.Reverse), label = "glow")
  val ripple by transition.animateFloat(0f, if (reduced || state != OrbState.Listening) 0f else 1f, infiniteRepeatable(tween(1400, easing = Motion.easeOut), RepeatMode.Restart), label = "ripple")
  val spin by transition.animateFloat(0f, if (reduced || state != OrbState.Thinking) 0f else 360f, infiniteRepeatable(tween(1800)), label = "spin")
  val label =
    when (state) {
      OrbState.Idle -> "Talk to Bee"
      OrbState.Listening -> "Listening, tap to stop"
      OrbState.Thinking -> "Bee is thinking"
      OrbState.Speaking -> "Bee is speaking"
    }

  Canvas(modifier = modifier.size(size).semantics { contentDescription = label }.clickable(enabled = enabled, onClick = onClick)) {
    val center = Offset(this.size.width / 2, this.size.height / 2)
    val coreRadius = this.size.minDimension * 64f / 208f * breathe
    drawCircle(Brush.radialGradient(listOf(honey.glow, Color.Transparent), center, coreRadius * 1.9f * glow), coreRadius * 1.9f * glow, center)
    if (ripple > 0f) {
      val r = coreRadius * (1f + ripple * 0.8f)
      drawCircle(honey.ripple.copy(alpha = (1f - ripple) * 0.6f), r, center, style = Stroke(3f * density))
    }
    if (state == OrbState.Thinking) {
      drawArc(honey.ripple.copy(alpha = 0.8f), spin, 90f, false, Offset(center.x - coreRadius * 1.25f, center.y - coreRadius * 1.25f), androidx.compose.ui.geometry.Size(coreRadius * 2.5f, coreRadius * 2.5f), style = Stroke(3f * density))
    }
    drawCircle(Brush.radialGradient(honey.core, Offset(center.x - coreRadius * 0.3f, center.y - coreRadius * 0.35f), coreRadius * 1.3f), coreRadius, center)
    drawCircle(honey.rim, coreRadius, center, style = Stroke(1.5f * density))
  }
}
