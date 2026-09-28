@file:OptIn(androidx.compose.foundation.layout.ExperimentalLayoutApi::class)
package app.pecu

import app.pecu.dither.*
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.*
import java.math.BigDecimal
import java.text.NumberFormat
import java.util.Locale
import kotlinx.coroutines.delay
import kotlinx.serialization.json.*
import kotlin.math.abs


fun usd(value: Double?) = if (value == null || !value.isFinite()) "Unavailable" else NumberFormat.getCurrencyInstance(Locale.US).format(value)

@Composable fun AnalyticsView(result: Analytics) {
  val snapshot = result.snapshot
  val kind = snapshot.string("kind")
  val uri = LocalUriHandler.current
  val rows = remember(snapshot) { snapshot["rows"]?.jsonArray?.map { it.jsonObject }.orEmpty() }
  Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(12.dp)) {
    when (kind) {
      "flows", "pnl", "pm_odds" -> {
        Text(when(kind) { "flows" -> "Token flows"; "pnl" -> "Trading P&L"; else -> snapshot.string("title") }, style = MaterialTheme.typography.titleMedium)
        val values = rows.map { row -> when(kind) { "flows" -> row.number("netUsd"); "pnl" -> row.number("realizedUsd")?.let { it + (row.number("unrealizedUsd") ?: return@let Double.NaN) }; else -> row.number("probability") } }
        if (values.any { it?.isFinite() == true }) BarChart(
          rows.mapIndexed { index, row -> ChartRow(row.string(if (kind == "pnl") "symbol" else "label"), mapOf("value" to values[index])) },
          listOf(Bar("value", if (kind == "pm_odds") "Probability" else "USD", DitherColor.Orange)),
          Modifier.fillMaxWidth().height(180.dp),
          options = ChartOptions(referenceLines = listOf(ReferenceLine()),
            yAxis = YAxis(formatter = { if (kind == "pm_odds") "${(it * 100).toInt()}%" else compactValue(it) }),
            tooltip = Tooltip(valueFormatter = { value, _ -> if (kind == "pm_odds") "${String.format(Locale.US, "%.1f", value * 100)}%" else usd(value) })),
          description = if (kind == "pm_odds") "Outcome probabilities" else if (kind == "flows") "Net token flows" else "Trading P&L",
        )
        rows.forEachIndexed { index, row ->
          val value = values[index]
          Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Row { Text(row.string(if (kind == "pnl") "symbol" else "label"), Modifier.weight(1f), fontSize = 13.sp); Text(if (kind == "pm_odds") value?.let { "${String.format(Locale.US, "%.1f", it * 100)}%" } ?: "Unavailable" else usd(value), fontFamily = Mono, fontSize = 12.sp) }
          }
        }
      }
      "pm_history", "pm_trader" -> {
        Text(snapshot.string("title").ifEmpty { if (kind == "pm_trader") "Trading P&L" else "Price history" }, style = MaterialTheme.typography.titleMedium)
        val points = remember(snapshot) { snapshot["points"]?.jsonArray?.mapNotNull { it.jsonObject.number(if (kind == "pm_history") "p" else "pnlUsd") }.orEmpty() }
        if (points.isNotEmpty()) AreaChart(
          points.mapIndexed { index, value -> ChartRow((index + 1).toString(), mapOf("value" to value)) },
          listOf(Area("value", if (kind == "pm_history") "Probability" else "P&L", DitherColor.Orange)),
          Modifier.fillMaxWidth().height(180.dp),
          options = ChartOptions(xAxis = null, yAxis = YAxis(formatter = { if (kind == "pm_history") "${(it * 100).toInt()}%" else usd(it) }),
            referenceLines = listOf(ReferenceLine()), tooltip = Tooltip(valueFormatter = { value, _ -> if (kind == "pm_history") "${String.format(Locale.US, "%.1f", value * 100)}%" else usd(value) })),
          description = if (kind == "pm_history") "Probability history" else "Trading P&L history",
        )
        RichText(result.text)
      }
      "pm_markets", "pm_positions", "pm_wins", "pm_leaderboard" -> {
        rows.forEach { row ->
          Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text(row.string("title").ifEmpty { row.string("name") }, fontWeight = FontWeight.Medium)
            when (kind) {
              "pm_markets" -> {
                Text("${row.string("leader")} ${row.number("probability")?.let { "${String.format(Locale.US, "%.1f", it * 100)}%" } ?: "Unavailable"}", fontFamily = Mono)
                Text("24h volume ${usd(row.number("volume24hUsd"))}", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
              }
              "pm_positions" -> { Text(row.string("outcome")); Text("Value ${usd(row.number("valueUsd"))} · P&L ${usd(row.number("pnlUsd"))}", fontFamily = Mono, fontSize = 13.sp) }
              else -> Text("P&L ${usd(row.number("pnlUsd"))}", fontFamily = Mono, fontSize = 13.sp)
            }
            row.string("url").takeIf { it.startsWith("https://") }?.let { url -> TextButton(onClick = { uri.openUri(url) }) { Text("View market") } }
            HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
          }
        }
      }
      "pm_book" -> {
        Text(snapshot.string("title").ifEmpty { "Order book" }, style = MaterialTheme.typography.titleMedium)
        Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
          listOf("bids" to "Bids", "asks" to "Asks").forEach { (key, title) ->
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(6.dp)) {
              Text(title, fontWeight = FontWeight.Medium)
              snapshot[key]?.jsonArray?.forEach { item ->
                val level = item.jsonObject
                Text("${level.number("price")?.let { String.format(Locale.US, "%.1f¢", it * 100) }} · ${level.number("size")} shares", fontFamily = Mono, fontSize = 11.sp)
              }
            }
          }
        }
      }
      "portfolio" -> {
        Text("Portfolio", style = MaterialTheme.typography.titleMedium)
        val balances = snapshot["balances"] as? JsonArray
        if (balances == null) Text("Wallet balances are unavailable.")
        balances?.forEach { item -> val balance = item.jsonObject; Row { Text(balance.string("symbol"), Modifier.weight(1f)); Text(usd(balance.number("valueUsd")), fontFamily = Mono) } }
        val defi = snapshot["defi"] as? JsonObject
        if (defi != null) {
          Text("DeFi positions", style = MaterialTheme.typography.titleMedium)
          Text("Assets ${usd(defi.number("assetsUsd"))} · Debt ${usd(defi.number("debtUsd"))}", fontSize = 13.sp)
          (defi["protocols"] as? JsonArray)?.forEach { item -> val protocol = item.jsonObject; Row { Text(protocol.string("name"), Modifier.weight(1f)); Text(usd(protocol.number("netUsd")), fontFamily = Mono, fontSize = 13.sp) } }
        }
      }
      else -> RichText(result.text)
    }
    if (snapshot["partial"]?.jsonPrimitive?.booleanOrNull == true) Text("Partial data. Missing values are not counted as zero.", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
    snapshot.string("url").takeIf { it.startsWith("https://") }?.let { url -> TextButton(onClick = { uri.openUri(url) }) { Text("View market") } }
  }
}
fun JsonObject.string(key: String) = (get(key) as? JsonPrimitive)?.contentOrNull.orEmpty()
fun JsonObject.number(key: String) = (get(key) as? JsonPrimitive)?.doubleOrNull
