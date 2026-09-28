@file:OptIn(androidx.compose.foundation.layout.ExperimentalLayoutApi::class)
package app.pecu

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.OpenInNew
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp

@Composable fun ReceiptLinks(links: List<ReceiptLink>, onOpen: ((String) -> Unit)? = null) {
  val uri = LocalUriHandler.current
  var expanded by rememberSaveable(links) { mutableStateOf(false) }
  FlowRow(horizontalArrangement = Arrangement.spacedBy(10.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
    (if (expanded) links else links.take(3)).forEachIndexed { index, link ->
      val label = if (link.label == "View transaction" && links.size > 1) "View transaction ${index + 1}" else link.label
      TextButton(
        onClick = { if (onOpen != null) onOpen(link.url) else uri.openUri(link.url) },
        modifier = Modifier.heightIn(min = 44.dp).clayMaterial(MaterialTheme.colorScheme.surface, radius = 16).semantics { contentDescription = "$label on Basescan, ${link.hash}" },
        shape = RoundedCornerShape(16.dp), contentPadding = PaddingValues(horizontal = 16.dp, vertical = 12.dp),
      ) {
        Text(label, Modifier.weight(1f, fill = false), style = MaterialTheme.typography.labelLarge)
        Spacer(Modifier.width(8.dp)); Icon(Icons.AutoMirrored.Filled.OpenInNew, null, Modifier.size(16.dp))
      }
    }
    if (links.size > 3) TextButton(onClick = { expanded = !expanded }) { Text(if (expanded) "Show fewer transactions" else "Show all transactions") }
  }
}
