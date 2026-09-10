package com.beegreat.app.nfc

import android.app.Activity
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.beegreat.app.LocalAppContainer
import com.beegreat.app.common.ConfirmDialog
import com.beegreat.app.common.TextPromptDialog
import com.beegreat.app.profile.FilledButton
import com.beegreat.app.profile.OutlineButton
import com.beegreat.app.profile.SettingsCard
import com.beegreat.app.profile.SettingsToggle
import com.beegreat.app.shell.LocalNavigator
import com.beegreat.convex.nfc.NfcAction
import com.beegreat.convex.nfc.NfcDefinition
import com.beegreat.design.BeeTheme
import com.beegreat.design.MaxContentWidth
import com.beegreat.design.Radius
import com.beegreat.design.Spacing
import com.beegreat.design.components.Hairline
import com.beegreat.design.components.ScreenHeader
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.launch

private val WATER_AMOUNTS = listOf(150, 250, 330, 500, 750)

/**
 * Port of `nfc-actions-screen.tsx` and `reminder-actions-screen.tsx` in one
 * screen: water taps and reminder taps, each writable to a tag and editable
 * without rewriting the tag.
 */
@Composable
fun NfcActionsScreen(kind: String = "hydration") {
  val container = LocalAppContainer.current
  val navigator = LocalNavigator.current
  val context = LocalContext.current
  val scope = rememberCoroutineScope()
  val colors = BeeTheme.colors
  val flow = remember { container.nfcActions.list().map { it.getOrNull() } }
  val actions by flow.collectAsStateWithLifecycle(initialValue = null)
  var label by remember { mutableStateOf("") }
  var amount by remember { mutableStateOf(250) }
  var writing by remember { mutableStateOf<String?>(null) }
  var creating by remember { mutableStateOf(false) }
  var notice by remember { mutableStateOf<String?>(null) }
  var error by remember { mutableStateOf<String?>(null) }
  var renaming by remember { mutableStateOf<NfcAction?>(null) }
  var deleting by remember { mutableStateOf<NfcAction?>(null) }
  var editingAmount by remember { mutableStateOf<NfcAction?>(null) }
  val reminders = kind == "reminder"
  val shown = actions?.filter { it.definition.type == kind } ?: emptyList()

  suspend fun writeTag(action: NfcAction) {
    val activity = context as? Activity ?: return
    writing = action.id
    error = null
    notice = "Hold your phone near the NFC tag."
    try {
      NfcTagWriter.write(activity, action.tagUrl)
      notice = "Your BeeGreat tap action is ready."
    } catch (e: Exception) {
      notice = null
      error = e.message ?: "The tag could not be written."
    } finally {
      writing = null
    }
  }

  fun createAndWrite() {
    val name = label.trim()
    if (name.isEmpty() || creating) return
    creating = true
    error = null
    scope.launch {
      try {
        val action = container.nfcActions.create(name, if (reminders) NfcDefinition("reminder") else NfcDefinition("hydration", amount))
        label = ""
        writeTag(action)
      } catch (e: Exception) {
        error = e.message ?: "Could not create the tap action."
      } finally {
        creating = false
      }
    }
  }

  Box(modifier = Modifier.fillMaxSize().background(colors.background), contentAlignment = Alignment.TopCenter) {
    Column(
      modifier = Modifier.widthIn(max = MaxContentWidth).fillMaxSize().verticalScroll(rememberScrollState()).imePadding().padding(horizontal = Spacing.three).padding(bottom = Spacing.five),
      verticalArrangement = Arrangement.spacedBy(Spacing.three),
    ) {
      ScreenHeader(title = if (reminders) "Reminders" else "Tap actions", onBack = navigator::back)
      Text(
        if (reminders) "Tap the tag when it’s done. Bee counts each completion toward the goal." else "One tag, one useful action. Stick it on your bottle; a tap logs the water.",
        style = BeeTheme.typography.small,
        color = colors.textSecondary,
      )
      notice?.let { Text(it, style = BeeTheme.typography.small, color = colors.text) }
      error?.let { Text(it, style = BeeTheme.typography.small, color = colors.destructive) }
      for (action in shown) {
        SettingsCard {
          Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Column(modifier = Modifier.weight(1f)) {
              Text(action.label, style = BeeTheme.typography.body, color = colors.text)
              Text(
                buildList {
                  add(if (reminders) "${action.completionCount} done" else "Add ${action.definition.amountMl ?: 0} ml of water")
                  if (!reminders && action.completionCount > 0) add("${action.completionCount} taps")
                }.joinToString(" · "),
                style = BeeTheme.typography.small,
                color = colors.textSecondary,
              )
            }
          }
          SettingsToggle("Enabled", if (action.enabled) "Taps run this action" else "Taps are ignored", checked = action.enabled) { enabled ->
            scope.launch { runCatching { container.nfcActions.update(action.id, action.updatedAt, enabled = enabled) }.onFailure { error = it.message } }
          }
          Row(horizontalArrangement = Arrangement.spacedBy(Spacing.two)) {
            FilledButton(if (writing == action.id) "Hold near tag…" else "Write NFC tag", enabled = writing == null, modifier = Modifier.weight(1f)) { scope.launch { writeTag(action) } }
            OutlineButton("Rename", modifier = Modifier.weight(1f)) { renaming = action }
            if (!reminders) OutlineButton("Amount", modifier = Modifier.weight(1f)) { editingAmount = action }
            OutlineButton("Delete", destructive = true, modifier = Modifier.weight(1f)) { deleting = action }
          }
        }
      }
      SettingsCard {
        Text(if (reminders) "New reminder tag" else "New tap action", style = BeeTheme.typography.smallBold, color = colors.textSecondary)
        BasicTextField(
          value = label,
          onValueChange = { label = it },
          singleLine = true,
          textStyle = BeeTheme.typography.body.copy(color = colors.text),
          cursorBrush = SolidColor(colors.text),
          modifier = Modifier.fillMaxWidth().heightIn(min = 44.dp).clip(RoundedCornerShape(Radius.compact)).background(colors.background).border(Hairline, colors.border, RoundedCornerShape(Radius.compact)).padding(horizontal = Spacing.two + Spacing.half, vertical = Spacing.two),
          decorationBox = { inner ->
            if (label.isEmpty()) Text(if (reminders) "Water the plants" else "Water bottle", style = BeeTheme.typography.body, color = colors.textSecondary)
            inner()
          },
        )
        if (!reminders) AmountPicker(amount) { amount = it }
        FilledButton(if (creating) "Creating…" else "Create and write tag", enabled = label.isNotBlank() && !creating, modifier = Modifier.fillMaxWidth()) { createAndWrite() }
      }
    }
  }

  renaming?.let { action ->
    TextPromptDialog("Rename", action.label, onDismiss = { renaming = null }) { title -> scope.launch { runCatching { container.nfcActions.update(action.id, action.updatedAt, label = title) }.onFailure { error = it.message } } }
  }
  deleting?.let { action ->
    ConfirmDialog("Delete ${if (reminders) "reminder" else "tap action"}?", "“${action.label}” stops working; the tag keeps its link but taps will say the action is gone.", "Delete", onDismiss = { deleting = null }) {
      scope.launch { runCatching { container.nfcActions.remove(action.id) }.onFailure { error = it.message } }
    }
  }
  editingAmount?.let { action ->
    var picked by remember(action.id) { mutableStateOf(action.definition.amountMl ?: 250) }
    AlertDialog(
      onDismissRequest = { editingAmount = null },
      title = { Text("Water per tap") },
      text = {
        Column(verticalArrangement = Arrangement.spacedBy(Spacing.two)) {
          AmountPicker(picked) { picked = it }
          Text("The same NFC tag will use the new amount, no rewrite needed.", style = BeeTheme.typography.small, color = colors.textSecondary)
        }
      },
      confirmButton = {
        TextButton(onClick = {
          editingAmount = null
          scope.launch { runCatching { container.nfcActions.update(action.id, action.updatedAt, definition = NfcDefinition("hydration", picked)) }.onFailure { error = it.message } }
        }) { Text("Save") }
      },
      dismissButton = { TextButton(onClick = { editingAmount = null }) { Text("Cancel") } },
    )
  }
}

@Composable
private fun AmountPicker(value: Int, onChange: (Int) -> Unit) {
  val colors = BeeTheme.colors
  Row(horizontalArrangement = Arrangement.spacedBy(Spacing.one)) {
    for (option in WATER_AMOUNTS) {
      val selected = option == value
      Box(
        modifier = Modifier.heightIn(min = 36.dp).clip(CircleShape).background(if (selected) colors.secondary else colors.backgroundElement).clickable { onChange(option) }.padding(horizontal = Spacing.two),
        contentAlignment = Alignment.Center,
      ) {
        Text("$option ml", style = BeeTheme.typography.small.copy(fontFeatureSettings = "tnum"), color = if (selected) colors.secondaryForeground else colors.text)
      }
    }
  }
}
