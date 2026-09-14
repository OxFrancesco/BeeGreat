package com.beegreat.app.mind

import android.net.Uri
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Star
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.beegreat.app.LocalAppContainer
import com.beegreat.app.profile.FilledButton
import com.beegreat.app.profile.OutlineButton
import com.beegreat.app.profile.openAuthTab
import com.beegreat.app.shell.LocalNavigator
import com.beegreat.convex.raindrop.*
import com.beegreat.design.BeeTheme
import com.beegreat.design.MaxContentWidth
import com.beegreat.design.Spacing
import com.beegreat.design.components.BeeCard
import com.beegreat.design.components.ScreenHeader

@Composable
fun RaindropScreen(initialUrl: String? = null, initialNote: String? = null) {
  val container = LocalAppContainer.current
  val repository = container.raindrop
  val navigator = LocalNavigator.current
  val context = LocalContext.current
  val vm: RaindropViewModel = viewModel { RaindropViewModel(repository) }
  val state by vm.state.collectAsStateWithLifecycle()
  val callback by container.pendingRaindropCallback.collectAsStateWithLifecycle()
  var editor by remember { mutableStateOf<RaindropBookmark?>(null) }
  var adding by rememberSaveable { mutableStateOf(initialUrl != null) }
  var tokenDialog by remember { mutableStateOf(false) }
  var disconnectDialog by remember { mutableStateOf(false) }
  var trash by remember { mutableStateOf<RaindropBookmark?>(null) }

  LaunchedEffect(callback) {
    val uri = callback ?: return@LaunchedEffect
    container.pendingRaindropCallback.value = null
    val code = uri.getQueryParameter("code")
    val oauthState = uri.getQueryParameter("state")
    if (code.isNullOrBlank() || oauthState.isNullOrBlank() || uri.getQueryParameter("error") != null) {
      vm.error("Raindrop sign-in was cancelled or expired. Connect again.")
    } else vm.action { repository.complete(code, oauthState) }
  }

  RaindropScreenView(
    state = state, onBack = navigator::back, onSearch = vm::search, onCollection = vm::collection,
    onRetry = vm::refresh, onMore = vm::more, onAdd = { adding = true }, onEdit = { editor = it },
    onConnect = { vm.action { openAuthTab(context, repository.begin().authorizationUrl) } },
    onToken = { tokenDialog = true }, onDisconnect = { disconnectDialog = true },
    onSync = { vm.action { repository.sync(); vm.refresh() } },
  )
  if ((adding || editor != null) && state.status?.state == "connected") {
    RaindropEditor(editor, if (adding) initialUrl else null, if (adding) initialNote else null, state.collections, state.collectionId, state.working,
      onDismiss = { if (!state.working) { adding = false; editor = null } },
      onSave = { url, title, note, tags, collectionId, important ->
        val id = editor?.id
        vm.action {
          repository.save(id, url, title, note, tags, collectionId, important)
          adding = false; editor = null; vm.refresh()
        }
      }, onTrash = { editor?.let { trash = it } }, error = state.error)
  }
  if (tokenDialog) {
    var token by remember { mutableStateOf("") }
    AlertDialog(onDismissRequest = { if (!state.working) tokenDialog = false },
      title = { Text("Connect Raindrop") },
      text = { Column(verticalArrangement = Arrangement.spacedBy(Spacing.two)) {
        Text("Paste your personal test token from Raindrop's integration settings. Bee will sync your bookmarks into Mind.")
        TextButton(onClick = { openAuthTab(context, "https://app.raindrop.io/settings/integrations") }) { Text("Open Raindrop settings") }
        OutlinedTextField(token, { token = it }, label = { Text("Test token") }, visualTransformation = PasswordVisualTransformation(), singleLine = true)
        state.error?.let { Text(it, color = BeeTheme.colors.destructive) }
      } }, confirmButton = { TextButton(enabled = token.isNotBlank() && !state.working, onClick = {
        val submitted = token
        vm.action { repository.connectToken(submitted); token = ""; tokenDialog = false }
      }) { Text(if (state.working) "Connecting..." else "Connect") } },
      dismissButton = { TextButton(enabled = !state.working, onClick = { token = ""; tokenDialog = false }) { Text("Cancel") } })
  }
  if (disconnectDialog) AlertDialog(onDismissRequest = { disconnectDialog = false }, title = { Text("Disconnect Raindrop?") },
    text = { Text("Sync stops and BeeGreat removes the saved credentials. Bookmarks already in Mind stay there.") },
    confirmButton = { TextButton(enabled = !state.working, onClick = { vm.action { repository.disconnect(); disconnectDialog = false } }) { Text("Disconnect") } },
    dismissButton = { TextButton(onClick = { disconnectDialog = false }) { Text("Cancel") } })
  trash?.let { bookmark -> AlertDialog(onDismissRequest = { trash = null }, title = { Text("Move to Raindrop Trash?") },
    text = { Text("You can restore this bookmark from Trash. Its saved copy in Mind stays there.") },
    confirmButton = { TextButton(enabled = !state.working, onClick = { vm.action { repository.trash(bookmark.id); trash = null; editor = null; vm.refresh() } }) { Text("Move to Trash") } },
    dismissButton = { TextButton(onClick = { trash = null }) { Text("Cancel") } }) }
}

@Composable
fun RaindropScreenView(
  state: RaindropState, onBack: () -> Unit, onSearch: (String) -> Unit, onCollection: (Long) -> Unit,
  onRetry: () -> Unit, onMore: () -> Unit, onAdd: () -> Unit, onEdit: (RaindropBookmark) -> Unit,
  onConnect: () -> Unit, onToken: () -> Unit, onDisconnect: () -> Unit, onSync: () -> Unit,
) {
  val colors = BeeTheme.colors
  val uriHandler = LocalUriHandler.current
  val connected = state.status?.state == "connected"
  Box(Modifier.fillMaxSize().background(colors.background), contentAlignment = Alignment.TopCenter) {
    LazyColumn(Modifier.widthIn(max = MaxContentWidth).fillMaxSize(), contentPadding = PaddingValues(Spacing.three), verticalArrangement = Arrangement.spacedBy(Spacing.two)) {
      item { Row(verticalAlignment = Alignment.CenterVertically) {
        Box(Modifier.weight(1f)) { ScreenHeader("Raindrop", onBack = onBack) }
        if (connected) IconButton(onClick = onAdd, enabled = !state.working) { Icon(Icons.Default.Add, "Save to Raindrop", tint = colors.primary) }
      } }
      if (state.status == null && state.error == null) item { CircularProgressIndicator(color = colors.primary) }
      else if (!connected) item {
        Column(verticalArrangement = Arrangement.spacedBy(Spacing.three)) {
          Text("Connect Raindrop to browse your collections and sync bookmarks into Mind for Bee to use in chat.", color = colors.text, style = BeeTheme.typography.body)
          FilledButton(if (state.working) "Connecting..." else "Connect Raindrop", enabled = !state.working, onClick = if (state.status?.oauthAvailable == true) onConnect else onToken)
          if (state.status?.oauthAvailable == true) OutlineButton("Use a personal test token", enabled = !state.working, onClick = onToken)
          if (state.status?.state == "needs_reauth") OutlineButton("Disconnect", destructive = true, onClick = onDisconnect)
        }
      }
      if (connected) {
        item { Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.two)) {
          Text(state.status?.accountName ?: "Raindrop", Modifier.weight(1f), style = BeeTheme.typography.small, color = colors.textSecondary)
          TextButton(onClick = onSync, enabled = !state.working && state.status?.syncing != true) { Text(if (state.status?.syncing == true) "Syncing..." else "Sync") }
          TextButton(onClick = onDisconnect, enabled = !state.working) { Text("Disconnect") }
        } }
        item { OutlinedTextField(state.search, onSearch, label = { Text("Search Raindrop") }, singleLine = true, modifier = Modifier.fillMaxWidth()) }
        item { CollectionPicker(state.collections, state.collectionId, onCollection) }
        state.status?.message?.let { message -> item { Text(message, color = colors.destructive, style = BeeTheme.typography.small) } }
        if (!state.loading && state.bookmarks.isEmpty() && state.error == null) item { Text("No bookmarks found", color = colors.textSecondary, modifier = Modifier.padding(vertical = Spacing.four)) }
        items(state.bookmarks, key = { it.id }) { bookmark ->
          BeeCard {
            Row(verticalAlignment = Alignment.CenterVertically) {
              Column(Modifier.weight(1f).clickable { runCatching { uriHandler.openUri(bookmark.url) } }.padding(vertical = Spacing.two), verticalArrangement = Arrangement.spacedBy(Spacing.one)) {
                Row(horizontalArrangement = Arrangement.spacedBy(Spacing.one)) {
                  if (bookmark.important) Icon(Icons.Default.Star, "Favorite", Modifier.size(18.dp), tint = colors.primary)
                  Text(bookmark.title.ifBlank { Uri.parse(bookmark.url).host ?: bookmark.url }, style = BeeTheme.typography.smallBold, color = colors.text, maxLines = 2, overflow = TextOverflow.Ellipsis)
                }
                Text(Uri.parse(bookmark.url).host ?: bookmark.url, style = BeeTheme.typography.small, color = colors.textSecondary, maxLines = 1)
                if (bookmark.note.isNotBlank()) Text(bookmark.note, style = BeeTheme.typography.small, color = colors.textSecondary, maxLines = 2, overflow = TextOverflow.Ellipsis)
                if (bookmark.tags.isNotEmpty()) Text(bookmark.tags.joinToString(" · "), style = BeeTheme.typography.small, color = colors.textSecondary, maxLines = 1, overflow = TextOverflow.Ellipsis)
              }
              IconButton(onClick = { onEdit(bookmark) }, enabled = !state.working) { Icon(Icons.Default.Edit, "Edit ${bookmark.title}", tint = colors.primary) }
            }
          }
        }
        if (state.loading) item { Box(Modifier.fillMaxWidth().padding(Spacing.three), contentAlignment = Alignment.Center) { CircularProgressIndicator(color = colors.primary) } }
        if (state.hasMore && !state.loading) item { OutlineButton("Load more", onClick = onMore) }
      }
      state.error?.let { error -> item { Column {
        Text(error, color = colors.destructive, style = BeeTheme.typography.small)
        if (connected) TextButton(onClick = onRetry) { Text("Retry") }
      } } }
    }
  }
}

@Composable
private fun CollectionPicker(collections: List<RaindropCollection>, selected: Long, onSelect: (Long) -> Unit) {
  var expanded by remember { mutableStateOf(false) }
  Box {
    OutlineButton(collections.firstOrNull { it.id == selected }?.title ?: "Choose collection", onClick = { expanded = true })
    DropdownMenu(expanded, onDismissRequest = { expanded = false }) {
      for (collection in collections) DropdownMenuItem(text = {
        val parent = collections.firstOrNull { it.id == collection.parentId }
        Text(if (parent != null) "${parent.title} / ${collection.title}" else collection.title)
      }, onClick = { expanded = false; onSelect(collection.id) })
    }
  }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun RaindropEditor(
  bookmark: RaindropBookmark?, initialUrl: String?, initialNote: String?, collections: List<RaindropCollection>, selectedCollection: Long, working: Boolean,
  onDismiss: () -> Unit, onSave: (String, String, String, List<String>, Long, Boolean) -> Unit, onTrash: () -> Unit, error: String?,
) {
  var url by remember { mutableStateOf(bookmark?.url ?: initialUrl ?: "") }
  var title by remember { mutableStateOf(bookmark?.title ?: "") }
  var note by remember { mutableStateOf(bookmark?.note ?: initialNote ?: "") }
  var tags by remember { mutableStateOf(bookmark?.tags?.joinToString(", ") ?: "") }
  var collectionId by remember { mutableStateOf((bookmark?.collectionId ?: selectedCollection).takeIf { it > 0 || it == -1L } ?: -1L) }
  var important by remember { mutableStateOf(bookmark?.important ?: false) }
  val validUrl = runCatching { Uri.parse(url).let { it.scheme in listOf("http", "https") && !it.host.isNullOrBlank() } }.getOrDefault(false)
  ModalBottomSheet(onDismissRequest = onDismiss, sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true), containerColor = BeeTheme.colors.background) {
    Column(Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).padding(Spacing.three).imePadding(), verticalArrangement = Arrangement.spacedBy(Spacing.two)) {
      Text(if (bookmark == null) "Save to Raindrop" else if (bookmark.collectionId == -99L) "Restore bookmark" else "Edit bookmark", style = BeeTheme.typography.barTitle, color = BeeTheme.colors.text)
      OutlinedTextField(url, { url = it }, label = { Text("URL") }, modifier = Modifier.fillMaxWidth(), singleLine = true, enabled = !working)
      OutlinedTextField(title, { title = it }, label = { Text("Title") }, modifier = Modifier.fillMaxWidth(), enabled = !working)
      OutlinedTextField(note, { note = it }, label = { Text("Note") }, modifier = Modifier.fillMaxWidth(), enabled = !working)
      OutlinedTextField(tags, { tags = it }, label = { Text("Tags, separated by commas") }, modifier = Modifier.fillMaxWidth(), enabled = !working)
      CollectionPicker(collections.filter { it.id > 0 || it.id == -1L }, collectionId) { if (!working) collectionId = it }
      Row(verticalAlignment = Alignment.CenterVertically) { Checkbox(important, { important = it }, enabled = !working); Text("Favorite", color = BeeTheme.colors.text) }
      error?.let { Text(it, color = BeeTheme.colors.destructive) }
      FilledButton(if (working) "Saving..." else if (bookmark?.collectionId == -99L) "Restore" else "Save", enabled = !working && validUrl) {
        onSave(url.trim(), title, note, tags.split(',').map(String::trim).filter(String::isNotBlank).distinct(), collectionId, important)
      }
      if (bookmark != null && bookmark.collectionId != -99L) OutlineButton("Move to Trash", destructive = true, enabled = !working, onClick = onTrash)
      Spacer(Modifier.height(Spacing.four))
    }
  }
}

@Preview(showBackground = true)
@Composable
private fun RaindropPreview() {
  BeeTheme { RaindropScreenView(RaindropState(status = RaindropStatus("disconnected")), {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}) }
}
