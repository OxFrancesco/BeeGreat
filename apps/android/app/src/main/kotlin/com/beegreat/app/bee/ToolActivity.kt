package com.beegreat.app.bee

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
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
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.ContentCopy
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material.icons.filled.KeyboardArrowUp
import androidx.compose.material.icons.filled.Warning
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.beegreat.contract.ToolActivityState
import com.beegreat.contract.getToolCopy
import com.beegreat.design.BeeTheme
import com.beegreat.design.Motion
import com.beegreat.design.Radius
import com.beegreat.design.Spacing
import com.beegreat.design.components.Hairline
import com.beegreat.flue.FluePart
import kotlinx.coroutines.delay
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonPrimitive

private data class Palette(val accent: Color, val solid: Color, val surface: Color, val border: Color)

private val SPECIALIST_PALETTES =
  mapOf(
    "Devin" to Palette(Color(0xFFF2765A), Color(0xFFD85238), Color(0x1AF2765A), Color(0x66F2765A)),
    "Google Health" to Palette(Color(0xFF39C9AA), Color(0xFF08745F), Color(0x1A16A88A), Color(0x6616A88A)),
    "Web3" to Palette(Color(0xFFA991FF), Color(0xFF6248C6), Color(0x1A8066E8), Color(0x668066E8)),
  )
private val DEFAULT_SPECIALIST_PALETTE = Palette(Color(0xFFFAB52A), Color(0xFF845800), Color(0x1AD99100), Color(0x66D99100))

private val prettyJson = Json { prettyPrint = true }

private fun formatToolValue(value: JsonElement?): String =
  when (value) {
    null -> "—"
    is JsonPrimitive -> if (value.isString) value.content else value.toString()
    else -> prettyJson.encodeToString(JsonElement.serializer(), value)
  }

/** Text that breathes while a tool runs: the port of `Shimmer`. */
@Composable
fun ShimmerText(text: String, color: Color, style: androidx.compose.ui.text.TextStyle) {
  val transition = rememberInfiniteTransition(label = "shimmer")
  val alpha by
    transition.animateFloat(
      initialValue = 0.45f,
      targetValue = 1f,
      animationSpec = infiniteRepeatable(tween(900, easing = Motion.easeInOut), RepeatMode.Reverse),
      label = "shimmerAlpha",
    )
  Text(text, style = style, color = color, modifier = Modifier.alpha(alpha), maxLines = 1, overflow = TextOverflow.Ellipsis)
}

/**
 * A human-readable, expandable trace of one tool call. The summary stays
 * quiet; the disclosure shows the complete input and result. Specialist
 * activity gets its own accent and a "Power-up" tag when relevant.
 */
@Composable
fun ToolActivity(part: FluePart.Tool) {
  val colors = BeeTheme.colors
  val context = LocalContext.current
  var expanded by remember { mutableStateOf(false) }
  var copied by remember { mutableStateOf(false) }
  LaunchedEffect(copied) {
    if (copied) {
      delay(1500)
      copied = false
    }
  }
  val state =
    when (part.state) {
      "input-available" -> ToolActivityState.Running
      "output-error" -> ToolActivityState.Error
      else -> ToolActivityState.Done
    }
  val copy = getToolCopy(part.toolName, state, part.input)
  val identity = copy.specialist ?: copy.powerup
  val running = state == ToolActivityState.Running
  val error = state == ToolActivityState.Error
  val palette = identity?.let { SPECIALIST_PALETTES[it] ?: DEFAULT_SPECIALIST_PALETTE }
  val borderColor = if (error) colors.destructive else palette?.border ?: colors.border
  val shape = RoundedCornerShape(Radius.compact)

  Column(
    modifier = Modifier.fillMaxWidth().clip(shape).background(palette?.surface ?: colors.card).border(Hairline, borderColor, shape),
  ) {
    Row(
      modifier = Modifier.fillMaxWidth().clickable { expanded = !expanded }.padding(horizontal = Spacing.two + Spacing.half, vertical = Spacing.two),
      horizontalArrangement = Arrangement.spacedBy(Spacing.two),
      verticalAlignment = Alignment.CenterVertically,
    ) {
      Box(
        modifier = Modifier.size(22.dp).background(palette?.solid ?: colors.secondary, CircleShape),
        contentAlignment = Alignment.Center,
      ) {
        Icon(
          if (error) Icons.Filled.Warning else Icons.Filled.AutoAwesome,
          contentDescription = null,
          tint = if (error) colors.destructive else if (palette != null) Color.White else colors.secondaryForeground,
          modifier = Modifier.size(11.dp),
        )
      }
      Column(modifier = Modifier.weight(1f)) {
        if (identity != null && palette != null) {
          Text(identity, style = BeeTheme.typography.smallBold, color = palette.accent)
        }
        val labelColor = if (error) colors.destructive else colors.textSecondary
        if (running) ShimmerText(copy.label, labelColor, BeeTheme.typography.small)
        else Text(copy.label, style = BeeTheme.typography.small, color = labelColor, maxLines = 1, overflow = TextOverflow.Ellipsis)
      }
      if (copy.powerup != null && palette != null) {
        Text(
          "Power-up",
          style = BeeTheme.typography.small.copy(fontSize = 11.sp),
          color = Color.White,
          modifier = Modifier.background(palette.solid, CircleShape).padding(horizontal = Spacing.two, vertical = 2.dp),
        )
      }
      Icon(
        if (expanded) Icons.Filled.KeyboardArrowUp else Icons.Filled.KeyboardArrowDown,
        contentDescription = if (expanded) "Collapse" else "Expand",
        tint = colors.textSecondary,
        modifier = Modifier.size(16.dp),
      )
    }
    AnimatedVisibility(visible = expanded) {
      Column(modifier = Modifier.fillMaxWidth().padding(Spacing.two + Spacing.half), verticalArrangement = Arrangement.spacedBy(Spacing.two)) {
        HorizontalDivider(color = borderColor, thickness = Hairline)
        ToolDetail("Tool", part.toolName)
        ToolDetail("Input", formatToolValue(part.input))
        if (error) ToolDetail("Error", part.errorText ?: "The tool call failed.")
        else ToolDetail("Result", if (running) "Waiting for the result…" else formatToolValue(part.output))
        Row(
          modifier =
            Modifier.heightIn(min = 32.dp)
              .clip(CircleShape)
              .background(colors.card)
              .border(Hairline, colors.border, CircleShape)
              .clickable {
                val result = if (error) "Error:\n${part.errorText ?: "The tool call failed."}" else "Result:\n${if (running) "Waiting for the result…" else formatToolValue(part.output)}"
                copyToClipboard(context, listOf("Tool: ${part.toolName}", "Input:\n${formatToolValue(part.input)}", result).joinToString("\n\n"))
                copied = true
              }
              .padding(horizontal = Spacing.two + Spacing.half),
          horizontalArrangement = Arrangement.spacedBy(Spacing.one),
          verticalAlignment = Alignment.CenterVertically,
        ) {
          Icon(if (copied) Icons.Filled.Check else Icons.Filled.ContentCopy, contentDescription = null, tint = colors.textSecondary, modifier = Modifier.size(11.dp))
          Text(if (copied) "Copied" else "Copy details", style = BeeTheme.typography.small, color = colors.textSecondary)
        }
      }
    }
  }
}

@Composable
private fun ToolDetail(label: String, value: String) {
  val colors = BeeTheme.colors
  Column(verticalArrangement = Arrangement.spacedBy(Spacing.half)) {
    Text(label, style = BeeTheme.typography.smallBold, color = colors.textSecondary)
    Text(value, style = BeeTheme.typography.code.copy(fontFamily = FontFamily.Monospace), color = colors.text)
  }
}

/** "Thinking…" bridges the gap between a send and the first visible assistant output. */
@Composable
fun ThinkingActivity() {
  val colors = BeeTheme.colors
  Row(horizontalArrangement = Arrangement.spacedBy(Spacing.two), verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(start = 36.dp + Spacing.two)) {
    ShimmerText("Thinking…", colors.textSecondary, BeeTheme.typography.small)
  }
}

/** Collapsible "Bee is reasoning" disclosure while streaming. */
@Composable
fun ReasoningDisclosure(text: String, streaming: Boolean) {
  val colors = BeeTheme.colors
  var expanded by remember { mutableStateOf(false) }
  Column(verticalArrangement = Arrangement.spacedBy(Spacing.one)) {
    Row(
      modifier = Modifier.clickable { expanded = !expanded }.padding(vertical = Spacing.one),
      horizontalArrangement = Arrangement.spacedBy(Spacing.one),
      verticalAlignment = Alignment.CenterVertically,
    ) {
      val label = if (streaming) "Bee is reasoning…" else "Reasoning"
      if (streaming) ShimmerText(label, colors.textSecondary, BeeTheme.typography.small)
      else Text(label, style = BeeTheme.typography.small, color = colors.textSecondary)
      Icon(
        if (expanded) Icons.Filled.KeyboardArrowUp else Icons.Filled.KeyboardArrowDown,
        contentDescription = null,
        tint = colors.textSecondary,
        modifier = Modifier.size(14.dp),
      )
    }
    AnimatedVisibility(visible = expanded) {
      Text(text, style = BeeTheme.typography.small, color = colors.textSecondary, modifier = Modifier.padding(start = Spacing.two))
    }
  }
}
