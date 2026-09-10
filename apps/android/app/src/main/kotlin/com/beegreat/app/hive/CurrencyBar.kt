package com.beegreat.app.hive

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Hexagon
import androidx.compose.material.icons.filled.WaterDrop
import androidx.compose.material.icons.filled.WorkspacePremium
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.beegreat.app.LocalAppContainer
import com.beegreat.convex.focus.HiveBalances
import com.beegreat.design.BeeTheme
import com.beegreat.design.Spacing
import java.text.NumberFormat
import kotlinx.coroutines.flow.map

/**
 * Honey, Honeycomb Score, and Royal Jelly as compact capsule pills. Renders
 * nothing until the Hive summary arrives, so headers never jump.
 */
@Composable
fun CurrencyBar(modifier: Modifier = Modifier, regular: Boolean = false) {
  val container = LocalAppContainer.current
  val flow = remember(container) { container.firstFocus.current().map { it.getOrNull()?.hive } }
  val balances by flow.collectAsStateWithLifecycle(initialValue = null)
  balances?.let { CurrencyBarView(it, modifier, regular) }
}

private data class Currency(val label: String, val icon: ImageVector, val tint: Color, val value: Double)

@Composable
fun CurrencyBarView(values: HiveBalances, modifier: Modifier = Modifier, regular: Boolean = false) {
  val colors = BeeTheme.colors
  val currencies =
    listOf(
      Currency("Honey", Icons.Filled.WaterDrop, Color(0xFFE19100), values.honeyBalance),
      Currency("Honeycomb Score", Icons.Filled.Hexagon, Color(0xFFD78A00), values.honeycombScore),
      Currency("Royal Jelly", Icons.Filled.WorkspacePremium, Color(0xFFC85682), values.royalJellyBalance),
    )
  Row(modifier = modifier, horizontalArrangement = Arrangement.spacedBy(Spacing.two)) {
    for (currency in currencies) {
      Row(
        modifier =
          Modifier.semantics { contentDescription = "${currency.label} ${formatCount(currency.value)}" }
            .background(colors.backgroundElement, CircleShape)
            .padding(horizontal = if (regular) 12.dp else 10.dp, vertical = if (regular) 6.dp else 4.dp),
        horizontalArrangement = Arrangement.spacedBy(Spacing.one),
        verticalAlignment = Alignment.CenterVertically,
      ) {
        Icon(currency.icon, contentDescription = null, tint = currency.tint, modifier = Modifier.size(if (regular) 15.dp else 13.dp))
        Text(
          text = formatCount(currency.value),
          style = (if (regular) BeeTheme.typography.smallBold else BeeTheme.typography.small).copy(fontFeatureSettings = "tnum"),
          color = colors.text,
        )
      }
    }
  }
}

/** Compact above 10k (1.4M, 38k), otherwise standard with one decimal at most. */
fun formatCount(value: Double): String {
  val abs = kotlin.math.abs(value)
  if (abs >= 10_000) {
    val (divisor, suffix) = when {
      abs >= 1_000_000_000 -> 1_000_000_000.0 to "B"
      abs >= 1_000_000 -> 1_000_000.0 to "M"
      else -> 1_000.0 to "K"
    }
    val scaled = value / divisor
    val text = if (scaled == scaled.toLong().toDouble()) scaled.toLong().toString() else String.format(java.util.Locale.getDefault(), "%.1f", scaled)
    return text + suffix
  }
  val format = NumberFormat.getNumberInstance().apply { maximumFractionDigits = 1 }
  return format.format(value)
}
