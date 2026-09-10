package com.beegreat.app.healthy

import android.content.Context
import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowLeft
import androidx.compose.material.icons.filled.AddPhotoAlternate
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.PushPin
import androidx.compose.material.icons.filled.Share
import androidx.compose.material.icons.filled.Star
import androidx.compose.material.icons.outlined.PushPin
import androidx.compose.material.icons.outlined.StarBorder
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import coil3.compose.AsyncImage
import com.beegreat.app.LocalAppContainer
import com.beegreat.app.common.ConfirmDialog
import com.beegreat.app.shell.LocalNavigator
import com.beegreat.contract.formatJournalDate
import com.beegreat.convex.health.JournalEntry
import com.beegreat.design.BeeTheme
import com.beegreat.design.Hive
import com.beegreat.design.MaxContentWidth
import com.beegreat.design.Radius
import com.beegreat.design.Spacing
import com.beegreat.design.components.Hairline
import com.clerk.api.Clerk
import com.clerk.api.network.serialization.ClerkResult
import com.clerk.api.session.GetTokenOptions
import dev.convex.android.ConvexError
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.FlowPreview
import kotlinx.coroutines.flow.debounce
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.drop
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import okhttp3.HttpUrl.Companion.toHttpUrlOrNull
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody

private data class Draft(val title: String, val body: String, val tags: String)

/**
 * Port of `journal-entry-editor-screen.tsx`, the parts that matter on Android:
 * title, body, tags, pin and favorite, photos through the system picker,
 * share, delete. Edits autosave 800ms after typing stops with the entry's
 * `updatedAt` as the optimistic-concurrency token; a CONFLICT surfaces as a
 * banner instead of overwriting the other device's text.
 */
@OptIn(FlowPreview::class)
@Composable
fun JournalEntryScreen(entryId: String) {
  val container = LocalAppContainer.current
  val navigator = LocalNavigator.current
  val context = LocalContext.current
  val scope = rememberCoroutineScope()
  val colors = BeeTheme.colors
  val entryFlow = remember(entryId) { container.health.entry(entryId).map { it.getOrNull() to true } }
  val (entry, loaded) = entryFlow.collectAsStateWithLifecycle(initialValue = null to false).value
  val photosFlow = remember(entryId) { container.health.photos(entryId).map { it.getOrNull() ?: emptyList() } }
  val photos by photosFlow.collectAsStateWithLifecycle(initialValue = emptyList())

  var draft by remember { mutableStateOf<Draft?>(null) }
  var knownUpdatedAt by remember { mutableStateOf<Long?>(null) }
  var saving by remember { mutableStateOf(false) }
  var conflict by remember { mutableStateOf(false) }
  var error by remember { mutableStateOf<String?>(null) }
  var uploading by remember { mutableStateOf(false) }
  var confirmingDelete by remember { mutableStateOf(false) }

  // Adopt the server copy the first time and whenever a save we made lands.
  LaunchedEffect(entry?.id, entry?.updatedAt) {
    val current = entry ?: return@LaunchedEffect
    if (draft == null || knownUpdatedAt == null) {
      draft = Draft(current.title, current.body, current.tags.joinToString(" "))
      knownUpdatedAt = current.updatedAt
    } else if (knownUpdatedAt != current.updatedAt && !saving) {
      // Someone else edited this entry; keep our draft but flag it.
      conflict = draft != Draft(current.title, current.body, current.tags.joinToString(" "))
      if (!conflict) knownUpdatedAt = current.updatedAt
    }
  }

  suspend fun save(current: JournalEntry, next: Draft): Boolean {
    val expected = knownUpdatedAt ?: return false
    saving = true
    return try {
      val saved =
        container.health.update(
          current.id,
          expected,
          title = next.title,
          body = next.body,
          tags = next.tags.split(Regex("[\\s,]+")).map { it.trim().removePrefix("#").lowercase() }.filter { it.isNotEmpty() }.distinct(),
        )
      knownUpdatedAt = saved.updatedAt
      conflict = false
      error = null
      true
    } catch (e: ConvexError) {
      if (e.data.contains("CONFLICT")) conflict = true else error = e.message
      false
    } catch (e: Exception) {
      error = e.message
      false
    } finally {
      saving = false
    }
  }

  LaunchedEffect(entryId) {
    snapshotFlow { draft }
      .drop(1)
      .debounce(800)
      .distinctUntilChanged()
      .collect { next ->
        val current = entry ?: return@collect
        if (next == null || conflict) return@collect
        if (next.title == current.title && next.body == current.body && next.tags == current.tags.joinToString(" ")) return@collect
        save(current, next)
      }
  }

  val picker =
    rememberLauncherForActivityResult(ActivityResultContracts.PickMultipleVisualMedia(6)) { uris ->
      if (uris.isEmpty()) return@rememberLauncherForActivityResult
      uploading = true
      scope.launch {
        try {
          for (uri in uris) uploadPhoto(context, container.http, container.health.photoUploadUrl(), entryId, uri)
        } catch (e: Exception) {
          error = e.message ?: "Could not add that photo."
        } finally {
          uploading = false
        }
      }
    }

  Box(modifier = Modifier.fillMaxSize().background(colors.background), contentAlignment = Alignment.TopCenter) {
    val current = entry
    val text = draft
    when {
      !loaded -> CircularProgressIndicator(color = colors.primary, modifier = Modifier.padding(top = Spacing.six))
      current == null -> Text("This entry is gone.", style = BeeTheme.typography.body, color = colors.textSecondary, modifier = Modifier.padding(Spacing.six))
      text == null -> Unit
      else ->
        Column(
          modifier = Modifier.widthIn(max = MaxContentWidth).fillMaxSize().verticalScroll(rememberScrollState()).imePadding().padding(horizontal = Spacing.three, vertical = Spacing.two).padding(bottom = Spacing.five),
          verticalArrangement = Arrangement.spacedBy(Spacing.three),
        ) {
          Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.one)) {
            Icon(Icons.AutoMirrored.Filled.KeyboardArrowLeft, contentDescription = "Back", tint = colors.text, modifier = Modifier.size(28.dp).clip(CircleShape).clickable(onClick = navigator::back))
            Text(formatJournalDate(current.localDate), style = BeeTheme.typography.small, color = colors.textSecondary, modifier = Modifier.weight(1f))
            Text(if (saving) "Saving…" else if (conflict) "Conflict" else "Saved", style = BeeTheme.typography.small.copy(fontSize = 12.sp), color = if (conflict) colors.destructive else colors.textSecondary)
            ToggleIcon(if (current.isPinned) Icons.Filled.PushPin else Icons.Outlined.PushPin, "Pin", current.isPinned) {
              scope.launch { runCatching { container.health.update(current.id, knownUpdatedAt ?: current.updatedAt, isPinned = !current.isPinned) }.onSuccess { knownUpdatedAt = it.updatedAt }.onFailure { error = it.message } }
            }
            ToggleIcon(if (current.isFavorite) Icons.Filled.Star else Icons.Outlined.StarBorder, "Favorite", current.isFavorite) {
              scope.launch { runCatching { container.health.update(current.id, knownUpdatedAt ?: current.updatedAt, isFavorite = !current.isFavorite) }.onSuccess { knownUpdatedAt = it.updatedAt }.onFailure { error = it.message } }
            }
            ToggleIcon(Icons.Filled.Share, "Share", false) {
              val share = android.content.Intent(android.content.Intent.ACTION_SEND).apply {
                type = "text/plain"
                putExtra(android.content.Intent.EXTRA_TEXT, listOf(text.title, text.body).filter { it.isNotBlank() }.joinToString("\n\n"))
              }
              context.startActivity(android.content.Intent.createChooser(share, null))
            }
            ToggleIcon(Icons.Filled.Delete, "Delete", false, tint = colors.destructive) { confirmingDelete = true }
          }
          if (conflict) {
            Column(modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(Radius.card)).border(Hairline, colors.destructive, RoundedCornerShape(Radius.card)).padding(Spacing.three), verticalArrangement = Arrangement.spacedBy(Spacing.two)) {
              Text("This entry changed elsewhere", style = BeeTheme.typography.smallBold, color = colors.destructive)
              Text("Review the saved version before replacing it.", style = BeeTheme.typography.small, color = colors.textSecondary)
              Row(horizontalArrangement = Arrangement.spacedBy(Spacing.two)) {
                SmallPill("Keep mine") { knownUpdatedAt = current.updatedAt; conflict = false; scope.launch { save(current, text) } }
                SmallPill("Use saved", secondary = true) { draft = Draft(current.title, current.body, current.tags.joinToString(" ")); knownUpdatedAt = current.updatedAt; conflict = false }
              }
            }
          }
          BasicTextField(
            value = text.title,
            onValueChange = { draft = text.copy(title = it) },
            textStyle = BeeTheme.typography.sectionTitle.copy(color = colors.text),
            cursorBrush = SolidColor(colors.text),
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
            decorationBox = { inner ->
              if (text.title.isEmpty()) Text("Title", style = BeeTheme.typography.sectionTitle, color = colors.textSecondary)
              inner()
            },
          )
          BasicTextField(
            value = text.body,
            onValueChange = { draft = text.copy(body = it) },
            textStyle = BeeTheme.typography.chatBody.copy(color = colors.text),
            cursorBrush = SolidColor(colors.text),
            minLines = 8,
            modifier = Modifier.fillMaxWidth(),
            decorationBox = { inner ->
              if (text.body.isEmpty()) Text("One honest thought…", style = BeeTheme.typography.chatBody, color = colors.textSecondary)
              inner()
            },
          )
          BasicTextField(
            value = text.tags,
            onValueChange = { draft = text.copy(tags = it) },
            textStyle = BeeTheme.typography.small.copy(color = Hive.amber),
            cursorBrush = SolidColor(colors.text),
            singleLine = true,
            modifier = Modifier.fillMaxWidth().heightIn(min = 40.dp).clip(RoundedCornerShape(Radius.compact)).border(Hairline, colors.border, RoundedCornerShape(Radius.compact)).padding(horizontal = Spacing.two + Spacing.half, vertical = Spacing.two),
            decorationBox = { inner ->
              if (text.tags.isEmpty()) Text("Tags, separated by spaces", style = BeeTheme.typography.small, color = colors.textSecondary)
              inner()
            },
          )
          Row(modifier = Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(Spacing.two)) {
            for (photo in photos) {
              Box(modifier = Modifier.size(96.dp)) {
                AsyncImage(model = photo.url, contentDescription = photo.fileName, contentScale = ContentScale.Crop, modifier = Modifier.fillMaxSize().clip(RoundedCornerShape(Radius.compact)))
                Icon(
                  Icons.Filled.Close,
                  contentDescription = "Remove photo",
                  tint = colors.card,
                  modifier = Modifier.align(Alignment.TopEnd).padding(4.dp).size(20.dp).background(colors.text.copy(alpha = 0.6f), CircleShape).clickable { scope.launch { runCatching { container.health.removePhoto(photo.id) }.onFailure { error = it.message } } }.padding(3.dp),
                )
              }
            }
            Box(
              modifier = Modifier.size(96.dp).clip(RoundedCornerShape(Radius.compact)).background(colors.backgroundElement).clickable(enabled = !uploading) { picker.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)) },
              contentAlignment = Alignment.Center,
            ) {
              if (uploading) CircularProgressIndicator(modifier = Modifier.size(20.dp), strokeWidth = 2.dp, color = colors.textSecondary)
              else Icon(Icons.Filled.AddPhotoAlternate, contentDescription = "Add photo", tint = colors.textSecondary, modifier = Modifier.size(28.dp))
            }
          }
          error?.let { Text(it, style = BeeTheme.typography.small, color = colors.destructive) }
        }
    }
  }
  if (confirmingDelete && entry != null) {
    ConfirmDialog("Delete this entry?", "It will be removed along with its photos.", "Delete", onDismiss = { confirmingDelete = false }) {
      scope.launch {
        runCatching { container.health.remove(entry.id) }
        navigator.back()
      }
    }
  }
}

@Composable
private fun ToggleIcon(icon: androidx.compose.ui.graphics.vector.ImageVector, label: String, active: Boolean, tint: androidx.compose.ui.graphics.Color? = null, onClick: () -> Unit) {
  val colors = BeeTheme.colors
  Box(modifier = Modifier.size(36.dp).clip(CircleShape).clickable(onClick = onClick), contentAlignment = Alignment.Center) {
    Icon(icon, contentDescription = label, tint = tint ?: if (active) Hive.amber else colors.textSecondary, modifier = Modifier.size(20.dp))
  }
}

@Composable
private fun SmallPill(label: String, secondary: Boolean = false, onClick: () -> Unit) {
  val colors = BeeTheme.colors
  Box(
    modifier = Modifier.heightIn(min = 36.dp).clip(CircleShape).background(if (secondary) colors.card else colors.primary).border(Hairline, if (secondary) colors.border else colors.primary, CircleShape).clickable(onClick = onClick).padding(horizontal = Spacing.three),
    contentAlignment = Alignment.Center,
  ) {
    Text(label, style = BeeTheme.typography.smallBold, color = if (secondary) colors.text else colors.primaryForeground)
  }
}

/** POSTs the picked image to the Convex site upload route with the `convex` JWT, like the Expo editor. */
private suspend fun uploadPhoto(context: Context, http: okhttp3.OkHttpClient, uploadUrl: String, entryId: String, uri: Uri) =
  withContext(Dispatchers.IO) {
    val resolver = context.contentResolver
    val mimeType = resolver.getType(uri) ?: "image/jpeg"
    val bytes = resolver.openInputStream(uri)?.use { it.readBytes() } ?: throw IllegalStateException("Could not read that photo.")
    if (bytes.size > 10 * 1024 * 1024) throw IllegalStateException("Photos must be at most 10 MB.")
    val bounds = android.graphics.BitmapFactory.Options().apply { inJustDecodeBounds = true }
    android.graphics.BitmapFactory.decodeByteArray(bytes, 0, bytes.size, bounds)
    val token = (Clerk.auth.getToken(GetTokenOptions(template = "convex")) as? ClerkResult.Success)?.value ?: throw IllegalStateException("Sign in to upload a photo.")
    val url =
      uploadUrl.toHttpUrlOrNull()?.newBuilder()
        ?.addQueryParameter("entryId", entryId)
        ?.addQueryParameter("width", bounds.outWidth.toString())
        ?.addQueryParameter("height", bounds.outHeight.toString())
        ?.build() ?: throw IllegalStateException("Bad upload URL.")
    val request = Request.Builder().url(url).header("Authorization", "Bearer $token").post(bytes.toRequestBody(mimeType.toMediaType())).build()
    http.newCall(request).execute().use { if (!it.isSuccessful) throw IllegalStateException("The photo upload did not finish. Photos must be at most 10 MB.") }
  }

