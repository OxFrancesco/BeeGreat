package com.beegreat.app.shell

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import com.beegreat.design.BeeTheme
import com.beegreat.design.Spacing
import com.beegreat.design.components.ScreenHeader

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
