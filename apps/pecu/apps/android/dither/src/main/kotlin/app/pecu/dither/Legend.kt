package app.pecu.dither

import androidx.compose.foundation.background
import androidx.compose.foundation.focusable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.selection.toggleable
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.input.pointer.*
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.unit.dp

internal data class TooltipItem(val key: String, val label: String, val value: Double, val color: DitherColor)
internal fun tooltipItems(type: ChartType, data: List<ChartRow>, series: List<Series>, slices: List<PieDatum>, index: Int): List<TooltipItem> =
  if (type == ChartType.Pie) slices.getOrNull(index)?.let { listOf(TooltipItem(it.key, it.label, it.value, it.color)) }.orEmpty()
  else series.mapNotNull { spec -> data.getOrNull(index)?.values?.get(spec.key)?.takeIf(Double::isFinite)?.let { TooltipItem(spec.key, spec.label, it, spec.color) } }

@Composable internal fun ChartTooltip(heading: String, items: List<TooltipItem>, options: Tooltip, selected: String?, modifier: Modifier) {
  Surface(modifier, shape = RoundedCornerShape(8.dp), color = MaterialTheme.colorScheme.surfaceContainerHigh.copy(alpha = if (options.variant == TooltipVariant.FrostedGlass) .86f else 1f), tonalElevation = 4.dp) {
    Column(Modifier.padding(10.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
      if (heading.isNotBlank() && !(items.size == 1 && items.first().label == heading)) Text(heading, style = MaterialTheme.typography.labelSmall)
      items.forEach { item ->
        Row(Modifier.alpha(if (selected != null && selected != item.key) .4f else 1f), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
          Box(Modifier.size(8.dp).background(item.color.fill, RoundedCornerShape(1.dp)))
          Text(item.label, Modifier.weight(1f, fill = false), style = MaterialTheme.typography.labelSmall)
          Text(options.valueFormatter(item.value, item.key), style = MaterialTheme.typography.labelSmall)
        }
      }
    }
  }
}

/** In-flow wrapping is the native default, so larger fonts never cover the plot. */
@Composable fun Legend(series: List<Series>, modifier: Modifier = Modifier, state: ChartState = rememberChartState(), isClickable: Boolean = true, arrangement: Arrangement.Horizontal = Arrangement.Start, values: Map<String, String> = emptyMap(), onSelectionChange: (String?) -> Unit = {}) {
  FlowRow(modifier, horizontalArrangement = arrangement, verticalArrangement = Arrangement.spacedBy(4.dp)) {
    series.forEach { item ->
      val emphasis = state.selectedKey ?: state.focusKey
      val base = Modifier.alpha(if (emphasis != null && emphasis != item.key) .4f else 1f)
      val interactive = if (isClickable) base
        .onFocusChanged { state.focusKey = if (it.isFocused) item.key else null }
        .pointerInput(item.key) { awaitPointerEventScope { while(true) {
          when(awaitPointerEvent().type) { PointerEventType.Enter -> state.focusKey = item.key; PointerEventType.Exit -> state.focusKey = null; else -> Unit }
        } } }
        .toggleable(state.selectedKey == item.key, role = Role.Checkbox) { state.toggle(item.key); onSelectionChange(state.selectedKey) }
        .heightIn(min = 44.dp)
      else base
      Row(interactive.padding(horizontal = 8.dp, vertical = 6.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        Box(Modifier.size(8.dp).background(item.color.fill, RoundedCornerShape(1.dp)))
        Text(item.label, style = MaterialTheme.typography.labelMedium)
        values[item.key]?.let { Text(it, style = MaterialTheme.typography.labelMedium) }
      }
    }
  }
}
@Composable fun BlockLegend(series: List<Series>, modifier: Modifier = Modifier, values: Map<String, String> = emptyMap(), arrangement: Arrangement.Horizontal = Arrangement.Start) = Legend(series, modifier, isClickable = false, arrangement = arrangement, values = values)
