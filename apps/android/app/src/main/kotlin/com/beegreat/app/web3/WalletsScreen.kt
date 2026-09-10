package com.beegreat.app.web3

import androidx.compose.foundation.background
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
import androidx.fragment.app.FragmentActivity
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.beegreat.app.LocalAppContainer
import com.beegreat.app.bee.copyToClipboard
import com.beegreat.app.common.HoneyQrCode
import com.beegreat.app.profile.FilledButton
import com.beegreat.app.profile.OutlineButton
import com.beegreat.app.profile.SettingsCard
import com.beegreat.app.profile.SettingsToggle
import com.beegreat.app.shell.LocalNavigator
import com.beegreat.design.BeeTheme
import com.beegreat.design.MaxContentWidth
import com.beegreat.design.Spacing
import com.beegreat.design.components.ScreenHeader
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.launch

private fun formatChain(chain: String) = chain.split('-', '_').joinToString(" ") { it.replaceFirstChar(Char::uppercase) }

/** Port of `wallet-settings.tsx`: the Bee smart wallet, the linked wallet, YOLO mode. */
@Composable
fun WalletsScreen() {
  val container = LocalAppContainer.current
  val navigator = LocalNavigator.current
  val context = LocalContext.current
  val scope = rememberCoroutineScope()
  val colors = BeeTheme.colors
  val walletsFlow = remember { container.wallets.myWallets().map { it.getOrNull() } }
  val wallets by walletsFlow.collectAsStateWithLifecycle(initialValue = null)
  val prefsFlow = remember { container.wallets.prefs().map { it.getOrNull() } }
  val prefs by prefsFlow.collectAsStateWithLifecycle(initialValue = null)
  val connected by container.walletConnect.account.collectAsStateWithLifecycle()
  var working by remember { mutableStateOf(false) }
  var linkRequested by remember { mutableStateOf(false) }
  var showQr by remember { mutableStateOf(false) }
  var copied by remember { mutableStateOf(false) }
  var error by remember { mutableStateOf<String?>(null) }
  var yoloError by remember { mutableStateOf<String?>(null) }
  val linked = wallets?.eoa?.address
  val sessionMatches = linked != null && connected != null && sameEvmAddress(linked, connected?.address)

  suspend fun linkConnected() {
    val wallet = connected ?: return
    if (linked != null && sameEvmAddress(linked, wallet.address)) return
    val challenge = container.wallets.beginEoaLink(wallet.address)
    val signature = container.walletConnect.signWalletLink(wallet.address, challenge.message)
    container.wallets.linkEoa(challenge.challengeId, signature)
  }

  // A fresh connection finishes the link the user asked for.
  androidx.compose.runtime.LaunchedEffect(connected, linkRequested) {
    if (!linkRequested || connected == null) return@LaunchedEffect
    linkRequested = false
    working = true
    runCatching { linkConnected() }.onFailure { error = it.message ?: "Couldn’t link that wallet." }
    working = false
  }

  fun connect() {
    val activity = context as? FragmentActivity ?: return
    if (!container.walletConnect.configured) {
      error = "Linked wallets need a WalletConnect project id in this build."
      return
    }
    error = null
    if (connected != null) {
      working = true
      scope.launch { runCatching { linkConnected() }.onFailure { error = it.message ?: "Couldn’t link that wallet." }; working = false }
      return
    }
    linkRequested = true
    container.walletConnect.connect(activity)
  }

  Box(modifier = Modifier.fillMaxSize().background(colors.background), contentAlignment = Alignment.TopCenter) {
    Column(
      modifier = Modifier.widthIn(max = MaxContentWidth).fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = Spacing.three).padding(bottom = Spacing.five),
      verticalArrangement = Arrangement.spacedBy(Spacing.three),
    ) {
      ScreenHeader(title = "Wallets", onBack = navigator::back)
      SettingsCard {
        Text("Bee smart wallet", style = BeeTheme.typography.body, color = colors.text)
        val smart = wallets?.smartWallet
        Text(
          smart?.let { "${shortenAddress(it.address)} · ${it.supportedChains.joinToString(" · ") { c -> formatChain(c) }}" } ?: "Created the first time you ask Bee about your wallet",
          style = BeeTheme.typography.small,
          color = colors.textSecondary,
        )
        if (smart != null) {
          Row(horizontalArrangement = Arrangement.spacedBy(Spacing.two)) {
            OutlineButton(if (copied) "Copied" else "Copy address", modifier = Modifier.weight(1f)) { copyToClipboard(context, smart.address); copied = true }
            OutlineButton(if (showQr) "Hide QR" else "Show QR", modifier = Modifier.weight(1f)) { showQr = !showQr }
          }
          if (showQr) Box(modifier = Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) { HoneyQrCode(value = "ethereum:${smart.address}", size = 184.dp) }
        }
      }
      SettingsCard {
        Text("Your wallet", style = BeeTheme.typography.body, color = colors.text)
        Text(
          linked?.let { "${shortenAddress(it)} · ${if (sessionMatches) "Ready to sign" else "Reconnect to sign"}" } ?: "Link with WalletConnect so Bee can prepare transactions for you to sign",
          style = BeeTheme.typography.small,
          color = colors.textSecondary,
        )
        error?.let { Text(it, style = BeeTheme.typography.small, color = colors.destructive) }
        Row(horizontalArrangement = Arrangement.spacedBy(Spacing.two)) {
          if (linked == null) FilledButton(if (working || linkRequested) "Linking…" else "Link my wallet", enabled = !working, modifier = Modifier.weight(1f)) { connect() }
          else {
            if (!sessionMatches) FilledButton(if (working) "Opening…" else "Reconnect", enabled = !working, modifier = Modifier.weight(1f)) {
              scope.launch { runCatching { container.walletConnect.disconnect() }; connect() }
            }
            OutlineButton("Unlink", destructive = true, enabled = !working, modifier = Modifier.weight(1f)) {
              scope.launch {
                working = true
                runCatching { container.wallets.unlinkEoa(); container.walletConnect.disconnect() }.onFailure { error = it.message }
                working = false
              }
            }
          }
        }
      }
      SettingsCard {
        SettingsToggle(
          "YOLO mode",
          if (prefs?.yoloEnabled == true) "Bee auto-approves Bee smart-wallet transactions only" else "Bee asks before every transaction",
          checked = prefs?.yoloEnabled == true,
        ) { enabled -> scope.launch { runCatching { container.wallets.setYolo(enabled) }.onFailure { yoloError = it.message ?: "Couldn’t update YOLO mode." } } }
        yoloError?.let { Text(it, style = BeeTheme.typography.small, color = colors.destructive) }
      }
    }
  }
}
