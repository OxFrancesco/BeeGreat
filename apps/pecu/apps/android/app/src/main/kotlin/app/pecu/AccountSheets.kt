package app.pecu

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import kotlinx.coroutines.delay

@Composable fun ConnectionSheet(model: PecuViewModel) {
  val connection by model.inference.collectAsStateWithLifecycle()
  val busy by model.panelBusy.collectAsStateWithLifecycle()
  val error by model.panelError.collectAsStateWithLifecycle()
  val uri = LocalUriHandler.current
  LaunchedEffect(Unit) { model.loadInference() }
  LaunchedEffect(connection?.loginState) { if (connection?.loginState == "pending") while (true) { delay(5000); model.loadInference() } }
  Column(Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).padding(24.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
    Text("ChatGPT connection", style = MaterialTheme.typography.headlineMedium)
    connection?.let { status ->
      Text(if (status.connected) "Connected" else "Connect your ChatGPT account to use your subscription with Pecu.")
      if (status.connected) Text(status.model, fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
      status.login?.let { login ->
        Text(login.instructions)
        login.userCode?.let { code -> Row(verticalAlignment = Alignment.CenterVertically) { Text(code, fontFamily = Mono, fontSize = 24.sp); CopyAction(code) } }
        val url = remember(login.url) { runCatching { java.net.URI(login.url) }.getOrNull() }
        if (url?.scheme == "https" && url.host in listOf("auth.openai.com", "chatgpt.com")) Button(onClick = { uri.openUri(login.url) }) { Text("Continue to ChatGPT") }
        TextButton(onClick = model::loadInference, enabled = !busy) { Text("Check connection") }
      }
      if (status.login == null) Button(onClick = { model.connect(!status.connected) }, enabled = !busy) { Text(if (status.connected) "Disconnect ChatGPT" else "Connect ChatGPT") }
    }
    if (busy) LinearProgressIndicator(Modifier.fillMaxWidth())
    error?.let { Text(it, color = MaterialTheme.colorScheme.error); TextButton(onClick = model::loadInference) { Text("Retry") } }
  }
}
