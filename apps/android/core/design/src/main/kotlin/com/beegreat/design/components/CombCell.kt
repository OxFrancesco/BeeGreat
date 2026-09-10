package com.beegreat.design.components

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.clipPath
import androidx.compose.ui.unit.Dp
import com.beegreat.design.Hive
import com.beegreat.design.Motion
import com.beegreat.design.hexagonPath
import kotlin.math.max

/**
 * One honeycomb cell that fills with honey from the bottom as `progress`
 * (0..1) grows. Goals are combs; work fills them.
 */
@Composable
fun CombCell(size: Dp, progress: Float, modifier: Modifier = Modifier) {
  val clamped = progress.coerceIn(0f, 1f)
  val animated by
    animateFloatAsState(
      targetValue = clamped,
      animationSpec = Motion.progressSpec(),
      label = "combProgress",
    )
  Canvas(modifier = modifier.size(size)) {
    val px = size.toPx()
    val strokeWidth = max(1.5f * density, px / 24)
    val path = hexagonPath(px, strokeWidth / 2, px / 8)
    drawPath(path, Hive.wax)
    clipPath(path) {
      drawRect(
        color = Hive.honey,
        topLeft = Offset(0f, px * (1 - animated)),
        size = Size(px, px),
      )
    }
    drawPath(path, Hive.honey, style = Stroke(width = strokeWidth))
  }
}
