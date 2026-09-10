package com.beegreat.app.profile

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AccountBalanceWallet
import androidx.compose.material.icons.filled.Hub
import androidx.compose.material.icons.filled.QrCode2
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material.icons.filled.Nfc
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.beegreat.app.LocalAppContainer
import com.beegreat.app.common.ConfirmDialog
import com.beegreat.app.common.HexAvatar
import com.beegreat.app.shell.LocalNavigator
import com.beegreat.app.voice.VoiceMode
import com.beegreat.convex.connections.Powerup
import com.beegreat.design.BeeTheme
import com.beegreat.design.MaxContentWidth
import com.beegreat.design.Spacing
import com.beegreat.design.components.ScreenHeader
import com.clerk.api.Clerk
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.launch

/**
 * Port of `profile.tsx`. Subscriptions are iOS-only in the Expo app, so
 * Android has no paywall or purchase rows; everything else is here.
 */
@Composable
fun ProfileScreen() {
  val container = LocalAppContainer.current
  val navigator = LocalNavigator.current
  val context = LocalContext.current
  val scope = rememberCoroutineScope()
  val colors = BeeTheme.colors
  val user by Clerk.userFlow.collectAsStateWithLifecycle()
  val powerupsFlow = remember { container.connections.powerups().map { it.getOrNull() ?: emptyList() } }
  val powerups by powerupsFlow.collectAsStateWithLifecycle(initialValue = emptyList())
  val googleHealthFlow = remember { container.connections.googleHealth().map { it.getOrNull() } }
  val googleHealth by googleHealthFlow.collectAsStateWithLifecycle(initialValue = null)
  val chatgptFlow = remember { container.connections.chatgpt().map { it.getOrNull() } }
  val chatgpt by chatgptFlow.collectAsStateWithLifecycle(initialValue = null)
  val voiceMode by container.preferences.voiceMode.collectAsStateWithLifecycle()
  val speakReplies by container.preferences.speakReplies.collectAsStateWithLifecycle()
  val deleting by container.accountDeletion.deleting.collectAsStateWithLifecycle()
  val deletionError by container.accountDeletion.error.collectAsStateWithLifecycle()
  var openInfo by remember { mutableStateOf<String?>(null) }
  var googleHealthWorking by remember { mutableStateOf(false) }
  var googleHealthError by remember { mutableStateOf<String?>(null) }
  var confirmingDelete by remember { mutableStateOf(false) }
  var confirmingSignOut by remember { mutableStateOf(false) }

  fun toggleGoogleHealth(enabled: Boolean) {
    googleHealthWorking = true
    googleHealthError = null
    scope.launch {
      try {
        if (enabled) {
          if (googleHealth?.state != "connected") openAuthTab(context, container.connections.beginGoogleHealth().authorizationUrl)
          container.connections.setPowerupEnabled("google-health", true)
        } else {
          container.connections.setPowerupEnabled("google-health", false)
          container.connections.disconnectGoogleHealth()
        }
      } catch (e: Exception) {
        googleHealthError = e.message ?: "Google Health could not be updated."
      } finally {
        googleHealthWorking = false
      }
    }
  }

  Box(modifier = Modifier.fillMaxSize().background(colors.background), contentAlignment = Alignment.TopCenter) {
    Column(
      modifier = Modifier.widthIn(max = MaxContentWidth).fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = Spacing.three).padding(bottom = Spacing.six),
      verticalArrangement = Arrangement.spacedBy(Spacing.four),
    ) {
      ScreenHeader(title = "Profile", onBack = navigator::back)
      Row(horizontalArrangement = Arrangement.spacedBy(Spacing.three), verticalAlignment = Alignment.CenterVertically) {
        HexAvatar(size = 64.dp, imageUrl = user?.imageUrl?.takeIf { user?.hasImage == true })
        Column {
          Text(listOfNotNull(user?.firstName, user?.lastName).joinToString(" ").ifBlank { "Bee keeper" }, style = BeeTheme.typography.sectionTitle, color = colors.text)
          user?.primaryEmailAddress?.emailAddress?.let { Text(it, style = BeeTheme.typography.small, color = colors.textSecondary) }
        }
      }
      SettingsSection("Share") { SettingsLink(Icons.Filled.QrCode2, "Public profile & QR", "Share your hive and wallet address", navigator::openPublicProfile) }
      SettingsSection("Automation") {
        SettingsLink(Icons.Filled.Schedule, "Agent Jobs", "Scheduled runs and their results", navigator::openJobs)
        SettingsLink(Icons.Filled.Nfc, "Tap actions", "NFC tags that log water or nudge a goal", navigator::openNfcActions)
      }
      SettingsSection("Connections") {
        SettingsLink(Icons.Filled.Hub, "Work connectors", "GitHub, Linear, Notion, Google Workspace", navigator::openConnections)
        chatgpt?.let { ChatGptSettings(it) }
        TelegramSettings()
        ImessageSettings()
      }
      SettingsSection("Preferences") {
        SettingsCard {
          SettingsToggle(
            "Voice mode",
            if (voiceMode == VoiceMode.Conversation) "Talk opens a live Grok Voice conversation" else "Talk records a voice note Bee transcribes",
            checked = voiceMode == VoiceMode.Conversation,
          ) { container.preferences.setVoiceMode(if (it) VoiceMode.Conversation else VoiceMode.VoiceNote) }
          SettingsToggle("Speak replies", "Bee reads finished replies aloud", checked = speakReplies) { container.preferences.setSpeakReplies(it) }
        }
      }
      if (powerups.isNotEmpty()) {
        SettingsSection("Power-ups") {
          for (powerup in powerups) {
            PowerupRow(
              powerup = powerup,
              checked = if (powerup.id == "google-health") googleHealthWorking || (powerup.enabled && googleHealth?.state == "connected") else powerup.enabled,
              enabled = !(powerup.id == "google-health" && googleHealthWorking),
              infoOpen = openInfo == powerup.id,
              onInfo = { openInfo = if (openInfo == powerup.id) null else powerup.id },
              error = if (powerup.id == "google-health" && !googleHealthWorking) googleHealthError ?: googleHealth?.message?.takeIf { powerup.enabled } else null,
            ) { enabled ->
              if (powerup.id == "google-health") toggleGoogleHealth(enabled)
              else scope.launch { runCatching { container.connections.setPowerupEnabled(powerup.id, enabled) } }
            }
          }
        }
      }
      if (powerups.any { it.id == "web3" && it.enabled }) {
        SettingsSection("Wallets") { SettingsLink(Icons.Filled.AccountBalanceWallet, "Wallets", "Bee smart wallet and linked wallet", navigator::openWallets) }
      }
      SettingsSection("Account") {
        SettingsCard {
          Text("Delete account", style = BeeTheme.typography.body, color = colors.text)
          Text("Removes your goals, conversations, Mind, Hive, and connection credentials. This cannot be undone.", style = BeeTheme.typography.small, color = colors.textSecondary)
          deletionError?.let { Text(it, style = BeeTheme.typography.small, color = colors.destructive) }
          OutlineButton(if (deleting) "Deleting…" else "Delete BeeGreat account", destructive = true, enabled = !deleting) { confirmingDelete = true }
        }
        OutlineButton("Sign out", modifier = Modifier.fillMaxWidth()) { confirmingSignOut = true }
      }
    }
  }

  if (confirmingDelete) {
    ConfirmDialog(
      "Delete BeeGreat account?",
      "BeeGreat deletes your sign-in account, then removes goals, conversations, Mind, Hive, and connection credentials in the background. Cleanup normally starts immediately when online; safety sweeps may continue for up to 30 days. Public blockchain records and information held by connected providers may remain. This cannot be undone.",
      "Delete",
      onDismiss = { confirmingDelete = false },
    ) {
      scope.launch { container.accountDeletion.deleteAccount() }
    }
  }
  if (confirmingSignOut) {
    ConfirmDialog("Sign out?", "You can sign back in with Google any time.", "Sign out", onDismiss = { confirmingSignOut = false }) {
      scope.launch { Clerk.auth.signOut() }
    }
  }
}

@Composable
private fun PowerupRow(powerup: Powerup, checked: Boolean, enabled: Boolean, infoOpen: Boolean, onInfo: () -> Unit, error: String?, onChange: (Boolean) -> Unit) {
  val colors = BeeTheme.colors
  SettingsCard {
    Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.two)) {
      Column(modifier = Modifier.weight(1f)) {
        Text(powerup.name, style = BeeTheme.typography.body, color = colors.text)
        Text(powerup.tagline, style = BeeTheme.typography.small, color = colors.textSecondary)
      }
      Text("ⓘ", style = BeeTheme.typography.body, color = if (infoOpen) colors.text else colors.textSecondary, modifier = Modifier.clickable(onClick = onInfo).padding(Spacing.one))
      androidx.compose.material3.Switch(
        checked = checked,
        onCheckedChange = onChange,
        enabled = enabled,
        colors = androidx.compose.material3.SwitchDefaults.colors(checkedTrackColor = colors.primary, checkedThumbColor = colors.primaryForeground),
      )
    }
    if (infoOpen) Text(powerup.description, style = BeeTheme.typography.small, color = colors.textSecondary)
    error?.let { Text(it, style = BeeTheme.typography.small, color = colors.destructive) }
  }
}
