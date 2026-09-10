package com.beegreat.app.profile

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.beegreat.app.LocalAppContainer
import com.beegreat.app.bee.copyToClipboard
import com.beegreat.convex.connections.ChatGptStatus
import com.beegreat.design.BeeTheme
import com.beegreat.design.Radius
import com.beegreat.design.Spacing
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.launch

/**
 * ChatGPT device-code connection. Port of `chatgpt-auth.tsx`: start creates a
 * code, the user pastes it at the verification URL, Convex flips to
 * connected. Skipped users stay on the default model.
 */
@Composable
fun ChatGptSettings(status: ChatGptStatus, gate: Boolean = false, onSkipped: (() -> Unit)? = null) {
  val container = LocalAppContainer.current
  val context = LocalContext.current
  val scope = rememberCoroutineScope()
  val colors = BeeTheme.colors
  var working by remember { mutableStateOf(false) }
  var copied by remember { mutableStateOf(false) }
  var error by remember { mutableStateOf<String?>(null) }
  val userCode = status.userCode
  val verificationUri = status.verificationUri
  val pending = status.state == "starting" || status.state == "pending"
  val needsConnection = status.state == "disconnected" || status.state == "failed" || status.state == "needs_reauth"

  fun run(block: suspend () -> Unit) {
    working = true
    error = null
    scope.launch {
      try {
        block()
      } catch (e: Exception) {
        error = e.message ?: "Something went wrong."
      } finally {
        working = false
      }
    }
  }

  SettingsCard {
    Text(if (status.state == "connected") "ChatGPT connected" else "Connect ChatGPT", style = BeeTheme.typography.body, color = colors.text)
    Text(
      when (status.state) {
        "connected" -> "Bee runs on your ChatGPT subscription."
        "needs_reauth" -> "ChatGPT needs to be connected again."
        else -> "Use your own ChatGPT or Codex subscription for Bee. Otherwise Bee runs on the default model."
      },
      style = BeeTheme.typography.small,
      color = colors.textSecondary,
    )
    if (status.state == "starting") Text("Creating a secure device code…", style = BeeTheme.typography.small, color = colors.textSecondary)
    if (status.state == "pending" && userCode != null) {
      Text("Enter this code at ${verificationUri ?: "the ChatGPT device page"}:", style = BeeTheme.typography.small, color = colors.textSecondary)
      Text(
        userCode,
        style = BeeTheme.typography.sectionTitle.copy(fontFamily = FontFamily.Monospace, letterSpacing = 2.sp),
        color = colors.text,
        modifier = Modifier.fillMaxWidth().background(colors.backgroundElement, RoundedCornerShape(Radius.compact)).clickable { copyToClipboard(context, userCode); copied = true }.padding(Spacing.two),
      )
      Text(if (copied) "Copied" else "Tap the code to copy it", style = BeeTheme.typography.small, color = colors.textSecondary)
    }
    status.message?.let { Text(it, style = BeeTheme.typography.small, color = colors.destructive) }
    error?.let { Text(it, style = BeeTheme.typography.small, color = colors.destructive) }
    Row(horizontalArrangement = Arrangement.spacedBy(Spacing.two), verticalAlignment = Alignment.CenterVertically) {
      if (needsConnection) FilledButton(if (working) "Starting…" else "Connect ChatGPT", enabled = !working, modifier = Modifier.weight(1f)) { run { container.connections.startChatgpt() } }
      if (status.state == "pending" && userCode != null && verificationUri != null) {
        FilledButton("Copy & open", modifier = Modifier.weight(1f)) {
          copyToClipboard(context, userCode)
          openAuthTab(context, verificationUri)
        }
      }
      if (pending || status.state == "connected") {
        OutlineButton(if (pending) "Cancel" else "Disconnect", destructive = status.state == "connected", enabled = !working, modifier = Modifier.weight(1f)) { run { container.connections.disconnectChatgpt() } }
      }
      if (gate && needsConnection) OutlineButton("Skip for now", enabled = !working, modifier = Modifier.weight(1f)) { run { container.connections.skipChatgpt(); onSkipped?.invoke() } }
    }
  }
}

/** Full-screen gate after sign-in until ChatGPT is connected or skipped. Port of `ChatGptAuthGate`. */
@Composable
fun ChatGptGate(content: @Composable () -> Unit) {
  val container = LocalAppContainer.current
  val flow = remember { container.connections.chatgpt().map { it.getOrNull() } }
  val status by flow.collectAsStateWithLifecycle(initialValue = null)
  val current = status
  when {
    current == null -> androidx.compose.foundation.layout.Box(Modifier.fillMaxWidth().background(BeeTheme.colors.background))
    current.state == "connected" || current.skipped -> content()
    else ->
      Column(modifier = Modifier.fillMaxWidth().padding(Spacing.three).padding(top = Spacing.six), verticalArrangement = Arrangement.spacedBy(Spacing.three)) {
        Text("Bring your own ChatGPT", style = BeeTheme.typography.sectionTitle, color = BeeTheme.colors.text)
        Text("Connect your subscription so Bee thinks with your ChatGPT, or skip and use the default model. You can change this later in your profile.", style = BeeTheme.typography.body, color = BeeTheme.colors.textSecondary)
        ChatGptSettings(current, gate = true)
      }
  }
}

@Composable
fun TelegramSettings() {
  val container = LocalAppContainer.current
  val context = LocalContext.current
  val scope = rememberCoroutineScope()
  val colors = BeeTheme.colors
  val flow = remember { container.connections.telegram().map { it.getOrNull() } }
  val status by flow.collectAsStateWithLifecycle(initialValue = null)
  var working by remember { mutableStateOf(false) }
  var error by remember { mutableStateOf<String?>(null) }
  val connected = status?.state == "connected"
  SettingsCard {
    Text(if (connected) "Telegram connected" else "Connect Telegram", style = BeeTheme.typography.body, color = colors.text)
    Text(
      if (connected) "Bee answers you in Telegram as ${status?.displayName ?: status?.username?.let { "@$it" } ?: "your account"}." else "Chat with Bee from Telegram and get Job results there.",
      style = BeeTheme.typography.small,
      color = colors.textSecondary,
    )
    (error ?: status?.message)?.let { Text(it, style = BeeTheme.typography.small, color = colors.destructive) }
    if (connected) OutlineButton("Disconnect", destructive = true, enabled = !working) { scope.launch { working = true; runCatching { container.connections.disconnectTelegram() }.onFailure { error = it.message }; working = false } }
    else FilledButton(if (working) "Opening…" else "Connect Telegram", enabled = !working) {
      scope.launch {
        working = true
        runCatching { openAuthTab(context, container.connections.beginTelegram().authorizationUrl) }.onFailure { error = it.message ?: "Could not start Telegram sign-in." }
        working = false
      }
    }
  }
}

@Composable
fun ImessageSettings() {
  val container = LocalAppContainer.current
  val scope = rememberCoroutineScope()
  val colors = BeeTheme.colors
  val flow = remember { container.connections.imessage().map { it.getOrNull() ?: emptyList() } }
  val connections by flow.collectAsStateWithLifecycle(initialValue = emptyList())
  var error by remember { mutableStateOf<String?>(null) }
  SettingsCard {
    Text(if (connections.isNotEmpty()) "iMessage connected" else "Connect iMessage", style = BeeTheme.typography.body, color = colors.text)
    Text(
      if (connections.isNotEmpty()) "Bee answers these senders in Messages." else "Text Bee from Messages and open the link she replies with — that is the whole setup.",
      style = BeeTheme.typography.small,
      color = colors.textSecondary,
    )
    for (connection in connections) {
      Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
        Text(connection.address, style = BeeTheme.typography.small, color = colors.text)
        Text("Disconnect", style = BeeTheme.typography.smallBold, color = colors.destructive, modifier = Modifier.clickable { scope.launch { runCatching { container.connections.disconnectImessage(connection.address) }.onFailure { error = it.message } } })
      }
    }
    error?.let { Text(it, style = BeeTheme.typography.small, color = colors.destructive) }
  }
}
