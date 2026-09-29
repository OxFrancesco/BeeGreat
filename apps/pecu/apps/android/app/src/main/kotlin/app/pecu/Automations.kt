@file:OptIn(androidx.compose.foundation.layout.ExperimentalLayoutApi::class)
package app.pecu

import android.Manifest
import android.os.Build
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.clickable
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import java.text.DateFormat
import java.util.Date

private val modeLabel = mapOf("remind" to "Reminder", "run" to "Runs Pecu", "heartbeat" to "Heartbeat")

fun automationMeta(task: Automation, now: Long = System.currentTimeMillis()): String {
  val mode = modeLabel[task.mode] ?: task.mode
  val where = if (task.channel == "x") " · X Chat" else ""
  if (task.state == "paused") return "$mode · Paused$where"
  if (task.state == "completed") return "$mode · Finished$where"
  val next = task.nextRunAt?.takeIf { task.triggerKind != "price" && it > now }?.let { " · Next ${DateFormat.getDateTimeInstance(DateFormat.SHORT, DateFormat.SHORT).format(Date(it))}" }.orEmpty()
  return "$mode · ${task.schedule}$next$where"
}

private fun scopes(grant: Grant) = grant.scopes.joinToString(" and ") { if (it == "trade") "trades" else "liquidity changes" }
private fun usd(value: Double) = if (value % 1.0 == 0.0) value.toLong().toString() else "%.2f".format(value)

/** One plain sentence about what the automation may execute without asking; mirrors the web allowance line. */
fun allowanceText(task: Automation): String? {
  val grant = task.grant ?: return null
  val limit = "${scopes(grant)} up to $${usd(grant.maxUsdPerRun)} per run"
  return when {
    grant.state == "requested" -> "Asks to execute $limit."
    grant.state == "revoked" -> "Allowance revoked. Transactions wait for your confirmation."
    !grant.active -> "Allowance expired. Transactions wait for your confirmation."
    else -> "Executes $limit until ${DateFormat.getDateInstance(DateFormat.MEDIUM).format(Date(grant.expiresAt ?: 0))}." + if (task.yolo) "" else " YOLO is off in its chat, so each transaction still asks."
  }
}

typealias AutomationAct = (code: String, kind: String, maxUsd: Double?) -> Unit

@Composable fun AutomationsSheet(model: PecuViewModel, onOpenThread: (String?) -> Unit) {
  val state by model.automations.collectAsStateWithLifecycle()
  val context = LocalContext.current
  var allowed by remember { mutableStateOf(notificationsAllowed(context)) }
  val permission = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { allowed = it }
  LaunchedEffect(Unit) { model.loadAutomations() }
  AutomationsContent(state, allowed || Build.VERSION.SDK_INT < 33, { permission.launch(Manifest.permission.POST_NOTIFICATIONS) }, model::automationAction, onOpenThread)
}

@Composable fun AutomationsContent(state: AutomationsUi, notificationsOn: Boolean, onAllowNotifications: () -> Unit, onAct: AutomationAct, onOpenThread: (String?) -> Unit) {
  Column(Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).padding(horizontal = 24.dp, vertical = 8.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
    Text("Automations", style = MaterialTheme.typography.headlineMedium)
    if (!notificationsOn) {
      Surface(shape = RoundedCornerShape(16.dp), color = MaterialTheme.colorScheme.secondaryContainer) {
        Row(Modifier.padding(start = 16.dp, end = 8.dp, top = 8.dp, bottom = 8.dp), verticalAlignment = androidx.compose.ui.Alignment.CenterVertically) {
          Text("Allow notifications to hear about reminders and trades waiting for you.", Modifier.weight(1f), fontSize = 13.sp, color = Brown)
          TextButton(onClick = onAllowNotifications) { Text("Allow", color = Brown) }
        }
      }
    }
    state.error?.let { Text(it, color = MaterialTheme.colorScheme.error, fontSize = 13.sp) }
    state.message?.let { Text(it, fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite }) }
    val tasks = state.tasks
    when {
      tasks == null && state.error == null -> LinearProgressIndicator(Modifier.fillMaxWidth())
      tasks?.isEmpty() == true -> Text("None yet. Ask Pecu, for example: remind me every Monday at 9:00 to check AERO.", color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 14.sp)
      tasks != null -> tasks.forEach { task -> AutomationCard(task, state.busy, onAct, onOpenThread) }
    }
    if (state.alerts.isNotEmpty()) {
      Text("Recent", style = MaterialTheme.typography.titleMedium, modifier = Modifier.padding(top = 8.dp))
      state.alerts.forEach { alert ->
        Column(Modifier.fillMaxWidth().clickable(enabled = alert.channel == "web") { onOpenThread(alert.threadId) }.padding(vertical = 6.dp)) {
          Text(alert.title, fontWeight = if (alert.readAt == null) FontWeight.SemiBold else FontWeight.Normal, fontSize = 14.sp)
          Text(alert.body, fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 2)
        }
      }
    }
  }
}

@Composable private fun AutomationCard(task: Automation, busy: String?, onAct: AutomationAct, onOpenThread: (String?) -> Unit) {
  val pending = busy?.startsWith("${task.code}:") == true
  val grant = task.grant
  val needsApproval = grant != null && (grant.state != "approved" || !grant.active) && task.state != "completed"
  var limit by remember(task.code, grant?.maxUsdPerRun) { mutableStateOf(grant?.maxUsdPerRun?.let(::usd).orEmpty()) }
  var deleting by remember { mutableStateOf(false) }
  val cap = limit.toDoubleOrNull()?.takeIf { it > 0 && it <= 10_000 }
  // Amber text is too light on white; the theme's links use brown there.
  val actions = ButtonDefaults.textButtonColors(contentColor = if (isSystemInDarkTheme()) Amber else Brown)
  Surface(Modifier.fillMaxWidth().clay(18), shape = RoundedCornerShape(18.dp), color = MaterialTheme.colorScheme.surface) {
    Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
      Text(task.title, fontWeight = FontWeight.SemiBold, fontSize = 15.sp, modifier = Modifier.clickable(enabled = task.channel == "web") { onOpenThread(task.threadId) })
      Text(automationMeta(task), fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
      Text(task.instruction, fontSize = 14.sp, lineHeight = 21.sp)
      allowanceText(task)?.let { text ->
        Surface(shape = RoundedCornerShape(12.dp), color = if (needsApproval) MaterialTheme.colorScheme.secondaryContainer else MaterialTheme.colorScheme.surfaceVariant) {
          Text(text, Modifier.padding(horizontal = 12.dp, vertical = 8.dp), fontSize = 13.sp, color = if (needsApproval) Brown else MaterialTheme.colorScheme.onSurface)
        }
      }
      if (needsApproval) Row(verticalAlignment = androidx.compose.ui.Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        OutlinedTextField(limit, { limit = it.take(8) }, Modifier.width(150.dp), label = { Text("USD per run") }, singleLine = true,
          isError = cap == null, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal), textStyle = MaterialTheme.typography.bodyMedium.copy(fontFamily = Mono))
        Button(onClick = { onAct(task.code, "allow", cap) }, enabled = !pending && cap != null, modifier = Modifier.heightIn(min = 48.dp)) { Text("Approve") }
      }
      FlowRow(horizontalArrangement = Arrangement.spacedBy(2.dp)) {
        if (task.state == "active") TextButton(onClick = { onAct(task.code, "pause", null) }, enabled = !pending, colors = actions) { Text("Pause") }
        if (task.state == "paused") TextButton(onClick = { onAct(task.code, "resume", null) }, enabled = !pending, colors = actions) { Text("Resume") }
        if (task.state != "completed" && task.triggerKind != "price") TextButton(onClick = { onAct(task.code, "run", null) }, enabled = !pending, colors = actions) { Text("Run now") }
        if (grant?.state == "approved" && grant.active) TextButton(onClick = { onAct(task.code, "revoke", null) }, enabled = !pending, colors = actions) { Text("Revoke allowance") }
        TextButton(onClick = { deleting = true }, enabled = !pending, colors = actions) { Text("Delete") }
      }
    }
  }
  if (deleting) AlertDialog(onDismissRequest = { deleting = false }, title = { Text("Delete ${task.title}?") },
    text = { Text("It stops running and its allowance is revoked. Transactions already confirmed stay on Base.") },
    confirmButton = { TextButton(onClick = { deleting = false; onAct(task.code, "cancel", null) }) { Text("Delete") } },
    dismissButton = { TextButton(onClick = { deleting = false }) { Text("Keep") } })
}
