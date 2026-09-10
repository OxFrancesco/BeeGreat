package com.beegreat.app.bee

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Icon
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.ChatBubbleOutline
import androidx.compose.material.icons.filled.Inventory2
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.beegreat.app.LocalAppContainer
import com.beegreat.convex.chat.ChatThread
import com.beegreat.design.BeeTheme
import com.beegreat.design.Spacing
import com.beegreat.design.components.BeeRowCard
import com.beegreat.design.components.ScreenHeader
import java.text.DateFormat
import java.util.Date
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.launch

/** Port of `threads.tsx`: switch, start, rename, archive, and unarchive conversations. */
@Composable
fun ThreadsSheet(onDismiss: () -> Unit) {
  val container = LocalAppContainer.current
  val scope = rememberCoroutineScope()
  val colors = BeeTheme.colors
  val threadsFlow = remember { container.chat.threads().map { it.getOrNull() ?: emptyList() } }
  val threads by threadsFlow.collectAsStateWithLifecycle(initialValue = emptyList())
  val activeFlow = remember { container.chat.activeThread().map { it.getOrNull() ?: 0 } }
  val active by activeFlow.collectAsStateWithLifecycle(initialValue = 0)
  var showArchived by remember { mutableStateOf(false) }
  var renaming by remember { mutableStateOf<ChatThread?>(null) }

  val (archived, open) = threads.partition { it.archivedAt != null }

  ModalBottomSheet(onDismissRequest = onDismiss, sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true), containerColor = colors.background) {
    Column(modifier = Modifier.padding(horizontal = Spacing.three).padding(bottom = Spacing.five), verticalArrangement = Arrangement.spacedBy(Spacing.three)) {
      ScreenHeader(title = "Conversations")
      BeeRowCard(onClick = { scope.launch { runCatching { container.chat.createThread() }; onDismiss() } }) {
        Icon(Icons.Filled.Add, contentDescription = null, tint = colors.textSecondary)
        Text("Start a new conversation", style = BeeTheme.typography.body, color = colors.text, modifier = Modifier.weight(1f))
      }
      LazyColumn(verticalArrangement = Arrangement.spacedBy(Spacing.two), modifier = Modifier.heightIn(max = 480.dp)) {
        items(open, key = { it.id }) { thread ->
          ThreadRow(
            thread = thread,
            selected = thread.id == active,
            onClick = { scope.launch { runCatching { container.chat.setActiveThread(thread.id) }; onDismiss() } },
            onRename = { renaming = thread },
            onArchive = { scope.launch { runCatching { container.chat.setThreadArchived(thread.id, true) } } },
          )
        }
        if (archived.isNotEmpty()) {
          item(key = "archived-toggle") {
            Text(
              if (showArchived) "Hide archived (${archived.size})" else "Show archived (${archived.size})",
              style = BeeTheme.typography.smallBold,
              color = colors.textSecondary,
              modifier = Modifier.clickable { showArchived = !showArchived }.padding(vertical = Spacing.two),
            )
          }
          if (showArchived) {
            items(archived, key = { "archived-${it.id}" }) { thread ->
              ThreadRow(
                thread = thread,
                selected = thread.id == active,
                onClick = { scope.launch { runCatching { container.chat.setActiveThread(thread.id) }; onDismiss() } },
                onRename = { renaming = thread },
                onArchive = { scope.launch { runCatching { container.chat.setThreadArchived(thread.id, false) } } },
                archived = true,
              )
            }
          }
        }
      }
    }
  }

  renaming?.let { thread ->
    var title by remember(thread.id) { mutableStateOf(thread.title ?: "") }
    AlertDialog(
      onDismissRequest = { renaming = null },
      title = { Text("Rename conversation") },
      text = { OutlinedTextField(value = title, onValueChange = { title = it }, singleLine = true) },
      confirmButton = {
        TextButton(
          onClick = {
            renaming = null
            if (title.isNotBlank()) scope.launch { runCatching { container.chat.setThreadTitle(thread.id, title.trim()) } }
          }
        ) {
          Text("Save")
        }
      },
      dismissButton = { TextButton(onClick = { renaming = null }) { Text("Cancel") } },
    )
  }
}

@Composable
private fun ThreadRow(thread: ChatThread, selected: Boolean, onClick: () -> Unit, onRename: () -> Unit, onArchive: () -> Unit, archived: Boolean = false) {
  val colors = BeeTheme.colors
  val label = thread.title?.takeIf { it.isNotBlank() } ?: if (thread.id == 0) "First conversation" else "Conversation ${thread.id}"
  val meta = buildList {
    if (thread.source == "imessage") add("iMessage")
    if (thread.createdAt > 0) add(DateFormat.getDateInstance(DateFormat.MEDIUM).format(Date(thread.createdAt)))
  }.joinToString(" · ")
  BeeRowCard(onClick = onClick, onLongClick = onRename) {
    Icon(Icons.Filled.ChatBubbleOutline, contentDescription = null, tint = colors.textSecondary, modifier = Modifier.size(20.dp))
    Column(modifier = Modifier.weight(1f)) {
      Text(label, style = BeeTheme.typography.body, color = colors.text, maxLines = 1, overflow = TextOverflow.Ellipsis)
      if (meta.isNotEmpty()) Text(meta, style = BeeTheme.typography.small, color = colors.textSecondary)
    }
    if (selected) Icon(Icons.Filled.Check, contentDescription = "Active", tint = colors.primary, modifier = Modifier.size(18.dp))
    Icon(
      Icons.Filled.Inventory2,
      contentDescription = if (archived) "Unarchive" else "Archive",
      tint = colors.textSecondary,
      modifier = Modifier.size(18.dp).clickable(onClick = onArchive),
    )
  }
}
