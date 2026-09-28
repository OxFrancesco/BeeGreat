package app.pecu

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.text.selection.SelectionContainer
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import java.math.BigDecimal
import java.math.RoundingMode
import kotlinx.serialization.Serializable

@Serializable data class PositionToken(val symbol: String, val unstaked: String, val staked: String)
@Serializable data class LiquidityPosition(val id: String, val pool: String, val label: String, val chain: String, val token0: PositionToken, val token1: PositionToken)
@Serializable data class PositionSnapshot(val positions: List<LiquidityPosition>, val observedAt: Long)

fun compactPositionAmount(value: String): String {
  val amount = value.toBigDecimalOrNull() ?: return value
  if (amount.signum() == 0) return "0"
  if (amount > BigDecimal.ZERO && amount < BigDecimal("0.000001")) return "<0.000001"
  val places = if (amount < BigDecimal.ONE) minOf(6, amount.stripTrailingZeros().scale() - amount.stripTrailingZeros().precision() + 4) else maxOf(0, 4 - amount.toBigInteger().toString().length)
  val compact = amount.setScale(places, RoundingMode.DOWN).stripTrailingZeros()
  return (if (compact.compareTo(amount) != 0) "≈" else "") + compact.toPlainString()
}

fun legacyPositions(text: String): List<LiquidityPosition>? {
  val pattern = Regex("""([^\n·]+?)\s*·\s*Position (\d+)\s*·\s*([^\n]+?)\s+Pool:\s*(0x[0-9a-fA-F]{40})\s+Unstaked:\s*(\d+(?:\.\d+)?)\s+(\S+)\s*\+\s*(\d+(?:\.\d+)?)\s+(\S+)\s+Staked:\s*(\d+(?:\.\d+)?)\s+(\S+)\s*\+\s*(\d+(?:\.\d+)?)\s+(\S+)""")
  var end = 0
  val rows = mutableListOf<LiquidityPosition>()
  for (match in pattern.findAll(text)) {
    val g = match.groupValues
    if (text.substring(end, match.range.first).isNotBlank() || g[6] != g[10] || g[8] != g[12]) return null
    if (g[1].trim().length > 160 || g[2].length > 80 || g[3].trim().length > 60 || listOf(g[6], g[8]).any { it.length > 40 } || listOf(g[5], g[7], g[9], g[11]).any { it.length > 160 }) return null
    rows += LiquidityPosition(g[2], g[4], g[1].trim(), g[3].trim(), PositionToken(g[6], g[5], g[9]), PositionToken(g[8], g[7], g[11]))
    end = match.range.last + 1
  }
  return rows.takeIf { it.isNotEmpty() && it.size <= 1000 && text.substring(end).isBlank() }
}

@Composable fun PositionCards(positions: List<LiquidityPosition>) {
  var limit by rememberSaveable(positions) { mutableIntStateOf(3) }
  Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
    positions.take(limit).forEach { position -> key(position.id, position.pool) { PositionCard(position) } }
    if (positions.size > limit) TextButton(onClick = { limit += 3 }) { Text("Show more positions") }
    if (limit > 3) TextButton(onClick = { limit = 3 }) { Text("Show fewer positions") }
  }
}

@Composable private fun PositionCard(position: LiquidityPosition) {
  var details by rememberSaveable(position.id, position.pool) { mutableStateOf(false) }
  val tokens = listOf(position.token0, position.token1)
  val staked = tokens.any { it.staked.toBigDecimalOrNull()?.signum() == 1 }
  val unstaked = tokens.any { it.unstaked.toBigDecimalOrNull()?.signum() == 1 }
  Column(Modifier.fillMaxWidth().clayMaterial(MaterialTheme.colorScheme.surfaceVariant).padding(18.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
    Text("${position.token0.symbol} / ${position.token1.symbol}", style = MaterialTheme.typography.titleMedium)
    Text("${position.chain} · ${if (staked && unstaked) "Partly staked" else if (staked) "Staked" else if (unstaked) "Unstaked" else "Empty"}", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
    tokens.forEach { token ->
      val total = token.unstaked.toBigDecimalOrNull()?.let { a -> token.staked.toBigDecimalOrNull()?.add(a) }
      if (total != null && total.signum() != 0) Text("${compactPositionAmount(total.toPlainString())} ${token.symbol}", style = MaterialTheme.typography.titleLarge)
    }
    TextButton(onClick = { details = !details }, contentPadding = PaddingValues(horizontal = 0.dp)) { Text(if (details) "Hide details" else "Details") }
    if (details) SelectionContainer {
      Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(position.label, style = MaterialTheme.typography.bodySmall)
        Text("Position ${position.id}", style = MaterialTheme.typography.bodySmall)
        tokens.forEach { token ->
          Text("${token.unstaked} ${token.symbol} unstaked\n${token.staked} ${token.symbol} staked", style = MaterialTheme.typography.bodySmall)
        }
        Text(position.pool, style = MaterialTheme.typography.bodySmall.copy(fontFamily = Mono))
      }
    }
  }
}
