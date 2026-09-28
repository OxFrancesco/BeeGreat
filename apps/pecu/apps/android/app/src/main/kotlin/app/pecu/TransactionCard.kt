@file:OptIn(androidx.compose.foundation.layout.ExperimentalLayoutApi::class)
package app.pecu

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.selection.SelectionContainer
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.repeatOnLifecycle
import kotlinx.coroutines.delay
import java.text.DateFormat
import java.util.Date

@Composable fun PreviewCard(preview: Preview, busy: Boolean, model: PecuViewModel) {
  val chat by model.chat.collectAsState()
  TransactionCard(preview, busy, { model.send(it) }, chat.thread)
}

@Composable fun TransactionCard(preview: Preview, busy: Boolean, onSend: (String) -> Unit, thread: String? = null) {
  val presentation = remember(preview.text) { previewPresentation(preview.text) }
  val receiptLinks = remember(preview.result, preview.plan) { previewReceipts(preview.result, preview.plan?.steps?.mapNotNull { it.hash }.orEmpty()) }
  val resultText = remember(preview.result) { previewResultText(preview.result) }
  val completed = preview.state in setOf("succeeded", "failed", "cancelled", "expired")
  val hiddenMetadata = presentation.metadata.filter { completed && it.label == "Network fee" && it.value == "not estimated yet" }
  var details by rememberSaveable(preview.code) { mutableStateOf(false) }
  var now by remember(preview.code) { mutableLongStateOf(System.currentTimeMillis()) }
  val lifecycle = LocalLifecycleOwner.current.lifecycle
  LaunchedEffect(preview.code, preview.state, preview.expiresAt, lifecycle) {
    if (preview.state == "pending") lifecycle.repeatOnLifecycle(Lifecycle.State.STARTED) {
      now = System.currentTimeMillis()
      if (preview.expiresAt > now) { delay(preview.expiresAt - now); now = System.currentTimeMillis() }
    }
  }
  val expired = preview.state == "expired" || (preview.state == "pending" && now >= preview.expiresAt)
  val status = when {
    expired -> "Expired without confirmation"
    preview.state == "pending" -> "Review before confirming"
    preview.state == "executing" -> "In progress"
    preview.state == "succeeded" -> "Confirmed on Base"
    preview.state == "cancelled" -> "Cancelled"
    preview.state == "failed" -> "Could not complete"
    else -> "Check transaction status"
  }
  val uri = LocalUriHandler.current
  val fill = MaterialTheme.colorScheme.surface
  Column(Modifier.fillMaxWidth().clayMaterial(fill).padding(20.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
      Text(preview.title ?: "Transaction", style = MaterialTheme.typography.titleLarge)
      Text(status, Modifier.semantics { liveRegion = LiveRegionMode.Polite }, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
    SelectionContainer {
      Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
        presentation.groups.forEach { group ->
          Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            group.amounts.forEach { field ->
              Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(when(field.label) { "You pay" -> "Pay"; "You receive" -> "Estimated receive"; else -> field.label }, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Text(field.value.removePrefix(if (field.label == "You receive") "about " else ""), style = MaterialTheme.typography.titleLarge.copy(fontFamily = Mono))
              }
            }
            TransactionFields(group.details.filterNot { (it.label == "Action" && it.value.equals(preview.title, true)) || (it.label.isEmpty() && ((preview.title == "Stake position" && it.value == "Stake on Base") || (preview.title == "Unstake position" && it.value == "Unstake on Base"))) })
          }
        }
        TransactionFields(presentation.metadata - hiddenMetadata.toSet())
      }
    }
    preview.plan?.let { plan ->
      plan.route?.let { route ->
        val nodes = remember(route) { route.nodes.associateBy { it.id } }
        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
          route.edges.forEach { edge ->
            val from = nodes[edge.from]; val to = nodes[edge.to]
            if (from != null && to != null) Text("${from.label} → ${to.label}${edge.label?.let { " · $it" }.orEmpty()}", style = MaterialTheme.typography.bodySmall)
          }
        }
      }
      Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
        plan.steps.forEachIndexed { index, step -> TransactionStep(index, step) }
      }
    }
    if (resultText.isNotEmpty() && !isRepeatedSuccess(preview.state, resultText)) {
      if (resultText.contains("https://basescan.org/tx/")) RichText(resultText)
      else SelectionContainer { Text(resultText, style = MaterialTheme.typography.bodyMedium) }
    }
    if (receiptLinks.isNotEmpty()) ReceiptLinks(receiptLinks.mapNotNull { receiptLink(it) })
    if (preview.state == "pending" && !expired) {
      Text("Expires ${DateFormat.getTimeInstance(DateFormat.SHORT).format(Date(preview.expiresAt))}", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
    if (preview.signer != null && (preview.state == "executing" || (preview.state == "pending" && !expired))) {
      Text("Sign with your linked wallet on Pecu web.", style = MaterialTheme.typography.bodyMedium)
      TextButton(onClick = { uri.openUri("https://pecu.app/agent" + (thread?.let { "?t=$it" } ?: "")) }) { Text("Open wallet signing") }
      if (preview.state == "pending") OutlinedButton(onClick = { onSend("/cancel ${preview.code}") }, enabled = !busy) { Text("Cancel") }
    } else if (preview.canConfirm(now) && !expired) {
      FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        Button(onClick = { onSend("/confirm ${preview.code}") }, enabled = !busy) { Text(if (preview.state == "executing") "Check status" else "Confirm") }
        if (preview.state == "pending") OutlinedButton(onClick = { onSend("/cancel ${preview.code}") }, enabled = !busy) { Text("Cancel") }
      }
    }
    TextButton(onClick = { details = !details }) {
      Icon(if (details) Icons.Default.ExpandLess else Icons.Default.ExpandMore, null)
      Spacer(Modifier.width(6.dp)); Text(if (details) "Hide details" else "Transaction details")
    }
    if (details) SelectionContainer {
      Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
        TransactionFields(presentation.technical + hiddenMetadata)
        if (isRepeatedSuccess(preview.state, resultText)) Text(resultText, style = MaterialTheme.typography.bodySmall)
        preview.plan?.steps?.forEachIndexed { index, step ->
          Text("${index + 1}. ${step.contractName ?: "Contract"}", style = MaterialTheme.typography.labelLarge)
          Text(step.contract, style = MaterialTheme.typography.bodySmall.copy(fontFamily = Mono))
          step.hash?.let { Text(it, style = MaterialTheme.typography.bodySmall.copy(fontFamily = Mono)) }
        }
        Text("Confirmation code: ${preview.code}", style = MaterialTheme.typography.bodySmall.copy(fontFamily = Mono))
      }
    }
  }
}

@Composable private fun TransactionFields(rows: List<PreviewField>) {
  rows.forEach { row ->
    Column(verticalArrangement = Arrangement.spacedBy(3.dp)) {
      if (row.label.isNotEmpty()) Text(row.label, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
      Text(row.value, style = if (row.label == "Pool") MaterialTheme.typography.titleMedium else MaterialTheme.typography.bodyMedium)
    }
  }
}

@Composable private fun TransactionStep(index: Int, step: PlanStep) {
  val uri = LocalUriHandler.current
  val ink = if (step.status == "failed") MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.primary
  Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
    Box(Modifier.size(30.dp).background(ink.copy(alpha = .12f), CircleShape), contentAlignment = Alignment.Center) {
      when (step.status) {
        "confirmed" -> Icon(Icons.Default.Check, null, Modifier.size(18.dp), tint = ink)
        "failed" -> Icon(Icons.Default.Close, null, Modifier.size(18.dp), tint = ink)
        "submitted" -> Icon(Icons.Default.Schedule, null, Modifier.size(18.dp), tint = ink)
        "skipped" -> Icon(Icons.Default.Remove, null, Modifier.size(18.dp), tint = MaterialTheme.colorScheme.onSurfaceVariant)
        else -> Text("${index + 1}", style = MaterialTheme.typography.labelLarge, color = ink)
      }
    }
    Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(5.dp)) {
      Text(transactionStepTitle(step), style = MaterialTheme.typography.bodyMedium)
      Text(planStepStatus(step.status) + if (step.kind == "approval") " · Permission only" else "", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
      step.value?.let { Text("Sends $it", style = MaterialTheme.typography.bodyMedium.copy(fontFamily = Mono)) }
      step.hash?.takeIf { it.matches(Regex("0x[0-9a-fA-F]{64}")) }?.let { hash ->
        ReceiptLinks(listOfNotNull(receiptLink("https://basescan.org/tx/$hash")))
      }
    }
  }
}
