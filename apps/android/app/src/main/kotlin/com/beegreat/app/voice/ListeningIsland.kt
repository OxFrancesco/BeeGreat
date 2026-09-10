package com.beegreat.app.voice

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.beegreat.app.bee.ShimmerText
import com.beegreat.design.BeeTheme
import com.beegreat.design.Motion
import com.beegreat.design.Spacing
import com.beegreat.design.components.Hairline

/**
 * A floating pill that surfaces the mic state on every screen while a voice
 * note is in flight. Port of `listening-island.tsx`; a temporary layer, so it
 * is the one place a shadow is allowed.
 */
@Composable
fun ListeningIsland(state: OrbState, detail: String?, visible: Boolean, onClick: () -> Unit, modifier: Modifier = Modifier) {
  val colors = BeeTheme.colors
  AnimatedVisibility(
    visible = visible,
    modifier = modifier,
    enter = fadeIn(Motion.enterSpec()) + slideInVertically(Motion.enterSpec()) { it / 2 },
    exit = fadeOut(Motion.progressSpec()) + slideOutVertically(Motion.progressSpec()) { it / 2 },
  ) {
    val label =
      when (state) {
        OrbState.Listening -> "Listening"
        OrbState.Thinking -> detail ?: "Thinking"
        OrbState.Speaking -> "Speaking"
        OrbState.Idle -> ""
      }
    Row(
      modifier =
        Modifier.widthIn(max = 320.dp)
          .heightIn(min = 40.dp)
          .shadow(8.dp, CircleShape)
          .clip(CircleShape)
          .background(colors.card)
          .border(Hairline, colors.border, CircleShape)
          .clickable(onClick = onClick)
          .padding(horizontal = Spacing.three),
      horizontalArrangement = Arrangement.spacedBy(Spacing.two),
      verticalAlignment = Alignment.CenterVertically,
    ) {
      VoiceOrb(state = state, onClick = onClick, size = 22.dp, enabled = false)
      if (state == OrbState.Thinking) ShimmerText(label, colors.text, BeeTheme.typography.smallBold)
      else Text(label, style = BeeTheme.typography.smallBold, color = colors.text, maxLines = 1, overflow = TextOverflow.Ellipsis)
    }
  }
}
