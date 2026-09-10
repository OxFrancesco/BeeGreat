package com.beegreat.app.nfc

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.WaterDrop
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.beegreat.app.LocalAppContainer
import com.beegreat.app.profile.FilledButton
import com.beegreat.app.profile.OutlineButton
import com.beegreat.app.shell.LocalNavigator
import com.beegreat.contract.localDateKey
import com.beegreat.convex.nfc.NfcExecution
import com.beegreat.convex.nfc.NfcUndo
import com.beegreat.design.BeeTheme
import com.beegreat.design.MaxContentWidth
import com.beegreat.design.Spacing
import java.util.TimeZone
import kotlinx.coroutines.launch

private enum class TapStatus {
  Running,
  Success,
  Undone,
  Error,
}

/**
 * Landing for `beegreat.app/tap/<publicId>` and `beegreat://tap/<publicId>`:
 * run the action once, show what changed, offer undo. Port of
 * `nfc-action-execution-screen.tsx`.
 */
@Composable
fun TapScreen(publicId: String) {
  val container = LocalAppContainer.current
  val navigator = LocalNavigator.current
  val scope = rememberCoroutineScope()
  val colors = BeeTheme.colors
  var status by remember(publicId) { mutableStateOf(TapStatus.Running) }
  var result by remember(publicId) { mutableStateOf<NfcExecution?>(null) }
  var undone by remember(publicId) { mutableStateOf<NfcUndo?>(null) }
  var error by remember(publicId) { mutableStateOf<String?>(null) }
  var undoing by remember(publicId) { mutableStateOf(false) }

  LaunchedEffect(publicId) {
    runCatching { container.nfcActions.execute(publicId, localDateKey(), TimeZone.getDefault().id) }
      .onSuccess { result = it; status = TapStatus.Success }
      .onFailure { error = it.message ?: "This tag could not be run."; status = TapStatus.Error }
  }

  val water = result?.action?.definition?.type == "hydration"
  val accent = if (water) Color(0xFF2F8795) else Color(0xFF8A6A12)
  val surface = if (water) Color(0xFFDDF3FA) else Color(0xFFFBEBC2)

  Box(modifier = Modifier.fillMaxSize().background(colors.background), contentAlignment = Alignment.Center) {
    Column(
      modifier = Modifier.widthIn(max = MaxContentWidth).fillMaxWidth().padding(Spacing.four),
      horizontalAlignment = Alignment.CenterHorizontally,
      verticalArrangement = Arrangement.spacedBy(Spacing.three),
    ) {
      when (status) {
        TapStatus.Running -> {
          CircularProgressIndicator(color = colors.primary)
          Text("Running your tap…", style = BeeTheme.typography.body, color = colors.textSecondary)
        }
        TapStatus.Error -> {
          Text("That tag didn’t work", style = BeeTheme.typography.sectionTitle, color = colors.text)
          Text(error ?: "", style = BeeTheme.typography.small, color = colors.textSecondary, textAlign = TextAlign.Center)
          FilledButton("Back to Bee", modifier = Modifier.fillMaxWidth()) { navigator.openBee() }
        }
        TapStatus.Success, TapStatus.Undone -> {
          val done = result ?: return@Column
          Box(modifier = Modifier.size(72.dp).background(surface, CircleShape), contentAlignment = Alignment.Center) {
            Icon(if (water) Icons.Filled.WaterDrop else Icons.Filled.CheckCircle, contentDescription = null, tint = accent, modifier = Modifier.size(36.dp))
          }
          val undoneNow = undone
          Text(
            when {
              undoneNow != null && water -> "Water entry undone"
              undoneNow != null -> "Reminder count undone"
              done.duplicate && water -> "Already logged"
              done.duplicate -> "Already counted"
              water -> "Added ${done.outcome.appliedMl ?: 0} ml"
              else -> "${done.action.label} counted"
            },
            style = BeeTheme.typography.sectionTitle,
            color = colors.text,
            textAlign = TextAlign.Center,
          )
          Text(
            when {
              undoneNow != null && water -> "Removed ${kotlin.math.abs(undoneNow.outcome.appliedMl ?: 0)} ml from today’s water."
              undoneNow != null -> "${undoneNow.action.label} is back to ${undoneNow.action.completionCount} done."
              done.duplicate -> "This tag was tapped a moment ago, so nothing was added twice."
              water -> "${done.action.label} updated today’s water."
              else -> "${done.action.label} is at ${done.action.completionCount} done."
            },
            style = BeeTheme.typography.small,
            color = colors.textSecondary,
            textAlign = TextAlign.Center,
          )
          FilledButton(if (water) "View Water" else "View Reminders", modifier = Modifier.fillMaxWidth()) { if (water) navigator.openBeeHealthy() else navigator.openNfcActions() }
          if (undoneNow == null && !done.duplicate) {
            OutlineButton(if (undoing) "Undoing…" else "Undo", enabled = !undoing, modifier = Modifier.fillMaxWidth()) {
              undoing = true
              scope.launch {
                runCatching { container.nfcActions.undo(done.executionId) }.onSuccess { undone = it; status = TapStatus.Undone }.onFailure { error = it.message }
                undoing = false
              }
            }
          }
        }
      }
    }
  }
}
