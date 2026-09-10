package com.beegreat.app.shell

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Modifier
import com.beegreat.design.BeeTheme
import com.beegreat.design.Spacing
import com.beegreat.design.components.ScreenHeader
import com.clerk.api.Clerk
import kotlinx.coroutines.launch

@Composable
fun PlaceholderScreen(title: String, note: String) {
  Column(
    modifier = Modifier.fillMaxSize().padding(horizontal = Spacing.three),
    verticalArrangement = Arrangement.spacedBy(Spacing.three),
  ) {
    ScreenHeader(title = title)
    Text(text = note, style = BeeTheme.typography.body, color = BeeTheme.colors.textSecondary)
  }
}

/** Until the profile lands in Phase 6, the sheet only offers sign-out. */
@Composable
fun ProfilePlaceholderSheet(onDismiss: () -> Unit) {
  val scope = rememberCoroutineScope()
  ModalBottomSheet(onDismissRequest = onDismiss, containerColor = BeeTheme.colors.background) {
    Column(modifier = Modifier.padding(Spacing.three).padding(bottom = Spacing.five), verticalArrangement = Arrangement.spacedBy(Spacing.two)) {
      ScreenHeader(title = "Profile")
      Text("Profile settings land in Phase 6.", style = BeeTheme.typography.body, color = BeeTheme.colors.textSecondary)
      TextButton(onClick = { scope.launch { Clerk.auth.signOut() }; onDismiss() }) { Text("Sign out") }
    }
  }
}
