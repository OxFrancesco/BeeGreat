package com.beegreat.app.bee

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Menu
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.beegreat.app.LocalAppContainer
import com.beegreat.app.common.FloatingBee
import com.beegreat.app.common.HexAvatar
import com.beegreat.app.common.HexIconButton
import com.beegreat.app.hive.CurrencyBar
import com.beegreat.app.shell.LocalNavigator
import com.beegreat.design.BeeTheme
import com.beegreat.design.MaxContentWidth
import com.beegreat.design.Spacing
import com.beegreat.design.components.Hairline
import com.beegreat.flue.FlueMessage
import com.beegreat.flue.FluePart
import com.clerk.api.Clerk
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.launch

private val HERO_SUGGESTIONS = listOf("What should I focus on today?", "Show my goals", "What tasks are still open?")

/** Port of `(tabs)/index.tsx`: the Bee chat, the hero when the thread is empty, and the composer. */
@Composable
fun BeeScreen() {
  val container = LocalAppContainer.current
  val navigator = LocalNavigator.current
  val agent = container.beeAgent
  val state by agent.state.collectAsStateWithLifecycle()
  val user by Clerk.userFlow.collectAsStateWithLifecycle()
  val scope = rememberCoroutineScope()
  val colors = BeeTheme.colors

  Box(modifier = Modifier.fillMaxSize().background(colors.background), contentAlignment = Alignment.TopCenter) {
    Column(modifier = Modifier.widthIn(max = MaxContentWidth).fillMaxSize().padding(horizontal = Spacing.three).imePadding()) {
      Row(
        modifier = Modifier.fillMaxWidth().padding(top = Spacing.one, bottom = Spacing.two),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
      ) {
        HexIconButton(Icons.Filled.Menu, contentDescription = "Conversations", onClick = navigator::openThreads)
        CurrencyBar()
        Box(modifier = Modifier.clip(CircleShape).clickable(onClick = navigator::openProfile)) {
          HexAvatar(size = 36.dp, imageUrl = user?.imageUrl?.takeIf { user?.hasImage == true })
        }
      }

      val messages = state.messages
      if (messages.isEmpty()) {
        BoxWithConstraints(modifier = Modifier.weight(1f).fillMaxWidth()) {
          val compact = maxHeight < 360.dp
          Column(
            modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(vertical = if (compact) Spacing.two else Spacing.three),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
          ) {
            Box(modifier = Modifier.clickable { navigator.openVoiceConversation() }) { FloatingBee(height = if (compact) 80.dp else 120.dp) }
            Spacer(Modifier.heightIn(min = if (compact) Spacing.three else Spacing.five))
            Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(Spacing.two)) {
              for (suggestion in HERO_SUGGESTIONS) {
                Box(
                  modifier =
                    Modifier.heightIn(min = 44.dp)
                      .clip(CircleShape)
                      .background(colors.card)
                      .border(Hairline, colors.border, CircleShape)
                      .clickable { scope.launch { runCatching { agent.sendText(suggestion) } } }
                      .padding(horizontal = Spacing.three, vertical = Spacing.two),
                  contentAlignment = Alignment.Center,
                ) {
                  Text(suggestion, style = BeeTheme.typography.body, color = colors.text, textAlign = TextAlign.Center)
                }
              }
            }
          }
        }
      } else {
        Conversation(
          messages = messages,
          busy = state.busy,
          canLoadOlder = state.canLoadOlder,
          loadingOlder = state.loadingOlder,
          onLoadOlder = agent::loadOlder,
          onReply = { text -> scope.launch { runCatching { agent.sendText(text) } } },
          onRetry = { scope.launch { agent.retryLastReply() } },
          modifier = Modifier.weight(1f),
        )
      }

      Column(modifier = Modifier.padding(top = Spacing.one, bottom = Spacing.two), verticalArrangement = Arrangement.spacedBy(Spacing.one)) {
        state.errorMessage?.let {
          Text(it, style = BeeTheme.typography.small, color = colors.destructive, textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth())
        }
        PromptInput(onSubmit = agent::sendText, enabled = !state.busy)
      }
    }
  }
}

/**
 * The transcript. Follows the tail while the user is at the bottom, loads
 * older pages when the top comes into view. Streaming growth scrolls without
 * animation so a single reply never restarts motion.
 */
@Composable
fun Conversation(
  messages: List<FlueMessage>,
  busy: Boolean,
  canLoadOlder: Boolean,
  loadingOlder: Boolean,
  onLoadOlder: () -> Unit,
  onReply: (String) -> Unit,
  onRetry: () -> Unit,
  modifier: Modifier = Modifier,
) {
  val listState = rememberLazyListState()
  val lastMessage = messages.lastOrNull()
  val awaitingReply =
    busy &&
      (lastMessage?.isAssistant != true ||
        lastMessage.parts.none { it is FluePart.Tool || it is FluePart.Reasoning || (it is FluePart.Text && it.text.isNotEmpty()) })

  val following = remember { derivedFollowing(listState) }
  val followingNow by following.collectAsStateWithLifecycle(initialValue = true)
  LaunchedEffect(messages, awaitingReply) {
    if (followingNow && messages.isNotEmpty()) listState.scrollToItem(messages.size + 1)
  }
  LaunchedEffect(listState, canLoadOlder, loadingOlder) {
    snapshotFlow { listState.firstVisibleItemIndex }
      .distinctUntilChanged()
      .collect { index -> if (index == 0 && canLoadOlder && !loadingOlder) onLoadOlder() }
  }

  LazyColumn(state = listState, modifier = modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(Spacing.three)) {
    item(key = "header") {
      if (loadingOlder) {
        Box(modifier = Modifier.fillMaxWidth().padding(vertical = Spacing.two), contentAlignment = Alignment.Center) {
          CircularProgressIndicator(modifier = Modifier.heightIn(max = 20.dp), strokeWidth = 2.dp, color = BeeTheme.colors.textSecondary)
        }
      }
    }
    items(messages.size, key = { messages[it].id }) { index ->
      val message = messages[index]
      val showSpeaker = index == 0 || messages[index - 1].role != message.role
      if (message.isUser) UserMessage(message, showSpeaker)
      else AssistantMessage(message, isLast = index == messages.lastIndex, busy = busy, onReply = onReply, onRetry = onRetry)
    }
    item(key = "footer") { if (awaitingReply) ThinkingActivity() else Spacer(Modifier.heightIn(min = 1.dp)) }
  }
}

/** True while the list is scrolled to (or near) its end. */
private fun derivedFollowing(listState: androidx.compose.foundation.lazy.LazyListState) =
  snapshotFlow {
      val info = listState.layoutInfo
      val last = info.visibleItemsInfo.lastOrNull()
      last == null || last.index >= info.totalItemsCount - 2
    }
    .map { it }
    .distinctUntilChanged()
