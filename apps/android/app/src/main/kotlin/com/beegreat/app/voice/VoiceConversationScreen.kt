package com.beegreat.app.voice

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
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Warning
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.beegreat.app.LocalAppContainer
import com.beegreat.app.shell.LocalNavigator
import com.beegreat.design.BeeTheme
import com.beegreat.design.MaxContentWidth
import com.beegreat.design.Radius
import com.beegreat.design.Spacing
import com.beegreat.design.components.Hairline

private fun statusCopy(status: RealtimeStatus) =
  when (status) {
    RealtimeStatus.Disconnected -> "Ready for a live conversation"
    RealtimeStatus.Connecting -> "Connecting to Grok Voice…"
    RealtimeStatus.Listening -> "Listening — just speak"
    RealtimeStatus.Thinking -> "Thinking…"
    RealtimeStatus.Speaking -> "Bee is speaking"
    RealtimeStatus.Error -> "Conversation paused"
  }

/** Port of `voice-conversation.tsx`. Starts on open, stops on leave. */
@Composable
fun VoiceConversationScreen() {
  val container = LocalAppContainer.current
  val navigator = LocalNavigator.current
  val conversation = container.realtimeConversation
  val state by conversation.state.collectAsStateWithLifecycle()
  val colors = BeeTheme.colors

  DisposableEffect(conversation) {
    conversation.start()
    onDispose { conversation.stop() }
  }

  fun end() {
    conversation.stop()
    navigator.back()
  }

  Box(modifier = Modifier.fillMaxSize().background(colors.background), contentAlignment = Alignment.TopCenter) {
    Column(
      modifier = Modifier.widthIn(max = MaxContentWidth).fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = Spacing.three, vertical = Spacing.four),
      verticalArrangement = Arrangement.spacedBy(Spacing.four),
      horizontalAlignment = Alignment.CenterHorizontally,
    ) {
      Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(Spacing.three)) {
        VoiceOrb(state = state.orbState, onClick = { if (state.isActive) end() else conversation.start() })
        Row(
          modifier = Modifier.clip(CircleShape).background(colors.backgroundElement).padding(horizontal = Spacing.three, vertical = Spacing.two),
          horizontalArrangement = Arrangement.spacedBy(Spacing.one),
          verticalAlignment = Alignment.CenterVertically,
        ) {
          Box(Modifier.size(8.dp).background(if (state.status == RealtimeStatus.Error) colors.destructive else colors.primary, CircleShape))
          Text(statusCopy(state.status), style = BeeTheme.typography.smallBold, color = colors.text)
        }
        Text(
          "Live speech-to-speech with Grok Think Fast 2.0. This mode is for conversation; use Voice note when Bee needs your goals, tasks, or tools.",
          style = BeeTheme.typography.small,
          color = colors.textSecondary,
          textAlign = TextAlign.Center,
        )
      }
      if (state.turns.isNotEmpty()) {
        Column(modifier = Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(Spacing.two)) {
          for (turn in state.turns) {
            val user = turn.role == "user"
            Column(
              modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(Radius.card)).background(if (user) colors.secondary else colors.card).padding(Spacing.three),
              verticalArrangement = Arrangement.spacedBy(Spacing.half),
            ) {
              Text(if (user) "You" else "Bee · Grok Voice", style = BeeTheme.typography.smallBold, color = if (user) colors.secondaryForeground else colors.text)
              Text(turn.text.ifEmpty { "…" }, style = BeeTheme.typography.body, color = if (user) colors.secondaryForeground else colors.text)
            }
          }
        }
      }
      state.errorMessage?.let {
        Row(
          modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(Radius.card)).background(colors.card).border(Hairline, colors.border, RoundedCornerShape(Radius.card)).padding(Spacing.three),
          horizontalArrangement = Arrangement.spacedBy(Spacing.two),
        ) {
          Icon(Icons.Filled.Warning, contentDescription = null, tint = colors.destructive, modifier = Modifier.size(18.dp))
          Column {
            Text("Bee couldn’t connect", style = BeeTheme.typography.smallBold, color = colors.text)
            Text(it, style = BeeTheme.typography.small, color = colors.textSecondary)
          }
        }
      }
      Box(
        modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp).clip(CircleShape).background(if (state.isActive) colors.backgroundElement else colors.primary).clickable { if (state.isActive) end() else conversation.start() },
        contentAlignment = Alignment.Center,
      ) {
        Text(if (state.isActive) "End conversation" else "Try again", style = BeeTheme.typography.smallBold, color = if (state.isActive) colors.text else colors.primaryForeground)
      }
    }
  }
}
