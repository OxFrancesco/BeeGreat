package com.beegreat.app.profile

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextAlign
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.beegreat.app.LocalAppContainer
import com.beegreat.app.common.ConfirmDialog
import com.beegreat.app.shell.LocalNavigator
import com.beegreat.convex.jobs.AgentJob
import com.beegreat.convex.jobs.JobGrant
import com.beegreat.convex.jobs.JobSchedule
import com.beegreat.design.BeeTheme
import com.beegreat.design.MaxContentWidth
import com.beegreat.design.Spacing
import com.beegreat.design.components.ScreenHeader
import java.text.DateFormat
import java.util.Date
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.launch

private fun formatDate(at: Long) = DateFormat.getDateTimeInstance(DateFormat.MEDIUM, DateFormat.SHORT).format(Date(at))

/** Port of `scheduleLabel` in `jobs.tsx`. */
fun scheduleLabel(schedule: JobSchedule): String {
  when (schedule.kind) {
    "once" -> return "Once · ${formatDate(schedule.at ?: 0)}"
    "interval" -> {
      val minutes = (schedule.everyMs ?: 0) / 60_000
      if (minutes % 1_440 == 0L) return "Every ${minutes / 1_440} day${if (minutes == 1_440L) "" else "s"}"
      if (minutes % 60 == 0L) return "Every ${minutes / 60} hour${if (minutes == 60L) "" else "s"}"
      return "Every $minutes minutes"
    }
  }
  val noun = when (schedule.frequency) { "daily" -> "day"; "weekly" -> "week"; "monthly" -> "month"; else -> "year" }
  val interval = schedule.interval ?: 1
  return "Every ${if (interval == 1) "" else "$interval "}$noun"
}

private sealed interface JobDialog {
  data class Cancel(val job: AgentJob) : JobDialog

  data class Grant(val job: AgentJob, val grant: JobGrant, val approve: Boolean) : JobDialog
}

/** Port of `jobs.tsx`: scheduled agent Jobs with pause/resume/cancel/run now and scoped wallet grants. */
@Composable
fun JobsScreen() {
  val container = LocalAppContainer.current
  val navigator = LocalNavigator.current
  val scope = rememberCoroutineScope()
  val colors = BeeTheme.colors
  val flow = remember { combine(container.jobs.jobs(), container.jobs.grants()) { jobs, grants -> jobs.getOrNull() to (grants.getOrNull() ?: emptyList()) } }
  val (jobs, grants) = flow.collectAsStateWithLifecycle(initialValue = null to emptyList()).value
  var working by remember { mutableStateOf<String?>(null) }
  var error by remember { mutableStateOf<String?>(null) }
  var dialog by remember { mutableStateOf<JobDialog?>(null) }
  val now = System.currentTimeMillis()

  fun run(jobId: String, block: suspend () -> Unit) {
    working = jobId
    error = null
    scope.launch {
      runCatching { block() }.onFailure { error = it.message ?: "That didn’t go through." }
      working = null
    }
  }

  Box(modifier = Modifier.fillMaxSize().background(colors.background), contentAlignment = Alignment.TopCenter) {
    Column(
      modifier = Modifier.widthIn(max = MaxContentWidth).fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = Spacing.three).padding(bottom = Spacing.five),
      verticalArrangement = Arrangement.spacedBy(Spacing.three),
    ) {
      ScreenHeader(title = "Agent Jobs", onBack = navigator::back)
      Text("Bee runs these on a schedule and reports back in the app or Telegram. Ask Bee in chat to create one.", style = BeeTheme.typography.small, color = colors.textSecondary)
      error?.let { Text(it, style = BeeTheme.typography.small, color = colors.destructive) }
      when {
        jobs == null -> Box(modifier = Modifier.fillMaxWidth().padding(top = Spacing.six), contentAlignment = Alignment.Center) { CircularProgressIndicator(color = colors.primary) }
        jobs.isEmpty() ->
          Column(modifier = Modifier.fillMaxWidth().padding(top = Spacing.six), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(Spacing.two)) {
            Text("No Jobs yet", style = BeeTheme.typography.smallBold, color = colors.text)
            Text("Try “remind me every morning what to focus on” in chat.", style = BeeTheme.typography.small, color = colors.textSecondary, textAlign = TextAlign.Center)
          }
        else ->
          for (job in jobs.sortedWith(compareBy<AgentJob> { it.status != "active" }.thenByDescending { it.updatedAt })) {
            val grant = grants.firstOrNull { it.jobId == job.id }
            val expiresAt = grant?.expiresAt
            val grantStatus = if (grant?.status == "active" && expiresAt != null && expiresAt <= now) "expired" else grant?.status
            SettingsCard {
              Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Text(job.title, style = BeeTheme.typography.body, color = colors.text, modifier = Modifier.weight(1f))
                Text(job.status.replaceFirstChar { it.uppercase() }, style = BeeTheme.typography.smallBold, color = if (job.status == "active") colors.primary else colors.textSecondary)
              }
              Text(job.instruction, style = BeeTheme.typography.small, color = colors.textSecondary)
              Text(
                buildList {
                  add(scheduleLabel(job.schedule))
                  job.nextRunAt?.takeIf { job.status == "active" }?.let { add("Next ${formatDate(it)}") }
                  job.lastRunAt?.let { add("Last ${formatDate(it)}") }
                  if (job.delivery.contains("telegram")) add("Telegram")
                  if (job.consecutiveFailures > 0) add("${job.consecutiveFailures} failed in a row")
                }.joinToString(" · "),
                style = BeeTheme.typography.small,
                color = if (job.consecutiveFailures > 0) colors.destructive else colors.textSecondary,
              )
              if (grant != null) {
                Text(
                  "Wallet access: ${grant.allowedActions.joinToString(", ") { it.replace('_', ' ') }} · ${grant.poolAddress.take(6)}…${grant.poolAddress.takeLast(4)} · ${grantStatus ?: "pending"}",
                  style = BeeTheme.typography.small,
                  color = colors.textSecondary,
                )
                if (grantStatus == "pending" || grantStatus == "expired") FilledButton("Approve for 30 days", enabled = working == null) { dialog = JobDialog.Grant(job, grant, true) }
                else if (grantStatus == "active") OutlineButton("Revoke wallet access", destructive = true, enabled = working == null) { dialog = JobDialog.Grant(job, grant, false) }
              }
              if (job.status == "active" || job.status == "paused") {
                Row(horizontalArrangement = Arrangement.spacedBy(Spacing.two)) {
                  if (job.status == "active") OutlineButton("Pause", enabled = working == null, modifier = Modifier.weight(1f)) { run(job.id) { container.jobs.pause(job.id) } }
                  else FilledButton("Resume", enabled = working == null, modifier = Modifier.weight(1f)) { run(job.id) { container.jobs.resume(job.id) } }
                  OutlineButton("Run now", enabled = working == null, modifier = Modifier.weight(1f)) { run(job.id) { container.jobs.runNow(job.id) } }
                  OutlineButton("Cancel", destructive = true, enabled = working == null, modifier = Modifier.weight(1f)) { dialog = JobDialog.Cancel(job) }
                }
              }
            }
          }
      }
    }
  }

  when (val current = dialog) {
    null -> Unit
    is JobDialog.Cancel ->
      ConfirmDialog("Cancel Job?", "“${current.job.title}” will stop running. This cannot be undone.", "Cancel Job", onDismiss = { dialog = null }) {
        run(current.job.id) { container.jobs.cancel(current.job.id) }
      }
    is JobDialog.Grant -> {
      val actions = current.grant.allowedActions.joinToString(", ") { it.replace('_', ' ') }
      val pool = "${current.grant.poolAddress.take(6)}…${current.grant.poolAddress.takeLast(4)}"
      ConfirmDialog(
        if (current.approve) "Approve scoped wallet access?" else "Revoke wallet access?",
        if (current.approve) "For 30 days, “${current.job.title}” may perform $actions on pool $pool with your Bee smart wallet." else "“${current.job.title}” will no longer be able to act on pool $pool.",
        if (current.approve) "Approve 30 days" else "Revoke",
        onDismiss = { dialog = null },
      ) {
        run(current.job.id) { if (current.approve) container.jobs.approveGrant(current.job.id) else container.jobs.revokeGrant(current.job.id) }
      }
    }
  }
}
