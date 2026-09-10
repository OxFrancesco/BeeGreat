package com.beegreat.design.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowLeft
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextOverflow
import com.beegreat.design.BeeTheme
import com.beegreat.design.Spacing

/**
 * Screen title. Root screens get a large standalone title; screens with
 * `onBack` get a compact bar: back arrow, title, optional trailing action.
 */
@Composable
fun ScreenHeader(
  title: String,
  modifier: Modifier = Modifier,
  onBack: (() -> Unit)? = null,
  trailing: @Composable RowScope.() -> Unit = {},
) {
  val colors = BeeTheme.colors
  if (onBack == null) {
    Box(modifier = modifier.padding(vertical = Spacing.two)) {
      Text(
        text = title,
        style = BeeTheme.typography.subtitle,
        color = colors.text,
        maxLines = 2,
        overflow = TextOverflow.Ellipsis,
      )
    }
    return
  }
  Row(
    modifier = modifier.padding(vertical = Spacing.two),
    horizontalArrangement = Arrangement.spacedBy(Spacing.three),
    verticalAlignment = Alignment.CenterVertically,
  ) {
    IconButton(onClick = onBack) {
      Icon(
        imageVector = Icons.AutoMirrored.Filled.KeyboardArrowLeft,
        contentDescription = "Go back",
        tint = colors.text,
      )
    }
    Text(
      text = title,
      modifier = Modifier.weight(1f),
      style = BeeTheme.typography.barTitle,
      color = colors.text,
      maxLines = 1,
      overflow = TextOverflow.Ellipsis,
    )
    trailing()
  }
}

/** Small secondary label that opens a section ("Bee Healthy", "Active goals"). */
@Composable
fun SectionLabel(text: String, modifier: Modifier = Modifier) {
  Text(
    text = text,
    modifier = modifier,
    style = BeeTheme.typography.smallBold,
    color = BeeTheme.colors.textSecondary,
  )
}
