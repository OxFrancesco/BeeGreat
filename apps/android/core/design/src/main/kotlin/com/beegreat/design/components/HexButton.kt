package com.beegreat.design.components

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.size
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.scale
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.beegreat.design.Hive
import com.beegreat.design.Motion
import com.beegreat.design.Spacing
import com.beegreat.design.wideHexagonPath

enum class HexButtonVariant {
  Primary,
  Secondary,
}

private val ButtonHeight = 56.dp

/** A wide honeycomb-cell button: flat top and bottom, pointed ends. */
@Composable
fun HexButton(
  label: String,
  onClick: () -> Unit,
  modifier: Modifier = Modifier,
  busy: Boolean = false,
  enabled: Boolean = true,
  variant: HexButtonVariant = HexButtonVariant.Primary,
  icon: (@Composable () -> Unit)? = null,
) {
  val interaction = remember { MutableInteractionSource() }
  val pressed by interaction.collectIsPressedAsState()
  val active = enabled && !busy
  val scale by
    animateFloatAsState(
      if (pressed) 0.99f else 1f,
      tween(if (pressed) Motion.pressIn else Motion.pressOut, easing = Motion.easeOut),
      label = "hexScale",
    )
  val alpha =
    when {
      !enabled && !busy -> 0.55f
      pressed -> 0.85f
      else -> 1f
    }
  val primary = variant == HexButtonVariant.Primary
  Box(
    modifier =
      modifier
        .fillMaxWidth()
        .height(ButtonHeight)
        .graphicsLayer {
          scaleX = scale
          scaleY = scale
          this.alpha = alpha
        }
        .clickable(
          interactionSource = interaction,
          indication = null,
          enabled = active,
          role = Role.Button,
          onClick = onClick,
        ),
    contentAlignment = Alignment.Center,
  ) {
    Canvas(modifier = Modifier.matchParentSize()) {
      val path = wideHexagonPath(size.width, size.height, 8f * density)
      if (primary) {
        drawPath(path, Hive.cacao)
      } else {
        drawPath(path, Hive.comb)
        scale(
          scaleX = (size.width - 3 * density) / size.width,
          scaleY = (size.height - 3 * density) / size.height,
        ) {
          drawPath(path, Hive.amber, style = Stroke(width = 1.5f * density))
        }
      }
    }
    if (busy) {
      CircularProgressIndicator(
        modifier = Modifier.size(22.dp),
        color = if (primary) Hive.cream else Hive.cacao,
        strokeWidth = 2.dp,
      )
    } else {
      Row(
        horizontalArrangement = Arrangement.spacedBy(Spacing.two),
        verticalAlignment = Alignment.CenterVertically,
      ) {
        icon?.invoke()
        Text(
          text = label,
          fontSize = 17.sp,
          fontWeight = FontWeight.SemiBold,
          color = if (primary) Hive.cream else Hive.cacao,
        )
      }
    }
  }
}
