package com.beegreat.design.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import com.beegreat.design.BeeTheme
import com.beegreat.design.Radius
import com.beegreat.design.Spacing

/**
 * Minimal add flow: a plus row that turns into a text field when tapped.
 * Done creates, losing focus dismisses.
 */
@Composable
fun AddRow(
  label: String,
  onSubmit: (String) -> Unit,
  modifier: Modifier = Modifier,
  dashed: Boolean = false,
  compact: Boolean = false,
  startActive: Boolean = false,
  onDismiss: () -> Unit = {},
) {
  val colors = BeeTheme.colors
  var active by rememberSaveable { mutableStateOf(startActive) }
  var text by rememberSaveable { mutableStateOf("") }
  val shape = RoundedCornerShape(if (compact) Radius.compact else Radius.card)
  val minHeight = if (compact) 40.dp else 56.dp
  val iconSize = if (compact) 15.dp else 18.dp

  val frame =
    if (dashed) {
      Modifier.drawBehind {
        drawRoundRect(
          color = colors.border,
          cornerRadius = CornerRadius(shape.topStart.toPx(size, this)),
          style =
            Stroke(
              width = 1.5.dp.toPx(),
              pathEffect = PathEffect.dashPathEffect(floatArrayOf(6.dp.toPx(), 4.dp.toPx())),
            ),
        )
      }
    } else {
      Modifier.border(Hairline, colors.border, shape)
    }

  fun dismiss() {
    active = false
    onDismiss()
  }

  fun submit() {
    val title = text.trim()
    text = ""
    dismiss()
    if (title.isNotEmpty()) onSubmit(title)
  }

  if (active) {
    val focus = remember { FocusRequester() }
    LaunchedEffect(Unit) { focus.requestFocus() }
    Row(
      modifier =
        modifier
          .fillMaxWidth()
          .heightIn(min = minHeight)
          .background(colors.card, shape)
          .then(frame)
          .padding(horizontal = Spacing.three),
      horizontalArrangement = Arrangement.spacedBy(Spacing.three),
      verticalAlignment = Alignment.CenterVertically,
    ) {
      Icon(Icons.Filled.Add, contentDescription = null, tint = colors.textSecondary, modifier = Modifier.size(iconSize))
      BasicTextField(
        value = text,
        onValueChange = { text = it },
        modifier =
          Modifier.weight(1f)
            .focusRequester(focus)
            .onFocusChanged { if (!it.isFocused && active) dismiss() }
            .padding(vertical = if (compact) Spacing.two else Spacing.three),
        textStyle = (if (compact) BeeTheme.typography.small else BeeTheme.typography.body).copy(color = colors.text),
        cursorBrush = SolidColor(colors.text),
        singleLine = true,
        keyboardOptions = KeyboardOptions(imeAction = ImeAction.Done),
        keyboardActions = KeyboardActions(onDone = { submit() }),
        decorationBox = { inner ->
          if (text.isEmpty()) {
            Text(
              text = label,
              style = if (compact) BeeTheme.typography.small else BeeTheme.typography.body,
              color = colors.textSecondary,
            )
          }
          inner()
        },
      )
    }
    return
  }

  Row(
    modifier =
      modifier
        .fillMaxWidth()
        .heightIn(min = minHeight)
        .then(frame)
        .clickable(onClickLabel = label) { active = true }
        .padding(horizontal = Spacing.three),
    horizontalArrangement = Arrangement.spacedBy(Spacing.three),
    verticalAlignment = Alignment.CenterVertically,
  ) {
    Icon(Icons.Filled.Add, contentDescription = null, tint = colors.textSecondary, modifier = Modifier.size(iconSize))
    Text(
      text = label,
      style = if (compact) BeeTheme.typography.small else BeeTheme.typography.body,
      color = colors.textSecondary,
    )
  }
}
