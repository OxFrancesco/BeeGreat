package com.beegreat.app.bee

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.slideInVertically
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import com.beegreat.app.bee.cards.BarChartCard
import com.beegreat.app.bee.cards.BookmarkCard
import com.beegreat.app.bee.cards.ConfirmCard
import com.beegreat.app.bee.cards.DevinCard
import com.beegreat.app.bee.cards.FirstFocusPreviewCard
import com.beegreat.app.bee.cards.GeneratedImageCard
import com.beegreat.app.bee.cards.HighlightCard
import com.beegreat.app.bee.cards.MetricCard
import com.beegreat.app.bee.cards.QuestionCard
import com.beegreat.app.bee.cards.TaskListCard
import com.beegreat.app.bee.cards.Web3ConfirmCard
import com.beegreat.contract.BeeUiComponent
import com.beegreat.contract.web3Confirmation
import com.beegreat.design.BeeTheme
import com.beegreat.design.Motion
import com.beegreat.design.Spacing
import kotlinx.coroutines.delay

/** Renders the agent's `beeui` spec as native cards staggering in below the reply. */
@Composable
fun GeneratedUi(components: List<BeeUiComponent>, onReply: (String) -> Unit) {
  if (components.isEmpty()) return
  Column(modifier = Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(Spacing.two)) {
    components.forEachIndexed { index, component ->
      var shown by remember(component) { mutableStateOf(false) }
      LaunchedEffect(component) {
        delay(index * 80L)
        shown = true
      }
      AnimatedVisibility(
        visible = shown,
        enter = fadeIn(Motion.enterSpec()) + slideInVertically(Motion.enterSpec()) { it / 6 },
      ) {
        ComponentView(component, onReply)
      }
    }
  }
}

@Composable
private fun ComponentView(component: BeeUiComponent, onReply: (String) -> Unit) {
  when (component) {
    is BeeUiComponent.Text -> Text(component.body, style = BeeTheme.typography.body, color = BeeTheme.colors.text)
    is BeeUiComponent.Metric -> MetricCard(component)
    is BeeUiComponent.Chart -> BarChartCard(component)
    is BeeUiComponent.Tasks -> TaskListCard(component)
    is BeeUiComponent.Highlight -> HighlightCard(component)
    is BeeUiComponent.Image -> GeneratedImageCard(component)
    is BeeUiComponent.Bookmark -> BookmarkCard(component)
    is BeeUiComponent.Devin -> DevinCard(component, onReply)
    is BeeUiComponent.FirstFocus -> FirstFocusPreviewCard(component)
    is BeeUiComponent.Confirm -> {
      val web3 = component.web3Confirmation()
      if (web3 != null) Web3ConfirmCard(web3, onReply) else ConfirmCard(component, onReply)
    }
    is BeeUiComponent.Question -> QuestionCard(component, onReply)
    BeeUiComponent.Unsupported -> Unit
  }
}
