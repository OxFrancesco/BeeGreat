package com.beegreat.app.bee.cards

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Verified
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.beegreat.app.LocalAppContainer
import com.beegreat.app.shell.LocalNavigator
import com.beegreat.contract.BeeUiComponent
import com.beegreat.design.BeeTheme
import com.beegreat.design.Radius
import com.beegreat.design.Spacing
import com.beegreat.design.components.CombCell
import com.beegreat.design.components.Hairline
import java.time.Instant
import java.time.LocalDate
import java.time.LocalTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.launch

/** The local-day deadline a highlight defaults to. Port of `endOfLocalDay`. */
fun endOfLocalDay(dayOffset: Long = 0): Long =
  LocalDate.now().plusDays(dayOffset).atTime(LocalTime.of(23, 59, 59, 999_000_000)).atZone(ZoneId.systemDefault()).toInstant().toEpochMilli()

fun formatHighlightExpiry(timestamp: Long): String =
  DateTimeFormatter.ofPattern("EEE h:mm a").format(Instant.ofEpochMilli(timestamp).atZone(ZoneId.systemDefault()))

private fun isSameLocalDay(a: Long, b: Long): Boolean {
  val zone = ZoneId.systemDefault()
  return Instant.ofEpochMilli(a).atZone(zone).toLocalDate() == Instant.ofEpochMilli(b).atZone(zone).toLocalDate()
}

private enum class PreviewStatus {
  Editing,
  Saving,
  Saved,
  Cancelling,
  Cancelled,
}

/**
 * Editable, uncommitted first-focus preview. The app owns the atomic write:
 * confirming submits one idempotent `firstFocus:confirmPlan`, and the newest
 * card registers that same mutation so a typed or spoken "yes" runs it.
 */
@Composable
fun FirstFocusPreviewCard(preview: BeeUiComponent.FirstFocus) {
  val colors = BeeTheme.colors
  val container = LocalAppContainer.current
  val navigator = LocalNavigator.current
  val scope = rememberCoroutineScope()
  val confirmationFlow = remember(preview.requestId) { container.firstFocus.confirmation(preview.requestId).map { it.getOrNull() to true } }
  val (confirmation, loaded) = confirmationFlow.collectAsStateWithLifecycle(initialValue = null to false).value

  var goalTitle by remember(preview.requestId) { mutableStateOf(preview.goalTitle) }
  var projectTitle by remember(preview.requestId) { mutableStateOf(preview.projectTitle) }
  var taskTitle by remember(preview.requestId) { mutableStateOf(preview.taskTitle) }
  var expiresAt by remember(preview.requestId) { mutableStateOf(preview.highlightExpiresAt?.toLong() ?: endOfLocalDay()) }
  var status by remember(preview.requestId) { mutableStateOf(PreviewStatus.Editing) }
  var error by remember(preview.requestId) { mutableStateOf<String?>(null) }

  val valid = goalTitle.isNotBlank() && projectTitle.isNotBlank() && taskTitle.isNotBlank()
  val busy = !loaded || confirmation != null || status == PreviewStatus.Saved || status == PreviewStatus.Saving || status == PreviewStatus.Cancelling

  suspend fun save(): Boolean {
    if (!valid || busy) return false
    status = PreviewStatus.Saving
    error = null
    return try {
      val result = container.firstFocus.confirmPlan(preview.requestId, true, goalTitle.trim(), projectTitle.trim(), taskTitle.trim(), expiresAt)
      if (result.status == "cancelled") {
        status = PreviewStatus.Editing
        false
      } else {
        status = PreviewStatus.Saved
        true
      }
    } catch (e: Exception) {
      status = PreviewStatus.Editing
      error = e.message ?: "The plan could not be saved."
      false
    }
  }

  val latestSave by rememberUpdatedState(suspend { save() })
  val registrable = status == PreviewStatus.Editing && loaded && confirmation == null
  DisposableEffect(preview.requestId, registrable) {
    if (!registrable) return@DisposableEffect onDispose {}
    val unregister = container.beeAgent.registerPendingFirstFocus { latestSave() }
    onDispose(unregister)
  }

  fun cancel() {
    if (busy) return
    status = PreviewStatus.Cancelling
    error = null
    scope.launch {
      try {
        val result =
          container.firstFocus.confirmPlan(
            preview.requestId,
            false,
            goalTitle.trim().ifEmpty { preview.goalTitle },
            projectTitle.trim().ifEmpty { preview.projectTitle },
            taskTitle.trim().ifEmpty { preview.taskTitle },
            expiresAt,
          )
        status = if (result.status == "cancelled") PreviewStatus.Cancelled else PreviewStatus.Saved
      } catch (e: Exception) {
        status = PreviewStatus.Editing
        error = e.message ?: "The preview could not be cancelled."
      }
    }
  }

  val cardShape = RoundedCornerShape(Radius.card)
  if (confirmation != null || status == PreviewStatus.Saved) {
    Column(
      modifier = Modifier.fillMaxWidth().clip(cardShape).background(colors.secondary).padding(Spacing.three),
      verticalArrangement = Arrangement.spacedBy(Spacing.two),
    ) {
      Row(horizontalArrangement = Arrangement.spacedBy(Spacing.two), verticalAlignment = Alignment.CenterVertically) {
        Icon(Icons.Filled.Verified, contentDescription = null, tint = colors.secondaryForeground, modifier = Modifier.size(24.dp))
        Column(modifier = Modifier.weight(1f)) {
          Text("Focus saved", style = BeeTheme.typography.smallBold, color = colors.secondaryForeground)
          Text(
            confirmation?.let { listOfNotNull(it.goalTitle, it.projectTitle, it.taskTitle).joinToString(" · ") } ?: "Your saved focus is available in the Hive.",
            style = BeeTheme.typography.small,
            color = colors.secondaryForeground,
          )
        }
      }
      Box(
        modifier = Modifier.fillMaxWidth().heightIn(min = 44.dp).clip(CircleShape).background(colors.primary).clickable { navigator.openHive() },
        contentAlignment = Alignment.Center,
      ) {
        Text("Meet your GolieBee", style = BeeTheme.typography.smallBold, color = colors.primaryForeground)
      }
    }
    return
  }

  if (status == PreviewStatus.Cancelled) {
    Column(
      modifier = Modifier.fillMaxWidth().clip(cardShape).background(colors.card).border(Hairline, colors.border, cardShape).padding(Spacing.three),
      verticalArrangement = Arrangement.spacedBy(Spacing.one),
    ) {
      Text("Preview cancelled", style = BeeTheme.typography.smallBold, color = colors.text)
      Text("Nothing was created. Tell Bee when you are ready to try again.", style = BeeTheme.typography.small, color = colors.textSecondary)
    }
    return
  }

  Column(
    modifier = Modifier.fillMaxWidth().clip(cardShape).background(colors.card).border(Hairline, colors.border, cardShape).padding(Spacing.three),
    verticalArrangement = Arrangement.spacedBy(Spacing.three),
  ) {
    Row(horizontalArrangement = Arrangement.spacedBy(Spacing.two), verticalAlignment = Alignment.CenterVertically) {
      CombCell(size = 44.dp, progress = 0f)
      Column(modifier = Modifier.weight(1f)) {
        Text("Your first focus", style = BeeTheme.typography.smallBold, color = colors.text)
        Text("Review everything before Bee creates it.", style = BeeTheme.typography.small, color = colors.textSecondary)
      }
    }
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.two)) {
      EditableField("GOAL", goalTitle, { goalTitle = it }, !busy)
      EditableField("PROJECT", projectTitle, { projectTitle = it }, !busy)
      EditableField("FIRST TASK · HIGHLIGHT", taskTitle, { taskTitle = it }, !busy)
    }
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.two)) {
      Column(modifier = Modifier.weight(1f)) {
        Text("Highlight until", style = BeeTheme.typography.smallBold, color = colors.text)
        Text(formatHighlightExpiry(expiresAt), style = BeeTheme.typography.small, color = colors.textSecondary)
      }
      DayChip("Today", isSameLocalDay(expiresAt, endOfLocalDay()), !busy) { expiresAt = endOfLocalDay() }
      DayChip("Tomorrow", isSameLocalDay(expiresAt, endOfLocalDay(1)), !busy) { expiresAt = endOfLocalDay(1) }
    }
    error?.let { Text(it, style = BeeTheme.typography.small, color = colors.destructive) }
    ConfirmRow(
      onYes = { scope.launch { save() } },
      onNo = ::cancel,
      yesLabel = if (status == PreviewStatus.Saving) "Creating…" else "Create my focus",
      noLabel = if (status == PreviewStatus.Cancelling) "Cancelling…" else "Cancel",
      enabled = !busy && valid,
    )
    Text("You can also say or type \u201CYes\u201D.", style = BeeTheme.typography.small, color = colors.textSecondary)
  }
}

@Composable
private fun EditableField(label: String, value: String, onChange: (String) -> Unit, enabled: Boolean) {
  val colors = BeeTheme.colors
  Column(verticalArrangement = Arrangement.spacedBy(Spacing.half)) {
    Text(label, style = BeeTheme.typography.smallBold, color = colors.textSecondary)
    BasicTextField(
      value = value,
      onValueChange = onChange,
      enabled = enabled,
      modifier =
        Modifier.fillMaxWidth()
          .clip(RoundedCornerShape(Radius.compact))
          .background(colors.background)
          .border(Hairline, colors.border, RoundedCornerShape(Radius.compact))
          .padding(horizontal = Spacing.two + Spacing.half, vertical = Spacing.two),
      textStyle = BeeTheme.typography.body.copy(color = colors.text),
      cursorBrush = SolidColor(colors.text),
      singleLine = true,
    )
  }
}

@Composable
private fun DayChip(label: String, selected: Boolean, enabled: Boolean, onClick: () -> Unit) {
  val colors = BeeTheme.colors
  Box(
    modifier =
      Modifier.heightIn(min = 36.dp)
        .clip(CircleShape)
        .background(if (selected) colors.secondary else colors.backgroundElement)
        .clickable(enabled = enabled, onClick = onClick)
        .padding(horizontal = Spacing.two + Spacing.half),
    contentAlignment = Alignment.Center,
  ) {
    Text(label, style = BeeTheme.typography.smallBold, color = if (selected) colors.secondaryForeground else colors.text)
  }
}
