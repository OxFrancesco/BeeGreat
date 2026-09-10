package com.beegreat.app.mind

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.OpenInNew
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Delete
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import coil3.compose.AsyncImage
import com.beegreat.app.LocalAppContainer
import com.beegreat.app.bee.CardMarkdown
import com.beegreat.app.bee.cards.openUrl
import com.beegreat.app.common.ConfirmDialog
import com.beegreat.app.shell.LocalNavigator
import com.beegreat.contract.bookmarkKindLabel
import com.beegreat.contract.bookmarkSourceLabel
import com.beegreat.convex.bookmarks.Bookmark
import com.beegreat.design.BeeTheme
import com.beegreat.design.MaxContentWidth
import com.beegreat.design.Radius
import com.beegreat.design.Spacing
import com.beegreat.design.components.Hairline
import com.beegreat.design.components.ScreenHeader
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.launch

/** Port of `(tabs)/mind/[bookmarkId].tsx`: read, edit title and note, manage labels, retry, delete. */
@Composable
fun BookmarkDetailScreen(bookmarkId: String) {
  val container = LocalAppContainer.current
  val navigator = LocalNavigator.current
  val context = LocalContext.current
  val scope = rememberCoroutineScope()
  val colors = BeeTheme.colors
  val flow = remember(bookmarkId) { container.bookmarks.bookmark(bookmarkId).map { it.getOrNull() to true } }
  val (bookmark, loaded) = flow.collectAsStateWithLifecycle(initialValue = null to false).value
  var title by remember { mutableStateOf("") }
  var note by remember { mutableStateOf("") }
  var newLabel by remember { mutableStateOf("") }
  var saving by remember { mutableStateOf(false) }
  var retrying by remember { mutableStateOf(false) }
  var confirmingDelete by remember { mutableStateOf(false) }
  var error by remember { mutableStateOf<String?>(null) }

  LaunchedEffect(bookmark?.id, bookmark?.updatedAt) {
    bookmark?.let {
      title = it.title ?: ""
      note = it.note ?: ""
    }
  }

  Box(modifier = Modifier.fillMaxSize().background(colors.background), contentAlignment = Alignment.TopCenter) {
    when {
      !loaded -> CircularProgressIndicator(color = colors.primary, modifier = Modifier.padding(top = Spacing.six))
      bookmark == null -> Text("The bookmark no longer exists.", style = BeeTheme.typography.body, color = colors.textSecondary, modifier = Modifier.padding(Spacing.six))
      else -> {
        val hasEdits = title.trim() != (bookmark.title ?: "") || note.trim() != (bookmark.note ?: "")
        Column(
          modifier = Modifier.widthIn(max = MaxContentWidth).fillMaxWidth().verticalScroll(rememberScrollState()).imePadding().padding(horizontal = Spacing.three).padding(bottom = Spacing.five),
          verticalArrangement = Arrangement.spacedBy(Spacing.three),
        ) {
          ScreenHeader(title = if (bookmark.kind == "tweet") "Post" else bookmarkKindLabel(bookmark.kind), onBack = navigator::back) {
            IconButton(onClick = { openUrl(context, bookmark.url) }) { Icon(Icons.AutoMirrored.Filled.OpenInNew, contentDescription = "Open link", tint = colors.textSecondary, modifier = Modifier.size(20.dp)) }
            IconButton(onClick = { confirmingDelete = true }) { Icon(Icons.Filled.Delete, contentDescription = "Delete bookmark", tint = colors.destructive, modifier = Modifier.size(20.dp)) }
          }
          bookmark.meta?.imageUrl?.let {
            AsyncImage(model = it, contentDescription = null, contentScale = ContentScale.Crop, modifier = Modifier.fillMaxWidth().height(200.dp).clip(RoundedCornerShape(Radius.card)))
          }
          Column(verticalArrangement = Arrangement.spacedBy(Spacing.one)) {
            BasicTextField(
              value = title,
              onValueChange = { title = it },
              textStyle = BeeTheme.typography.sectionTitle.copy(color = colors.text),
              cursorBrush = SolidColor(colors.text),
              modifier = Modifier.fillMaxWidth(),
              decorationBox = { inner ->
                if (title.isEmpty()) Text(bookmarkSourceLabel(bookmark.url, bookmark.meta?.handle, bookmark.meta?.author, bookmark.kind), style = BeeTheme.typography.sectionTitle, color = colors.textSecondary)
                inner()
              },
            )
            Text(bookmarkSourceLabel(bookmark.url, bookmark.meta?.handle, bookmark.meta?.author, bookmark.kind), style = BeeTheme.typography.small, color = colors.textSecondary)
          }
          if (bookmark.isWorking) {
            Row(horizontalArrangement = Arrangement.spacedBy(Spacing.two), verticalAlignment = Alignment.CenterVertically) {
              CircularProgressIndicator(modifier = Modifier.size(16.dp), strokeWidth = 2.dp, color = colors.textSecondary)
              Text("Bee is reading this for you…", style = BeeTheme.typography.small, color = colors.textSecondary)
            }
          } else if (bookmark.status == "failed") {
            Column(
              modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(Radius.card)).border(Hairline, colors.destructive, RoundedCornerShape(Radius.card)).padding(Spacing.three),
              verticalArrangement = Arrangement.spacedBy(Spacing.two),
            ) {
              Text("Bee couldn’t read this link", style = BeeTheme.typography.smallBold, color = colors.destructive)
              Text(bookmark.errorMessage ?: "The page did not load.", style = BeeTheme.typography.small, color = colors.textSecondary)
              PillButton(if (retrying) "Retrying…" else "Try again", enabled = !retrying) {
                retrying = true
                scope.launch {
                  runCatching { container.bookmarks.retry(bookmark.id) }.onFailure { error = it.message }
                  retrying = false
                }
              }
            }
          }
          bookmark.summary?.let { Section("In a nutshell") { Text(it, style = BeeTheme.typography.body, color = colors.text) } }
          Section("Labels") {
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(Spacing.one)) {
              for (label in bookmark.labels) {
                Row(
                  modifier = Modifier.heightIn(min = 32.dp).clip(CircleShape).background(colors.backgroundElement).padding(start = Spacing.two + Spacing.half, end = Spacing.one),
                  horizontalArrangement = Arrangement.spacedBy(Spacing.half),
                  verticalAlignment = Alignment.CenterVertically,
                ) {
                  Text(label, style = BeeTheme.typography.small, color = colors.text)
                  Icon(
                    Icons.Filled.Close,
                    contentDescription = "Remove label $label",
                    tint = colors.textSecondary,
                    modifier = Modifier.size(20.dp).clip(CircleShape).clickable { scope.launch { runCatching { container.bookmarks.changeLabel(bookmark.id, label, false) }.onFailure { error = it.message } } }.padding(3.dp),
                  )
                }
              }
            }
            BasicTextField(
              value = newLabel,
              onValueChange = { newLabel = it },
              singleLine = true,
              textStyle = BeeTheme.typography.small.copy(color = colors.text),
              cursorBrush = SolidColor(colors.text),
              keyboardOptions = KeyboardOptions(imeAction = ImeAction.Done),
              keyboardActions =
                KeyboardActions(
                  onDone = {
                    val label = newLabel.trim().lowercase()
                    newLabel = ""
                    if (label.isNotEmpty() && label !in bookmark.labels) scope.launch { runCatching { container.bookmarks.changeLabel(bookmark.id, label, true) }.onFailure { error = it.message } }
                  }
                ),
              modifier = Modifier.fillMaxWidth().heightIn(min = 40.dp).clip(RoundedCornerShape(Radius.compact)).border(Hairline, colors.border, RoundedCornerShape(Radius.compact)).padding(horizontal = Spacing.two + Spacing.half, vertical = Spacing.two),
              decorationBox = { inner ->
                if (newLabel.isEmpty()) Text("Add a label", style = BeeTheme.typography.small, color = colors.textSecondary)
                inner()
              },
            )
          }
          Section("A note for future you") {
            BasicTextField(
              value = note,
              onValueChange = { note = it },
              textStyle = BeeTheme.typography.body.copy(color = colors.text),
              cursorBrush = SolidColor(colors.text),
              minLines = 2,
              modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(Radius.card)).background(colors.card).border(Hairline, colors.border, RoundedCornerShape(Radius.card)).padding(Spacing.three),
              decorationBox = { inner ->
                if (note.isEmpty()) Text("Why did you save this?", style = BeeTheme.typography.body, color = colors.textSecondary)
                inner()
              },
            )
          }
          if (hasEdits) {
            PillButton(if (saving) "Saving…" else "Save changes", enabled = !saving) {
              saving = true
              scope.launch {
                runCatching { container.bookmarks.update(bookmark.id, title.trim(), note.trim()) }.onFailure { error = it.message }
                saving = false
              }
            }
          }
          bookmark.content?.takeIf { it.isNotBlank() }?.let { Section("Full text") { CardMarkdown(it) } }
          error?.let { Text(it, style = BeeTheme.typography.small, color = colors.destructive) }
        }
      }
    }
  }
  if (confirmingDelete && bookmark != null) {
    ConfirmDialog("Delete this bookmark?", "It will be removed from your Mind for good.", "Delete", onDismiss = { confirmingDelete = false }) {
      scope.launch {
        runCatching { container.bookmarks.remove(bookmark.id) }
        navigator.back()
      }
    }
  }
}

@Composable
private fun Section(title: String, content: @Composable () -> Unit) {
  Column(verticalArrangement = Arrangement.spacedBy(Spacing.two)) {
    Text(title, style = BeeTheme.typography.smallBold, color = BeeTheme.colors.textSecondary)
    content()
  }
}

@Composable
fun PillButton(label: String, enabled: Boolean = true, secondary: Boolean = false, onClick: () -> Unit) {
  val colors = BeeTheme.colors
  Box(
    modifier =
      Modifier.fillMaxWidth()
        .heightIn(min = 44.dp)
        .clip(CircleShape)
        .background(if (!enabled) colors.backgroundElement else if (secondary) colors.card else colors.primary)
        .then(if (secondary) Modifier.border(Hairline, colors.border, CircleShape) else Modifier)
        .clickable(enabled = enabled, onClick = onClick),
    contentAlignment = Alignment.Center,
  ) {
    Text(label, style = BeeTheme.typography.smallBold, color = if (!enabled) colors.textSecondary else if (secondary) colors.text else colors.primaryForeground)
  }
}
