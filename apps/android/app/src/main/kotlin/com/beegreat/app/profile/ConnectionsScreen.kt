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
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.beegreat.app.LocalAppContainer
import com.beegreat.app.shell.LocalNavigator
import com.beegreat.contract.GOOGLE_WORKSPACE_DISCLOSURE
import com.beegreat.contract.GOOGLE_WORKSPACE_DISCLOSURE_VERSION
import com.beegreat.contract.GOOGLE_WORKSPACE_SERVICES
import com.beegreat.design.BeeTheme
import com.beegreat.design.MaxContentWidth
import com.beegreat.design.Radius
import com.beegreat.design.Spacing
import com.beegreat.design.components.ScreenHeader
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.launch

private val BRAND = mapOf("github" to Color(0xFF24292F), "linear" to Color(0xFF5E6AD2), "notion" to Color(0xFF000000), "google" to Color(0xFF4285F4))

/** Port of `connections.tsx` + `beennectors-settings.tsx`: GitHub, Linear, Notion, Google Workspace. */
@Composable
fun ConnectionsScreen() {
  val container = LocalAppContainer.current
  val navigator = LocalNavigator.current
  val context = LocalContext.current
  val scope = rememberCoroutineScope()
  val colors = BeeTheme.colors
  val flow = remember { container.connections.beennectors().map { it.getOrNull() ?: emptyList() } }
  val connections by flow.collectAsStateWithLifecycle(initialValue = emptyList())
  var working by remember { mutableStateOf<String?>(null) }
  var error by remember { mutableStateOf<Pair<String, String>?>(null) }
  var googleDisclosure by remember { mutableStateOf(false) }
  val googleServices = remember { mutableStateListOf<String>() }

  fun connect(provider: String) {
    working = provider
    error = null
    scope.launch {
      try {
        val start =
          if (provider == "google") container.connections.beginBeennector(provider, googleServices.toList(), GOOGLE_WORKSPACE_DISCLOSURE_VERSION)
          else container.connections.beginBeennector(provider, null, null)
        openAuthTab(context, start.authorizationUrl)
      } catch (e: Exception) {
        error = provider to (e.message ?: "Could not start sign-in. Try again.")
      } finally {
        working = null
      }
    }
  }

  fun disconnect(provider: String) {
    working = provider
    error = null
    scope.launch {
      runCatching { container.connections.disconnectBeennector(provider) }.onFailure { error = provider to "Could not disconnect. Try again." }
      working = null
    }
  }

  Box(modifier = Modifier.fillMaxSize().background(colors.background), contentAlignment = Alignment.TopCenter) {
    Column(
      modifier = Modifier.widthIn(max = MaxContentWidth).fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = Spacing.three).padding(bottom = Spacing.five),
      verticalArrangement = Arrangement.spacedBy(Spacing.three),
    ) {
      ScreenHeader(title = "Work connectors", onBack = navigator::back)
      Text("Give Bee read access to the tools you already use. Each connector is scoped and can be disconnected here.", style = BeeTheme.typography.small, color = colors.textSecondary)
      for (connection in connections) {
        val connected = connection.state == "connected"
        val pending = connection.state == "pending"
        SettingsCard {
          Row(horizontalArrangement = Arrangement.spacedBy(Spacing.two), verticalAlignment = Alignment.CenterVertically) {
            Box(modifier = Modifier.size(36.dp).background(BRAND[connection.provider] ?: colors.secondary, RoundedCornerShape(10.dp)), contentAlignment = Alignment.Center) {
              Text(connection.name.take(1), style = BeeTheme.typography.smallBold, color = Color.White)
            }
            Column(modifier = Modifier.weight(1f)) {
              Text(connection.name, style = BeeTheme.typography.body, color = colors.text)
              Text(
                when {
                  connected -> listOfNotNull(connection.accountName, connection.workspaceName).joinToString(" · ").ifEmpty { "Connected" }
                  pending -> "Finishing sign-in…"
                  else -> connection.description
                },
                style = BeeTheme.typography.small,
                color = colors.textSecondary,
              )
            }
          }
          (error?.takeIf { it.first == connection.provider }?.second ?: connection.message)?.let { Text(it, style = BeeTheme.typography.small, color = colors.destructive) }
          if (connected) OutlineButton("Disconnect", destructive = true, enabled = working == null) { disconnect(connection.provider) }
          else FilledButton(if (working == connection.provider) "Opening…" else if (connection.state == "needs_reauth") "Connect again" else "Connect", enabled = working == null) {
            if (connection.provider == "google") googleDisclosure = true else connect(connection.provider)
          }
        }
      }
    }
  }

  if (googleDisclosure) {
    ModalBottomSheet(onDismissRequest = { googleDisclosure = false }, containerColor = colors.background) {
      Column(modifier = Modifier.padding(horizontal = Spacing.three).padding(bottom = Spacing.five), verticalArrangement = Arrangement.spacedBy(Spacing.two)) {
        Text("Choose what Bee can reach", style = BeeTheme.typography.barTitle, color = colors.text)
        for (service in GOOGLE_WORKSPACE_SERVICES) {
          val selected = service.id in googleServices
          Column(modifier = Modifier.fillMaxWidth().clickable { if (selected) googleServices.remove(service.id) else googleServices.add(service.id) }.padding(vertical = Spacing.one)) {
            Text("${if (selected) "✓" else "○"} ${service.name}", style = BeeTheme.typography.small, color = colors.text)
            Text(service.access, style = BeeTheme.typography.small, color = colors.textSecondary)
          }
        }
        Text(GOOGLE_WORKSPACE_DISCLOSURE, style = BeeTheme.typography.small, color = colors.textSecondary)
        FilledButton("Continue to Google", enabled = googleServices.isNotEmpty(), modifier = Modifier.fillMaxWidth()) {
          googleDisclosure = false
          connect("google")
        }
      }
    }
  }
}
