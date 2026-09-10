package com.beegreat.app.bee

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil3.compose.AsyncImage
import com.beegreat.app.common.FloatingBee
import com.beegreat.contract.BEEUI_FENCE_OPEN
import com.beegreat.contract.BeeUiComponent
import com.beegreat.contract.extractBeeUi
import com.beegreat.design.BeeTheme
import com.beegreat.design.Radius
import com.beegreat.design.Spacing
import com.beegreat.design.components.Hairline
import com.beegreat.flue.FlueMessage
import com.beegreat.flue.FluePart
import com.beegreat.flue.isStreaming
import kotlinx.coroutines.delay

fun copyToClipboard(context: Context, value: String) {
  val manager = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
  manager.setPrimaryClip(ClipData.newPlainText("BeeGreat", value))
}

/** Long-press-to-copy with a transient "Copied" acknowledgement. */
@Composable
private fun rememberCopy(value: String?): Pair<Boolean, () -> Unit> {
  val context = LocalContext.current
  var copied by remember { mutableStateOf(false) }
  LaunchedEffect(copied) {
    if (copied) {
      delay(1500)
      copied = false
    }
  }
  return copied to {
    if (!value.isNullOrBlank()) {
      copyToClipboard(context, value)
      copied = true
    }
  }
}

/** User message: honey bubble on the right with a 4dp bottom-right notch and a "You" label. */
@Composable
fun UserMessage(message: FlueMessage, showSpeaker: Boolean) {
  val colors = BeeTheme.colors
  val text = message.text
  val (copied, copy) = rememberCopy(text)
  Row(modifier = Modifier.fillMaxWidth().padding(start = Spacing.five), horizontalArrangement = Arrangement.End) {
    Column(horizontalAlignment = Alignment.End, verticalArrangement = Arrangement.spacedBy(Spacing.one), modifier = Modifier.widthIn(max = 640.dp)) {
      if (showSpeaker) Text("You", style = BeeTheme.typography.small.copy(fontSize = 12.sp, lineHeight = 14.sp), color = colors.textSecondary, modifier = Modifier.padding(end = Spacing.one))
      Column(
        modifier =
          Modifier.clip(RoundedCornerShape(topStart = Radius.card, topEnd = Radius.card, bottomStart = Radius.card, bottomEnd = Spacing.one))
            .background(colors.secondary)
            .border(Hairline, colors.border, RoundedCornerShape(topStart = Radius.card, topEnd = Radius.card, bottomStart = Radius.card, bottomEnd = Spacing.one))
            .combinedClickable(onClick = {}, onLongClick = copy)
            .padding(horizontal = Spacing.three, vertical = Spacing.two + Spacing.half),
        verticalArrangement = Arrangement.spacedBy(Spacing.two),
      ) {
        if (text.isNotBlank()) Text(text, style = BeeTheme.typography.body.copy(fontSize = 16.sp, lineHeight = 23.sp), color = colors.secondaryForeground)
        AttachmentRow(message)
      }
      if (copied) CopiedBadge()
    }
  }
}

@Composable
private fun CopiedBadge() {
  Text("Copied", style = BeeTheme.typography.small.copy(fontSize = 12.sp, lineHeight = 14.sp), color = BeeTheme.colors.textSecondary, modifier = Modifier.padding(horizontal = Spacing.one))
}

/** Image attachments on a message, from durable `file` parts or a local data URL echo. */
@Composable
fun AttachmentRow(message: FlueMessage) {
  val files = message.parts.filterIsInstance<FluePart.File>().filter { it.mediaType.startsWith("image/") && it.url != null }
  if (files.isEmpty()) return
  Row(horizontalArrangement = Arrangement.spacedBy(Spacing.two)) {
    for (file in files) {
      AsyncImage(
        model = file.url,
        contentDescription = file.filename ?: "Attached image",
        modifier = Modifier.size(140.dp).clip(RoundedCornerShape(Radius.compact)),
      )
    }
  }
}

data class AssistantTurn(
  val spoken: String,
  val components: List<BeeUiComponent>,
  val reasoning: String,
  val reasoningStreaming: Boolean,
  val tools: List<FluePart.Tool>,
  val textStreaming: Boolean,
) {
  val hasResponse: Boolean
    get() = spoken.isNotEmpty() || components.isNotEmpty()

  val hasActivity: Boolean
    get() = reasoning.isNotEmpty() || tools.isNotEmpty()
}

/** Splits an assistant message into what the chat renders. A beeui block stays hidden until it finishes streaming. */
fun assistantTurn(message: FlueMessage, isLast: Boolean, busy: Boolean): AssistantTurn {
  val text = message.text
  val textStreaming = message.parts.any { it is FluePart.Text && it.isStreaming }
  val visible = if (textStreaming) text.split(BEEUI_FENCE_OPEN, limit = 2)[0] else text
  val extraction = extractBeeUi(visible)
  val last = message.parts.lastOrNull()
  return AssistantTurn(
    spoken = extraction.spoken,
    components = extraction.components.filter { it != BeeUiComponent.Unsupported },
    reasoning = message.reasoningText,
    reasoningStreaming = isLast && busy && last is FluePart.Reasoning && last.state == "streaming",
    tools = message.toolParts,
    textStreaming = textStreaming,
  )
}

/**
 * Assistant turn: activity group (reasoning, tool rows), then the reply next to
 * the 36dp Bee avatar with generated cards below, then a Retry pill on the
 * last idle turn.
 */
@Composable
fun AssistantMessage(
  message: FlueMessage,
  isLast: Boolean,
  busy: Boolean,
  onReply: (String) -> Unit,
  onRetry: (() -> Unit)?,
) {
  val colors = BeeTheme.colors
  val turn = remember(message, isLast, busy) { assistantTurn(message, isLast, busy) }
  if (!turn.hasResponse && !turn.hasActivity) return
  val (copied, copy) = rememberCopy(if (turn.textStreaming) null else turn.spoken.ifEmpty { null })
  Column(verticalArrangement = Arrangement.spacedBy(Spacing.three)) {
    if (turn.hasActivity) {
      Column(verticalArrangement = Arrangement.spacedBy(Spacing.two)) {
        if (turn.reasoning.isNotEmpty()) ReasoningDisclosure(turn.reasoning, turn.reasoningStreaming)
        for (tool in turn.tools) ToolActivity(tool)
      }
    }
    if (turn.hasResponse) {
      Row(horizontalArrangement = Arrangement.spacedBy(Spacing.two), verticalAlignment = Alignment.Top) {
        Box(modifier = Modifier.size(36.dp), contentAlignment = Alignment.Center) { FloatingBee(height = 36.dp) }
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(Spacing.one)) {
          Column(
            modifier = Modifier.fillMaxWidth().combinedClickable(onClick = {}, onLongClick = copy),
            verticalArrangement = Arrangement.spacedBy(Spacing.two),
          ) {
            if (turn.spoken.isNotEmpty()) BeeMarkdown(turn.spoken)
            AttachmentRow(message)
            GeneratedUi(turn.components, onReply)
          }
          if (copied) CopiedBadge()
        }
      }
    }
    if (isLast && !busy && onRetry != null) {
      Row(modifier = Modifier.padding(start = 36.dp + Spacing.two)) {
        Row(
          modifier =
            Modifier.heightIn(min = 36.dp)
              .clip(CircleShape)
              .background(colors.card)
              .border(Hairline, colors.border, CircleShape)
              .combinedClickable(onClick = onRetry)
              .padding(horizontal = Spacing.three),
          horizontalArrangement = Arrangement.spacedBy(Spacing.one),
          verticalAlignment = Alignment.CenterVertically,
        ) {
          Icon(Icons.Filled.Refresh, contentDescription = null, tint = colors.textSecondary, modifier = Modifier.size(13.dp))
          Text("Retry", style = BeeTheme.typography.small, color = colors.textSecondary)
        }
      }
    }
  }
}

/** Spacer that keeps the assistant column aligned when the avatar is hidden. */
@Composable
fun AvatarSpacer() = Spacer(Modifier.width(36.dp))
