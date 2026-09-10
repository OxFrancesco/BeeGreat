package com.beegreat.design.components

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.beegreat.design.BeeTheme
import com.beegreat.design.Motion
import com.beegreat.design.Radius
import com.beegreat.design.Spacing

/** Hairline width, the Android stand-in for `StyleSheet.hairlineWidth`. */
val Hairline: Dp = 0.75.dp

/**
 * Base card recipe from the design system: `card` fill, hairline `border`,
 * radius 16, padding `Spacing.three`. Pressable cards dim to 0.72 and scale to
 * 0.98 while held.
 */
@Composable
fun BeeCard(
  modifier: Modifier = Modifier,
  onClick: (() -> Unit)? = null,
  onLongClick: (() -> Unit)? = null,
  padding: Dp = Spacing.three,
  content: @Composable ColumnScope.() -> Unit,
) {
  val colors = BeeTheme.colors
  val shape = RoundedCornerShape(Radius.card)
  val interaction = remember { MutableInteractionSource() }
  val pressed by interaction.collectIsPressedAsState()
  val scale by
    animateFloatAsState(
      targetValue = if (pressed) 0.98f else 1f,
      animationSpec = tween(if (pressed) Motion.pressIn else Motion.pressOut, easing = Motion.easeOut),
      label = "cardScale",
    )
  val alpha by
    animateFloatAsState(
      targetValue = if (pressed) 0.72f else 1f,
      animationSpec = tween(if (pressed) Motion.pressIn else Motion.pressOut, easing = Motion.easeOut),
      label = "cardAlpha",
    )
  val clickable =
    if (onClick != null || onLongClick != null) {
      Modifier.combinedClickable(
        interactionSource = interaction,
        indication = null,
        onClick = { onClick?.invoke() },
        onLongClick = onLongClick,
      )
    } else {
      Modifier
    }
  Column(
    modifier =
      modifier
        .fillMaxWidth()
        .graphicsLayer {
          scaleX = scale
          scaleY = scale
          this.alpha = alpha
        }
        .clip(shape)
        .background(colors.card, shape)
        .border(Hairline, colors.border, shape)
        .then(clickable)
        .padding(padding),
    verticalArrangement = Arrangement.spacedBy(Spacing.two),
    content = content,
  )
}

/** List row card: leading glyph, title plus one-line metadata, trailing chevron. */
@Composable
fun BeeRowCard(
  modifier: Modifier = Modifier,
  onClick: (() -> Unit)? = null,
  onLongClick: (() -> Unit)? = null,
  content: @Composable RowScope.() -> Unit,
) {
  BeeCard(modifier = modifier, onClick = onClick, onLongClick = onLongClick) {
    Row(
      modifier = Modifier.fillMaxWidth(),
      horizontalArrangement = Arrangement.spacedBy(Spacing.three),
      verticalAlignment = Alignment.CenterVertically,
      content = content,
    )
  }
}
