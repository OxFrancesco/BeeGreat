package com.beegreat.app.common

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.beegreat.design.BeeTheme
import com.beegreat.design.Spacing

/** One row of an action sheet. `destructive` rows render in the danger color. */
data class SheetAction(val label: String, val destructive: Boolean = false, val onClick: () -> Unit)

/** Android stand-in for the iOS action-sheet `Alert.alert(title, undefined, [...])` pattern. */
@Composable
fun ActionSheet(title: String, message: String? = null, actions: List<SheetAction>, onDismiss: () -> Unit) {
  val colors = BeeTheme.colors
  ModalBottomSheet(onDismissRequest = onDismiss, containerColor = colors.background) {
    Column(modifier = Modifier.padding(horizontal = Spacing.three).padding(bottom = Spacing.five)) {
      Text(title, style = BeeTheme.typography.barTitle, color = colors.text, modifier = Modifier.padding(vertical = Spacing.two))
      message?.let { Text(it, style = BeeTheme.typography.small, color = colors.textSecondary, modifier = Modifier.padding(bottom = Spacing.two)) }
      for (action in actions) {
        Text(
          action.label,
          style = BeeTheme.typography.body,
          color = if (action.destructive) colors.destructive else colors.text,
          modifier =
            Modifier.fillMaxWidth()
              .heightIn(min = 48.dp)
              .clickable {
                onDismiss()
                action.onClick()
              }
              .padding(vertical = 12.dp),
        )
      }
    }
  }
}

@Composable
fun TextPromptDialog(title: String, initial: String, confirmLabel: String = "Save", onDismiss: () -> Unit, onConfirm: (String) -> Unit) {
  var value by remember(initial) { mutableStateOf(initial) }
  AlertDialog(
    onDismissRequest = onDismiss,
    title = { Text(title) },
    text = { OutlinedTextField(value = value, onValueChange = { value = it }, singleLine = true, modifier = Modifier.fillMaxWidth()) },
    confirmButton = {
      TextButton(
        onClick = {
          onDismiss()
          if (value.isNotBlank()) onConfirm(value.trim())
        }
      ) {
        Text(confirmLabel)
      }
    },
    dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } },
  )
}

@Composable
fun ConfirmDialog(title: String, message: String, confirmLabel: String, onDismiss: () -> Unit, onConfirm: () -> Unit) {
  AlertDialog(
    onDismissRequest = onDismiss,
    title = { Text(title) },
    text = { Text(message) },
    confirmButton = {
      TextButton(
        onClick = {
          onDismiss()
          onConfirm()
        }
      ) {
        Text(confirmLabel, color = BeeTheme.colors.destructive)
      }
    },
    dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } },
  )
}
