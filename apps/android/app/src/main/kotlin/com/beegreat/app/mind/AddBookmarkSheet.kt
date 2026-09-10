package com.beegreat.app.mind

import android.content.ClipboardManager
import android.content.Context
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.input.KeyboardType
import com.beegreat.app.LocalAppContainer
import com.beegreat.contract.normalizeBookmarkInputUrl
import com.beegreat.design.BeeTheme
import com.beegreat.design.Radius
import com.beegreat.design.Spacing
import com.beegreat.design.components.Hairline
import com.beegreat.design.components.ScreenHeader
import kotlinx.coroutines.launch

/**
 * Port of `add-bookmark-sheet.tsx` and the `share.tsx` entry: paste or type
 * a link, add an optional note, save, then jump to the new bookmark.
 */
@Composable
fun AddBookmarkSheet(initialUrl: String?, onDismiss: () -> Unit, onSaved: (String) -> Unit) {
  val container = LocalAppContainer.current
  val context = LocalContext.current
  val scope = rememberCoroutineScope()
  val colors = BeeTheme.colors
  var url by remember { mutableStateOf(initialUrl ?: "") }
  var note by remember { mutableStateOf("") }
  var saving by remember { mutableStateOf(false) }
  var error by remember { mutableStateOf<String?>(null) }
  val normalized = normalizeBookmarkInputUrl(url)

  fun save() {
    val target = normalized ?: run {
      error = "That doesn’t look like a web link."
      return
    }
    saving = true
    error = null
    scope.launch {
      try {
        val id = container.bookmarks.add(target, note.trim().ifEmpty { null })
        onSaved(id)
      } catch (e: Exception) {
        error = e.message ?: "The bookmark could not be saved."
        saving = false
      }
    }
  }

  ModalBottomSheet(onDismissRequest = onDismiss, sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true), containerColor = colors.background) {
    Column(modifier = Modifier.padding(horizontal = Spacing.three).padding(bottom = Spacing.five).imePadding(), verticalArrangement = Arrangement.spacedBy(Spacing.three)) {
      ScreenHeader(title = "Save to Mind")
      Text("Bee reads the page, writes a summary, and files it for later.", style = BeeTheme.typography.small, color = colors.textSecondary)
      Column(verticalArrangement = Arrangement.spacedBy(Spacing.one)) {
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
          Text("URL", style = BeeTheme.typography.smallBold, color = colors.text)
          Text(
            "Paste",
            style = BeeTheme.typography.smallBold,
            color = colors.primary,
            modifier =
              Modifier.clickable {
                val clip = (context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager).primaryClip
                clip?.getItemAt(0)?.coerceToText(context)?.toString()?.let { url = it.trim() }
              },
          )
        }
        Field(url, { url = it; error = null }, "example.com", KeyboardType.Uri)
      }
      Column(verticalArrangement = Arrangement.spacedBy(Spacing.one)) {
        Text("A note for future you", style = BeeTheme.typography.smallBold, color = colors.text)
        Field(note, { note = it }, "Why are you saving this? (optional)", KeyboardType.Text, minLines = 2)
      }
      error?.let { Text(it, style = BeeTheme.typography.small, color = colors.destructive) }
      PillButton(if (saving) "Saving…" else "Save bookmark", enabled = normalized != null && !saving) { save() }
    }
  }
}

@Composable
private fun Field(value: String, onChange: (String) -> Unit, placeholder: String, keyboard: KeyboardType, minLines: Int = 1) {
  val colors = BeeTheme.colors
  BasicTextField(
    value = value,
    onValueChange = onChange,
    minLines = minLines,
    singleLine = minLines == 1,
    textStyle = BeeTheme.typography.body.copy(color = colors.text),
    cursorBrush = SolidColor(colors.text),
    keyboardOptions = KeyboardOptions(keyboardType = keyboard, capitalization = if (keyboard == KeyboardType.Uri) KeyboardCapitalization.None else KeyboardCapitalization.Sentences),
    modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(Radius.card)).background(colors.card).border(Hairline, colors.border, RoundedCornerShape(Radius.card)).padding(Spacing.three),
    decorationBox = { inner ->
      if (value.isEmpty()) Text(placeholder, style = BeeTheme.typography.body, color = colors.textSecondary)
      inner()
    },
  )
}
