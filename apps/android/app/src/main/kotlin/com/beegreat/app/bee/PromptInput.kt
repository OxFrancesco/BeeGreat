package com.beegreat.app.bee

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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Icon
import androidx.compose.material3.FilledIconButton
import androidx.compose.material3.IconButtonDefaults
import androidx.compose.material3.Text
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowUpward
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import com.beegreat.design.BeeTheme
import com.beegreat.design.Radius
import com.beegreat.design.Spacing
import com.beegreat.design.components.Hairline
import kotlinx.coroutines.launch

private val COMMANDS = listOf("/clear" to "Clear the conversation and start fresh", "/new" to "Start a new conversation")

/**
 * Text fallback for the voice agent. Typing `/` lists the slash commands. A
 * failed send never eats the draft.
 */
@Composable
fun PromptInput(onSubmit: suspend (String) -> Unit, enabled: Boolean, modifier: Modifier = Modifier) {
  val colors = BeeTheme.colors
  val scope = rememberCoroutineScope()
  var text by rememberSaveable { mutableStateOf("") }
  var submitting by remember { mutableStateOf(false) }
  val canSend = text.isNotBlank() && enabled && !submitting

  fun send(message: String) {
    if (!enabled || submitting) return
    text = ""
    submitting = true
    scope.launch {
      try {
        onSubmit(message)
      } catch (_: Exception) {
        if (text.isEmpty()) text = message
      } finally {
        submitting = false
      }
    }
  }

  val typed = text.trim().lowercase()
  val matching = if (typed.startsWith("/")) COMMANDS.filter { it.first.startsWith(typed) } else emptyList()

  Column(modifier = modifier, verticalArrangement = Arrangement.spacedBy(Spacing.one)) {
    if (matching.isNotEmpty()) {
      Column(modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(Radius.compact)).background(colors.card).border(Hairline, colors.border, RoundedCornerShape(Radius.compact))) {
        for ((command, description) in matching) {
          Row(
            modifier = Modifier.fillMaxWidth().clickable { send(command) }.padding(horizontal = Spacing.three, vertical = Spacing.two),
            horizontalArrangement = Arrangement.spacedBy(Spacing.two),
            verticalAlignment = Alignment.CenterVertically,
          ) {
            Text(command, style = BeeTheme.typography.smallBold, color = colors.text)
            Text(description, style = BeeTheme.typography.small, color = colors.textSecondary, modifier = Modifier.weight(1f))
          }
        }
      }
    }
    Row(
      modifier =
        Modifier.fillMaxWidth()
          .heightIn(min = 52.dp)
          .clip(RoundedCornerShape(26.dp))
          .background(colors.card)
          .border(Hairline, colors.border, RoundedCornerShape(26.dp))
          .padding(start = Spacing.three, end = Spacing.one, top = Spacing.one, bottom = Spacing.one),
      verticalAlignment = Alignment.CenterVertically,
      horizontalArrangement = Arrangement.spacedBy(Spacing.two),
    ) {
      BasicTextField(
        value = text,
        onValueChange = { text = it },
        modifier = Modifier.weight(1f).padding(vertical = Spacing.two),
        textStyle = BeeTheme.typography.body.copy(color = colors.text),
        cursorBrush = SolidColor(colors.text),
        maxLines = 5,
        keyboardOptions = KeyboardOptions(imeAction = ImeAction.Send),
        keyboardActions = KeyboardActions(onSend = { if (canSend) send(text.trim()) }),
        decorationBox = { inner ->
          Box {
            if (text.isEmpty()) Text("Ask Bee anything…", style = BeeTheme.typography.body, color = colors.textSecondary)
            inner()
          }
        },
      )
      FilledIconButton(
        onClick = { send(text.trim()) },
        enabled = canSend,
        modifier = Modifier.size(44.dp),
        colors = IconButtonDefaults.filledIconButtonColors(
          containerColor = colors.primary,
          contentColor = colors.primaryForeground,
          disabledContainerColor = colors.backgroundElement,
          disabledContentColor = colors.textSecondary,
        ),
      ) {
        Icon(Icons.Filled.ArrowUpward, contentDescription = "Send message", modifier = Modifier.size(18.dp))
      }
    }
  }
}
