@file:OptIn(androidx.compose.foundation.layout.ExperimentalLayoutApi::class)
package app.pecu

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.text.selection.SelectionContainer
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.mikepenz.markdown.m3.Markdown
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.util.Locale

private val stateText = mapOf(
  "queued" to "Waiting for a slot", "collecting" to "Collecting chain data", "researching" to "Specialists at work",
  "synthesizing" to "Writing the report", "completed" to "Ready", "failed" to "Failed", "cancelled" to "Cancelled",
)
private val stageText = mapOf("pending" to "Waiting", "running" to "Working", "done" to "Done", "failed" to "Did not finish", "skipped" to "Skipped")
private val dayMonth = DateTimeFormatter.ofPattern("d MMM", Locale.ENGLISH)
private val dayMonthYear = DateTimeFormatter.ofPattern("d MMM yyyy", Locale.ENGLISH)

fun researchStateText(research: Research) = stateText[research.state] ?: research.state

/** 23–29 Sep 2026, matching the web page; "Last 7d" before the data is collected. */
fun researchPeriod(research: Research): String {
  val period = research.period ?: return "Last ${research.window}"
  val start = LocalDate.parse(period.start)
  val end = LocalDate.parse(period.end)
  return when {
    start == end -> end.format(dayMonthYear)
    start.month == end.month && start.year == end.year -> "${start.dayOfMonth}–${end.format(dayMonthYear)}"
    else -> "${start.format(dayMonth)}–${end.format(dayMonthYear)}"
  }
}

@Composable fun ResearchSheet(model: PecuViewModel, initialCode: String? = null) {
  val state by model.research.collectAsStateWithLifecycle()
  LaunchedEffect(initialCode) { model.loadResearch(initialCode) }
  Column(Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).padding(horizontal = 24.dp, vertical = 8.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
    val open = state.open
    if (open != null) ResearchDetail(open, state.busy, model::researchAction, model::closeResearch)
    else ResearchHome(state, { chain, window -> model.researchAction("start", chain = chain, window = window) }, { model.loadResearch(it) })
    state.error?.let { Text(it, color = MaterialTheme.colorScheme.error, fontSize = 13.sp) }
    state.message?.let { Text(it, fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite }) }
  }
}

@Composable fun ResearchHome(state: ResearchUi, onStart: (String, String) -> Unit, onOpen: (String) -> Unit) {
  var chain by remember { mutableStateOf("base") }
  var window by remember { mutableStateOf("7d") }
  val list = state.list
  val left = list?.let { (it.limit.daily - it.limit.used).coerceAtLeast(0) }
  Text("Research", style = MaterialTheme.typography.headlineMedium)
  Surface(Modifier.fillMaxWidth().clay(22), shape = RoundedCornerShape(22.dp), color = MaterialTheme.colorScheme.surface) {
    Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
      OutlinedTextField(chain, { chain = it.take(60) }, Modifier.fillMaxWidth(), label = { Text("Chain") }, singleLine = true,
        keyboardOptions = KeyboardOptions(imeAction = ImeAction.Done))
      list?.chains?.let { chains ->
        FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
          chains.forEach { option -> FilterChip(selected = chain == option.id, onClick = { chain = option.id }, label = { Text(option.name) }) }
        }
      }
      Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        listOf("1d", "7d", "30d").forEach { option -> FilterChip(selected = window == option, onClick = { window = option }, label = { Text(option) }) }
      }
      Button(onClick = { onStart(chain.trim(), window) }, enabled = !state.busy && chain.isNotBlank() && left != 0, modifier = Modifier.heightIn(min = 48.dp)) { Text(if (state.busy) "Starting…" else "Start research") }
      left?.let { Text(if (it == 0) "No runs left today. The limit resets at 00:00 UTC." else "$it of ${list.limit.daily} runs left today", fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant) }
    }
  }
  when {
    list == null && state.error == null -> LinearProgressIndicator(Modifier.fillMaxWidth())
    list?.researches?.isEmpty() == true -> Text("No research yet. You can also send @research base in any chat.", color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 14.sp)
    list != null -> list.researches.forEach { research ->
      Surface(Modifier.fillMaxWidth().clay(18).clickable { onOpen(research.code) }, shape = RoundedCornerShape(18.dp), color = MaterialTheme.colorScheme.surface) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
          Text("${research.chain.name} · ${researchPeriod(research)}", fontWeight = FontWeight.SemiBold, fontSize = 15.sp)
          Text("${research.window} · ${researchStateText(research)}", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
          (research.headline ?: research.error)?.let { Text(it, fontSize = 14.sp, lineHeight = 20.sp) }
        }
      }
    }
  }
}

@Composable fun ResearchDetail(research: Research, busy: Boolean, onAct: (String, String?, String?, String?) -> Unit, onBack: () -> Unit) {
  var deleting by remember(research.code) { mutableStateOf(false) }
  TextButton(onClick = onBack, contentPadding = PaddingValues(0.dp)) { Text("Research", color = Brown) }
  Text("${research.chain.name}, ${researchPeriod(research)}", style = MaterialTheme.typography.headlineSmall)
  Text("${research.window} · ${researchStateText(research)} · ${research.code}", fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
  FlowRow(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
    if (research.active) TextButton(onClick = { onAct("cancel", research.code, null, null) }, enabled = !busy) { Text("Cancel", color = Brown) }
    else {
      TextButton(onClick = { onAct("rerun", research.code, null, null) }, enabled = !busy) { Text("Run again", color = Brown) }
      TextButton(onClick = { deleting = true }, enabled = !busy) { Text("Delete", color = Brown) }
    }
  }
  research.error?.let { Text(it, fontSize = 14.sp, color = MaterialTheme.colorScheme.onSurface) }
  if (research.state != "completed") {
    Surface(shape = RoundedCornerShape(18.dp), color = MaterialTheme.colorScheme.surfaceVariant, modifier = Modifier.fillMaxWidth()) {
      Column(Modifier.padding(12.dp).semantics { liveRegion = LiveRegionMode.Polite }, verticalArrangement = Arrangement.spacedBy(8.dp)) {
        research.stages.forEach { stage ->
          Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Text(stage.label, Modifier.weight(1f), fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
            Text((stageText[stage.state] ?: stage.state) + if (stage.calls > 0) " · ${stage.calls} reads" else "", fontFamily = Mono, fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
          }
          if (stage.state == "failed") stage.error?.let { Text(it, fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant) }
        }
      }
    }
  }
  research.markdown?.let { SelectionContainer { Markdown(content = it, modifier = Modifier.fillMaxWidth()) } }
  if (deleting) AlertDialog(onDismissRequest = { deleting = false }, title = { Text("Delete this report?") },
    text = { Text("It is removed from your research list. It still counts toward today's limit.") },
    confirmButton = { TextButton(onClick = { deleting = false; onAct("delete", research.code, null, null) }) { Text("Delete") } },
    dismissButton = { TextButton(onClick = { deleting = false }) { Text("Keep") } })
}
