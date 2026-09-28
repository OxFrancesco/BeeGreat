package app.pecu

import app.pecu.dither.*
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import java.math.BigDecimal
import java.math.MathContext
import java.math.RoundingMode
import java.text.DateFormat
import java.util.Date
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.sin

// Read-only presentation; legacy replies carry no contract address.
data class HoldingStock(val symbol: String, val name: String, val price: String?, val balance: String?, val error: String? = null)
data class HoldingPresentation(val stocks: List<HoldingStock>, val observedAt: Long)
data class HoldingRow(val stock: HoldingStock, val balance: BigDecimal, val value: BigDecimal?)
data class HoldingAllocation(val rows: List<HoldingRow>, val total: BigDecimal, val partial: Boolean) {
  val priced: List<HoldingRow> get() = rows.filter { it.value?.signum() == 1 }
}

fun Holdings.presentation() = HoldingPresentation(stocks.map { HoldingStock(it.symbol, it.name, it.price_usdc, it.balance, it.error) }, observedAt)
private fun nonnegativeAmount(value: String?): BigDecimal? = value?.takeIf { it.matches(Regex("\\d+(?:\\.\\d+)?")) && it.length <= 100 }?.toBigDecimalOrNull()

fun stockAllocation(stocks: List<HoldingStock>): HoldingAllocation {
  val rows = stocks.mapNotNull { stock ->
    val balance = nonnegativeAmount(stock.balance) ?: return@mapNotNull null
    if (balance.signum() == 0) return@mapNotNull null
    HoldingRow(stock, balance, nonnegativeAmount(stock.price)?.multiply(balance))
  }.sortedWith(compareByDescending<HoldingRow> { it.value ?: BigDecimal.valueOf(-1) }.thenBy { it.stock.symbol })
  return HoldingAllocation(rows, rows.fold(BigDecimal.ZERO) { total, row -> total + (row.value ?: BigDecimal.ZERO) }, stocks.any { nonnegativeAmount(it.balance) == null } || rows.any { it.value == null })
}

fun legacyStockHoldings(text: String, createdAt: Long): HoldingPresentation? {
  if (text.isBlank() || text.length > 100_000) return null
  val blocks = text.trim().split(Regex("\n\\s*\n"))
  if (blocks.size > 1000) return null
  val pattern = Regex("""([^,\n]{1,120}),\s*([A-Za-z0-9._-]{1,40})\s+(?:(\d+(?:\.\d+)?) USDC|Price unavailable)(?:\s*·\s*You hold (\d+(?:\.\d+)?))?""")
  val seen = mutableSetOf<String>()
  val stocks = mutableListOf<HoldingStock>()
  for (block in blocks) {
    val match = pattern.matchEntire(block.trim()) ?: return null
    val g = match.groupValues
    if (!seen.add(g[2]) || g[3].length > 100 || g[4].length > 100) return null
    stocks += HoldingStock(g[2], g[1], g[3].ifEmpty { null }, g[4].ifEmpty { null })
  }
  return HoldingPresentation(stocks, createdAt)
}

fun stockValueText(value: BigDecimal): String = when {
  value.signum() > 0 && value < BigDecimal("0.01") -> "<0.01"
  else -> value.setScale(2, RoundingMode.HALF_UP).toPlainString()
}
private fun share(row: HoldingRow, total: BigDecimal): Double = row.value!!.divide(total, MathContext.DECIMAL128).toDouble()
private fun percentage(row: HoldingRow, total: BigDecimal): String {
  val percent = row.value!!.multiply(BigDecimal(100)).divide(total, 1, RoundingMode.HALF_UP)
  return if (percent.signum() == 0) "<0.1%" else "${percent.stripTrailingZeros().toPlainString()}%"
}
// The existing Pecu dither chart palette, in the same series order as web.
private val stockColors = listOf(DitherColor.Orange, DitherColor.Blue, DitherColor.Green, DitherColor.Purple, DitherColor.Pink, DitherColor.Red, DitherColor.Grey)

@Composable fun HoldingsView(holdings: Holdings) = StockHoldingsCard(holdings.presentation())

@Composable fun StockHoldingsCard(holdings: HoldingPresentation) {
  var graph by rememberSaveable { mutableStateOf(true) }
  val allocation = remember(holdings.stocks) { stockAllocation(holdings.stocks) }
  val chart = remember(allocation) { allocation.priced }
  val checkedAt = remember(holdings.observedAt) { DateFormat.getDateTimeInstance(DateFormat.MEDIUM, DateFormat.SHORT).format(Date(holdings.observedAt)) }
  Column(Modifier.fillMaxWidth().clayMaterial(MaterialTheme.colorScheme.surfaceVariant).padding(18.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
    Text(if (allocation.partial) "Priced stock holdings" else "Stock holdings", style = MaterialTheme.typography.titleMedium)
    if (allocation.rows.isNotEmpty()) Row(Modifier.selectableGroup(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
      listOf("Graph", "List").forEach { label ->
        val selected = graph == (label == "Graph")
        Box(Modifier.weight(1f).background(if (selected) Amber else MaterialTheme.colorScheme.surface, RoundedCornerShape(14.dp))
          .selectable(selected = selected, role = Role.RadioButton, onClick = { graph = label == "Graph" })
          .heightIn(min = 44.dp).padding(horizontal = 12.dp, vertical = 12.dp), contentAlignment = Alignment.Center) {
          Text(label, color = if (selected) Color.Black else MaterialTheme.colorScheme.onSurface, style = MaterialTheme.typography.labelLarge)
        }
      }
    }
    if (graph && chart.isNotEmpty()) {
      val slices = remember(allocation) { chart.mapIndexed { index, row -> PieDatum(row.stock.symbol, share(row, allocation.total), row.stock.symbol, stockColors[index % stockColors.size]) } }
      val chartState = rememberChartState()
      val description = remember(allocation) { chart.joinToString { "${it.stock.symbol} ${percentage(it, allocation.total)}" } }
      Box(Modifier.fillMaxWidth().height(220.dp), contentAlignment = Alignment.Center) {
        PieChart(slices, Modifier.size(210.dp).testTag("stock-allocation-chart"), pie = Pie(AreaVariant.Dotted, .7), state = chartState,
          options = ChartOptions(margins = Margins.Zero, grid = null, xAxis = null, yAxis = null, tooltip = Tooltip(valueFormatter = { value, _ -> "${java.text.DecimalFormat("0.#").format(value * 100)}%" })),
          description = "Stock allocation by estimated USDC value: $description")
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
          Text(stockValueText(allocation.total), style = MaterialTheme.typography.headlineMedium)
          Text("USDC", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
      }
      Legend(slices.map { Series(it.key, it.label, it.color) }, state = chartState,
        values = chart.associate { it.stock.symbol to percentage(it, allocation.total) })
    } else if (graph && allocation.rows.isNotEmpty()) Text("No priced positions to graph.", style = MaterialTheme.typography.bodyMedium)
    if (!graph) allocation.rows.forEach { row ->
      Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Text(row.stock.symbol, style = MaterialTheme.typography.titleMedium)
        Text("${row.balance.stripTrailingZeros().toPlainString()} shares", style = MaterialTheme.typography.bodySmall)
        Text(row.value?.let { "${stockValueText(it)} USDC" } ?: "Price unavailable", style = MaterialTheme.typography.bodyMedium)
      }
    }
    if (allocation.rows.isEmpty()) Text(if (allocation.partial) "Holdings are temporarily unavailable." else "You don't own any stock tokens yet.", style = MaterialTheme.typography.bodyMedium)
    else if (allocation.partial) Text("Some balances or prices are unavailable. Only priced holdings appear in the graph.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
    Text("As of $checkedAt", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
  }
}
