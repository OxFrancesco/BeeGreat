package com.beegreat.app.profile

import android.content.Context
import androidx.browser.customtabs.CustomTabsIntent
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.dp
import androidx.core.net.toUri
import com.beegreat.design.BeeTheme
import com.beegreat.design.Radius
import com.beegreat.design.Spacing
import com.beegreat.design.components.Hairline

/** OAuth hops run in a Custom Tab; the provider redirects to `beegreat://profile` and Convex status flips. */
fun openAuthTab(context: Context, url: String) {
  CustomTabsIntent.Builder().setShowTitle(true).build().launchUrl(context, url.toUri())
}

@Composable
fun SettingsSection(label: String, content: @Composable () -> Unit) {
  Column(verticalArrangement = Arrangement.spacedBy(Spacing.two)) {
    Text(label.uppercase(), style = BeeTheme.typography.smallBold, color = BeeTheme.colors.textSecondary)
    content()
  }
}

@Composable
fun SettingsCard(content: @Composable () -> Unit) {
  val colors = BeeTheme.colors
  Column(
    modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(Radius.card)).background(colors.card).border(Hairline, colors.border, RoundedCornerShape(Radius.card)).padding(Spacing.three),
    verticalArrangement = Arrangement.spacedBy(Spacing.two),
  ) {
    content()
  }
}

@Composable
fun SettingsLink(icon: ImageVector, title: String, subtitle: String, onClick: () -> Unit) {
  val colors = BeeTheme.colors
  Row(
    modifier = Modifier.fillMaxWidth().heightIn(min = 56.dp).clip(RoundedCornerShape(Radius.card)).background(colors.card).border(Hairline, colors.border, RoundedCornerShape(Radius.card)).clickable(onClick = onClick).padding(Spacing.three),
    horizontalArrangement = Arrangement.spacedBy(Spacing.two),
    verticalAlignment = Alignment.CenterVertically,
  ) {
    Box(modifier = Modifier.size(34.dp).background(colors.secondary, CircleShape), contentAlignment = Alignment.Center) {
      Icon(icon, contentDescription = null, tint = colors.secondaryForeground, modifier = Modifier.size(18.dp))
    }
    Column(modifier = Modifier.weight(1f)) {
      Text(title, style = BeeTheme.typography.body, color = colors.text)
      Text(subtitle, style = BeeTheme.typography.small, color = colors.textSecondary)
    }
    Icon(Icons.AutoMirrored.Filled.KeyboardArrowRight, contentDescription = null, tint = colors.textSecondary, modifier = Modifier.size(16.dp))
  }
}

@Composable
fun SettingsToggle(title: String, subtitle: String, checked: Boolean, enabled: Boolean = true, onChange: (Boolean) -> Unit) {
  val colors = BeeTheme.colors
  Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(Spacing.two), verticalAlignment = Alignment.CenterVertically) {
    Column(modifier = Modifier.weight(1f)) {
      Text(title, style = BeeTheme.typography.body, color = colors.text)
      Text(subtitle, style = BeeTheme.typography.small, color = colors.textSecondary)
    }
    Switch(checked = checked, onCheckedChange = onChange, enabled = enabled, colors = SwitchDefaults.colors(checkedTrackColor = colors.primary, checkedThumbColor = colors.primaryForeground))
  }
}

@Composable
fun OutlineButton(label: String, destructive: Boolean = false, enabled: Boolean = true, modifier: Modifier = Modifier, onClick: () -> Unit) {
  val colors = BeeTheme.colors
  Box(
    modifier = modifier.heightIn(min = 44.dp).clip(CircleShape).border(Hairline, if (destructive) colors.destructive else colors.border, CircleShape).clickable(enabled = enabled, onClick = onClick).padding(horizontal = Spacing.three),
    contentAlignment = Alignment.Center,
  ) {
    Text(label, style = BeeTheme.typography.smallBold, color = if (!enabled) colors.textSecondary else if (destructive) colors.destructive else colors.text)
  }
}

@Composable
fun FilledButton(label: String, enabled: Boolean = true, modifier: Modifier = Modifier, color: Color? = null, onClick: () -> Unit) {
  val colors = BeeTheme.colors
  Box(
    modifier = modifier.heightIn(min = 44.dp).clip(CircleShape).background(if (enabled) color ?: colors.primary else colors.backgroundElement).clickable(enabled = enabled, onClick = onClick).padding(horizontal = Spacing.three),
    contentAlignment = Alignment.Center,
  ) {
    Text(label, style = BeeTheme.typography.smallBold, color = if (enabled) (if (color != null) Color.White else colors.primaryForeground) else colors.textSecondary)
  }
}
