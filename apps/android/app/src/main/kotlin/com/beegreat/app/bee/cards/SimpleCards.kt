package com.beegreat.app.bee.cards

import android.content.Intent
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.OpenInNew
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.ContentCopy
import androidx.compose.material.icons.filled.Download
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.core.net.toUri
import coil3.compose.AsyncImage
import com.beegreat.app.bee.copyToClipboard
import com.beegreat.contract.BeeUiComponent
import com.beegreat.contract.bookmarkHost
import com.beegreat.design.BeeTheme
import com.beegreat.design.Hive
import com.beegreat.design.Radius
import com.beegreat.design.Spacing
import com.beegreat.design.components.BeeCard
import com.beegreat.design.components.Hairline
import kotlinx.coroutines.delay

fun openUrl(context: android.content.Context, url: String) {
  runCatching { context.startActivity(Intent(Intent.ACTION_VIEW, url.toUri())) }
}

@Composable
fun MetricCard(component: BeeUiComponent.Metric) {
  val colors = BeeTheme.colors
  BeeCard {
    Text(component.label, style = BeeTheme.typography.small, color = colors.textSecondary)
    Row(horizontalArrangement = Arrangement.spacedBy(Spacing.two), verticalAlignment = Alignment.Bottom) {
      Text(component.value, style = BeeTheme.typography.subtitle.copy(fontFeatureSettings = "tnum"), color = colors.text)
      component.delta?.let { Text(it, style = BeeTheme.typography.small, color = colors.textSecondary, modifier = Modifier.padding(bottom = 8.dp)) }
    }
  }
}

/** Labels sit above their bars so long goal names never truncate. */
@Composable
fun BarChartCard(component: BeeUiComponent.Chart) {
  val colors = BeeTheme.colors
  val max = maxOf(component.data.maxOf { it.value }, 1.0)
  BeeCard {
    Text(component.title, style = BeeTheme.typography.smallBold, color = colors.text)
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.two)) {
      for (bar in component.data) {
        Column(verticalArrangement = Arrangement.spacedBy(Spacing.half)) {
          Text(bar.label, style = BeeTheme.typography.small, color = colors.textSecondary, maxLines = 1, overflow = TextOverflow.Ellipsis)
          Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.two)) {
            Box(modifier = Modifier.weight(1f).height(10.dp).clip(CircleShape).background(colors.backgroundElement)) {
              Box(modifier = Modifier.fillMaxWidth(maxOf((bar.value / max).toFloat(), 0.02f)).height(10.dp).background(Hive.honey, CircleShape))
            }
            Text(
              text = if (bar.value == bar.value.toLong().toDouble()) bar.value.toLong().toString() else bar.value.toString(),
              style = BeeTheme.typography.small.copy(fontFeatureSettings = "tnum"),
              color = colors.text,
            )
          }
        }
      }
    }
    component.unit?.let { Text(it, style = BeeTheme.typography.small, color = colors.textSecondary) }
  }
}

/** The dense summary card: honey fill, no border. */
@Composable
fun HighlightCard(component: BeeUiComponent.Highlight) {
  val colors = BeeTheme.colors
  Column(
    modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(Radius.card)).background(colors.secondary).padding(Spacing.three),
    verticalArrangement = Arrangement.spacedBy(Spacing.two),
  ) {
    Text(component.title, style = BeeTheme.typography.smallBold, color = colors.secondaryForeground)
    Text(component.body, style = BeeTheme.typography.body, color = colors.secondaryForeground)
  }
}

/** One row: favicon, single-line title, open glyph; the note (or host) below. The whole card opens the URL. */
@Composable
fun BookmarkCard(component: BeeUiComponent.Bookmark) {
  val colors = BeeTheme.colors
  val context = LocalContext.current
  val host = bookmarkHost(component.url)
  BeeCard(onClick = { openUrl(context, component.url) }) {
    Row(horizontalArrangement = Arrangement.spacedBy(Spacing.two), verticalAlignment = Alignment.CenterVertically) {
      AsyncImage(
        model = "https://www.google.com/s2/favicons?domain=$host&sz=64",
        contentDescription = null,
        modifier = Modifier.size(22.dp).clip(RoundedCornerShape(6.dp)),
      )
      Text(component.title, style = BeeTheme.typography.body, color = colors.text, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f))
      Icon(Icons.AutoMirrored.Filled.OpenInNew, contentDescription = "Open", tint = colors.textSecondary, modifier = Modifier.size(14.dp))
    }
    Text(component.note ?: host, style = BeeTheme.typography.small, color = colors.textSecondary, maxLines = 2, overflow = TextOverflow.Ellipsis)
  }
}

/** Full-width cover preview, optional title, then Copy and Open actions. */
@Composable
fun GeneratedImageCard(component: BeeUiComponent.Image) {
  val colors = BeeTheme.colors
  val context = LocalContext.current
  var copied by remember { mutableStateOf(false) }
  LaunchedEffect(copied) {
    if (copied) {
      delay(1500)
      copied = false
    }
  }
  BeeCard(padding = 0.dp) {
    AsyncImage(
      model = component.url,
      contentDescription = component.alt,
      contentScale = ContentScale.Crop,
      modifier = Modifier.fillMaxWidth().aspectRatio(1f).background(colors.backgroundElement),
    )
    Column(modifier = Modifier.padding(Spacing.three), verticalArrangement = Arrangement.spacedBy(Spacing.two)) {
      component.title?.let { Text(it, style = BeeTheme.typography.smallBold, color = colors.text) }
      Row(horizontalArrangement = Arrangement.spacedBy(Spacing.two)) {
        ActionChip(if (copied) Icons.Filled.Check else Icons.Filled.ContentCopy, if (copied) "Copied" else "Copy link") {
          copyToClipboard(context, component.url)
          copied = true
        }
        ActionChip(Icons.Filled.Download, "Open") { openUrl(context, component.url) }
      }
    }
  }
}

@Composable
private fun ActionChip(icon: androidx.compose.ui.graphics.vector.ImageVector, label: String, onClick: () -> Unit) {
  val colors = BeeTheme.colors
  Row(
    modifier =
      Modifier.heightIn(min = 44.dp)
        .clip(CircleShape)
        .background(colors.backgroundElement)
        .clickable(onClick = onClick)
        .padding(horizontal = Spacing.three),
    horizontalArrangement = Arrangement.spacedBy(Spacing.one),
    verticalAlignment = Alignment.CenterVertically,
  ) {
    Icon(icon, contentDescription = null, tint = colors.text, modifier = Modifier.size(14.dp))
    Text(label, style = BeeTheme.typography.smallBold, color = colors.text)
  }
}

/** Yes/No that reply into the chat. */
@Composable
fun ConfirmCard(component: BeeUiComponent.Confirm, onReply: (String) -> Unit) {
  val colors = BeeTheme.colors
  Column(
    modifier =
      Modifier.fillMaxWidth()
        .clip(RoundedCornerShape(Radius.card))
        .background(colors.card)
        .border(Hairline, colors.destructive, RoundedCornerShape(Radius.card))
        .padding(Spacing.three),
    verticalArrangement = Arrangement.spacedBy(Spacing.two),
  ) {
    Text("Needs your confirmation", style = BeeTheme.typography.smallBold, color = colors.destructive)
    Text(component.summary, style = BeeTheme.typography.body, color = colors.text)
    ConfirmRow(onYes = { onReply("Yes") }, onNo = { onReply("No") })
  }
}

@Composable
fun ConfirmRow(onYes: () -> Unit, onNo: () -> Unit, yesLabel: String = "Yes", noLabel: String = "No", enabled: Boolean = true) {
  val colors = BeeTheme.colors
  Row(horizontalArrangement = Arrangement.spacedBy(Spacing.two)) {
    Box(
      modifier = Modifier.weight(1f).heightIn(min = 44.dp).clip(CircleShape).background(colors.primary).clickable(enabled = enabled, onClick = onYes),
      contentAlignment = Alignment.Center,
    ) {
      Text(yesLabel, style = BeeTheme.typography.smallBold, color = colors.primaryForeground)
    }
    Box(
      modifier =
        Modifier.weight(1f)
          .heightIn(min = 44.dp)
          .clip(CircleShape)
          .border(Hairline, colors.border, CircleShape)
          .clickable(enabled = enabled, onClick = onNo),
      contentAlignment = Alignment.Center,
    ) {
      Text(noLabel, style = BeeTheme.typography.smallBold, color = colors.text)
    }
  }
}

