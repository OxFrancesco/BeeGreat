@file:OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class, androidx.compose.foundation.layout.ExperimentalLayoutApi::class)
package app.pecu

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.*
import androidx.compose.foundation.shape.*
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.selection.SelectionContainer
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.*
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.*
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.*
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.*
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.*
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.*
import coil3.compose.AsyncImage
import com.mikepenz.markdown.m3.Markdown
import kotlinx.coroutines.launch

val suggestions = listOf("What's my balance?", "Quote 0.01 ETH to USDC", "Show my Aerodrome positions", "Odds of a Fed rate cut on Polymarket?", "/stocks")
private val commands = listOf("/wallet", "/balance", "/stocks", "/quote", "/swap", "/send", "/deposit", "/aero help", "/aave help", "/polymarket help", "/nansen", "/yolo", "/help")

@Composable fun PecuApp(
  model: PecuViewModel,
  auth: AccountUi = model.auth.collectAsStateWithLifecycle().value,
  chat: ChatState = model.chat.collectAsStateWithLifecycle().value,
) {
  var sheet by rememberSaveable { mutableStateOf<String?>(null) }
  var rail by rememberSaveable { mutableStateOf(true) }
  val uri = LocalUriHandler.current
  LifecycleEventEffect(Lifecycle.Event.ON_RESUME) { if (auth.signedIn && chat.pending == null) model.reload() }
  LaunchedEffect(auth.signedIn) { sheet = null }
  if (!auth.signedIn) {
    LoginScreen(auth, model::signIn)
    return
  }
  BackHandler(sheet != null) { sheet = null }
  Surface(color = MaterialTheme.colorScheme.background) {
    BoxWithConstraints(Modifier.fillMaxSize().safeDrawingPadding().imePadding()) {
      val expanded = maxWidth >= 840.dp
      Row(Modifier.fillMaxSize()) {
        if (expanded && rail && auth.signedIn) {
          Surface(Modifier.width(272.dp).fillMaxHeight(), color = MaterialTheme.colorScheme.surfaceVariant) {
            Column(Modifier.padding(16.dp)) { Wordmark(); Spacer(Modifier.height(20.dp)); ThreadList(model) }
          }
        }
        Column(Modifier.weight(1f).fillMaxHeight()) {
          Row(Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
            if (auth.signedIn) IconAction("Threads", Icons.AutoMirrored.Outlined.ViewSidebar) { if (expanded) rail = !rail else sheet = "threads" }
            Wordmark()
            Spacer(Modifier.weight(1f))
            if (auth.signedIn) {
              chat.account?.wallet?.let { wallet ->
                TextButton(onClick = { sheet = "wallet" }, contentPadding = PaddingValues(horizontal = 10.dp)) {
                  Text(shortAddress(chat.account?.signer ?: wallet), fontFamily = Mono, fontSize = 12.sp, maxLines = 1)
                }
              }
              IconButton(onClick = { sheet = "account" }) {
                if (auth.image != null) AsyncImage(auth.image, "Account", Modifier.size(34.dp).clip(CircleShape))
                else Icon(Icons.Outlined.AccountCircle, "Account")
              }
            }
          }
          if (chat.account?.yolo == true) TextButton(onClick = { model.send("/yolo off") }, enabled = chat.pending == null, modifier = Modifier.align(Alignment.End)) { Text("YOLO on · turn off", color = Brown) }
          Box(Modifier.weight(1f).fillMaxWidth(), contentAlignment = Alignment.TopCenter) {
            Conversation(model, chat, auth, Modifier.widthIn(max = 840.dp).fillMaxSize(), onConnect = { sheet = "connection" })
          }
          Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
            Composer(model, chat, auth, Modifier.widthIn(max = 840.dp).fillMaxWidth())
          }
        }
      }
      sheet?.let { page ->
        ModalBottomSheet(onDismissRequest = { sheet = null }, sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
          sheetMaxWidth = if (page == "wallet") WalletSheetMaxWidth else BottomSheetDefaults.SheetMaxWidth,
          containerColor = MaterialTheme.colorScheme.background) {
          when (page) {
            "threads" -> Column(Modifier.fillMaxWidth().fillMaxHeight(.82f).padding(horizontal = 20.dp)) { ThreadList(model) { sheet = null } }
            "account" -> Column(Modifier.fillMaxWidth().padding(24.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
              Text(auth.name, style = MaterialTheme.typography.headlineMedium)
              MenuRow("Balances", Icons.Outlined.AccountBalanceWallet) { sheet = "wallet" }
              MenuRow("ChatGPT connection", Icons.Outlined.Link) { sheet = "connection" }
              MenuRow("Profile and linked wallets", Icons.AutoMirrored.Outlined.OpenInNew) { uri.openUri("https://pecu.app/profile") }
              MenuRow("New thread", Icons.Outlined.Add) { model.newThread(); sheet = null }
              MenuRow("Sign out", Icons.AutoMirrored.Outlined.Logout) { model.signOut(); sheet = null }
            }
            "wallet" -> WalletSheet(model, chat) { sheet = null }
            "connection" -> ConnectionSheet(model)
          }
          Spacer(Modifier.height(24.dp))
        }
      }
    }
  }
}

@Composable fun Wordmark() { Text("pecu", color = Brown, fontFamily = Mono, fontWeight = FontWeight.Bold, fontSize = 22.sp, letterSpacing = (-1).sp) }
@Composable fun IconAction(label: String, icon: ImageVector, enabled: Boolean = true, action: () -> Unit) {
  IconButton(onClick = action, enabled = enabled) { Icon(icon, label, Modifier.size(20.dp)) }
}
@Composable private fun MenuRow(label: String, icon: ImageVector, action: () -> Unit) {
  TextButton(onClick = action, modifier = Modifier.fillMaxWidth(), contentPadding = PaddingValues(12.dp)) {
    Icon(icon, null, Modifier.size(20.dp)); Spacer(Modifier.width(12.dp)); Text(label, Modifier.weight(1f), color = MaterialTheme.colorScheme.onSurface)
  }
}

@Composable private fun ThreadList(model: PecuViewModel, selected: () -> Unit = {}) {
  val threads by model.threads.collectAsStateWithLifecycle()
  val chat by model.chat.collectAsStateWithLifecycle()
  var deleting by remember { mutableStateOf<Thread?>(null) }
  Button(onClick = { model.newThread(); selected() }, enabled = chat.pending == null, modifier = Modifier.fillMaxWidth()) { Icon(Icons.Outlined.Add, null); Spacer(Modifier.width(8.dp)); Text("New thread") }
  Spacer(Modifier.height(12.dp))
  LazyColumn(verticalArrangement = Arrangement.spacedBy(4.dp)) {
    items(threads.threads, key = { it.id ?: "default" }, contentType = { "thread" }) { thread ->
      Surface(color = if (thread.id == chat.thread) MaterialTheme.colorScheme.surface else MaterialTheme.colorScheme.surfaceVariant, shape = RoundedCornerShape(14.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
          Column(Modifier.weight(1f).clickable(enabled = chat.pending == null) { model.selectThread(thread.id); selected() }.padding(12.dp)) {
            Text(thread.title, maxLines = 2, overflow = TextOverflow.Ellipsis, fontSize = 13.sp, fontWeight = FontWeight.Medium)
            Text(relativeTime(thread.updatedAt), fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
          }
          IconAction("Delete thread ${thread.title}", Icons.Outlined.Delete, chat.pending == null) { deleting = thread }
        }
      }
    }
    if (threads.olderCursor != null) item { TextButton(onClick = { model.refreshThreads(true) }) { Text("Older threads") } }
  }
  deleting?.let { thread -> AlertDialog(onDismissRequest = { deleting = null }, title = { Text("Delete thread?") }, text = { Text("This removes its chat history. Transactions already confirmed stay on Base.") }, confirmButton = { TextButton(onClick = { model.deleteThread(thread); deleting = null }) { Text("Delete") } }, dismissButton = { TextButton(onClick = { deleting = null }) { Text("Cancel") } }) }
}

@Composable private fun Conversation(model: PecuViewModel, chat: ChatState, auth: AccountUi, modifier: Modifier, onConnect: () -> Unit) {
  val list = rememberLazyListState()
  val scope = rememberCoroutineScope()
  val allMessages = chat.account?.messages.orEmpty()
  val messages = remember(allMessages) { visibleReplyMessages(allMessages) }
  val atBottom by remember { derivedStateOf { !list.canScrollForward } }
  val showPending = chat.pending?.let { pending -> allMessages.none { it.id.endsWith(":" + pending.requestId) } } == true
  LaunchedEffect(chat.thread) { if (messages.isNotEmpty()) list.scrollToItem(messages.lastIndex) }
  LaunchedEffect(messages.lastOrNull()?.id, showPending) { if (atBottom && list.layoutInfo.totalItemsCount > 0) list.scrollToItem(list.layoutInfo.totalItemsCount - 1) }
  Box(modifier) {
    if (chat.loading) Box(Modifier.fillMaxSize(), Alignment.Center) { CircularProgressIndicator(Modifier.size(26.dp)) }
    else if (messages.isEmpty() && chat.pending == null) {
      Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 28.dp, vertical = 16.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
        Image(painterResource(R.drawable.pecu_idle), "Pecu", Modifier.widthIn(max = 320.dp).fillMaxWidth().aspectRatio(1f))
        Text(if (chat.thread == null) "Hi, I'm Pecu." else "New thread.", style = MaterialTheme.typography.headlineLarge, textAlign = TextAlign.Center)
        Spacer(Modifier.height(12.dp))
        Text(if (auth.signedIn) "Ask about your Base wallet, get a quote, or start a swap. Transactions require confirmation unless you enable YOLO." else "Sign in with Google, or with the X account you use with Pecu. Transactions require confirmation unless you enable YOLO.", textAlign = TextAlign.Center, color = MaterialTheme.colorScheme.onSurfaceVariant, lineHeight = 24.sp)
      }
    } else {
      LazyColumn(state = list, modifier = Modifier.fillMaxSize(), contentPadding = PaddingValues(20.dp), verticalArrangement = Arrangement.spacedBy(24.dp)) {
        if (chat.account?.olderCursor != null) item(key = "older") { TextButton(onClick = model::olderMessages, enabled = !chat.paging) { Text(if (chat.paging) "Loading…" else "Older messages") } }
        items(messages, key = Message::id, contentType = { "message" }) { message ->
          MessageView(message, model, chat.pending != null || chat.syncing || chat.account?.newerCursor != null, message.id == allMessages.lastOrNull()?.id, onConnect)
        }
        if (showPending) item(key = "pending") { Column(verticalArrangement = Arrangement.spacedBy(20.dp)) { UserBubble(chat.pending.text); LiveReplyView(model) } }
        item(key = "end") { Spacer(Modifier.height(4.dp)) }
      }
      if (!atBottom) SmallFloatingActionButton(onClick = { scope.launch { list.scrollToItem((list.layoutInfo.totalItemsCount - 1).coerceAtLeast(0)) } }, modifier = Modifier.align(Alignment.BottomEnd).padding(16.dp), containerColor = MaterialTheme.colorScheme.surface) { Icon(Icons.Outlined.ArrowDownward, "Latest messages") }
    }
  }
}

@Composable private fun MessageView(message: Message, model: PecuViewModel, busy: Boolean, latest: Boolean, onConnect: () -> Unit) {
  val command = message.text.matches(Regex("/(confirm|cancel) [A-Za-z0-9]{6}", RegexOption.IGNORE_CASE))
  Column(verticalArrangement = Arrangement.spacedBy(18.dp)) {
    if (!command) UserBubble(message.text)
    Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
      Image(painterResource(R.drawable.pecu_avatar), null, Modifier.size(32.dp))
      Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        val reply = message.reply
        if (reply == null) {
          if (busy && latest) LiveReplyView(model, avatar = false)
          else { Text("Waiting for Pecu…", color = MaterialTheme.colorScheme.onSurfaceVariant); TextButton(onClick = { model.resume(message) }, enabled = !busy) { Text("Resume response") } }
        } else {
          val legacy = remember(reply.text, reply.preview, reply.question, reply.positions) { if (reply.preview == null && reply.question == null && reply.positions == null) legacyPositions(reply.text) else null }
          val stocks = remember(reply, message.createdAt) { reply.holdings?.presentation() ?: if (reply.preview == null && reply.question == null) legacyStockHoldings(reply.text, message.createdAt) else null }
          val oldStocks = reply.holdings == null && stocks != null
          if (reply.preview != null) PreviewCard(reply.preview, busy, model)
          else if (!(reply.holdingsOnly || reply.analyticsOnly || reply.positionsOnly || legacy != null || oldStocks)) RichText(reply.question?.question ?: reply.text)
          reply.question?.let { question -> FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) { question.options.forEach { option -> OutlinedButton(onClick = { model.send(option, answerTo = message.id) }, enabled = !busy && latest) { Text(option) } } } }
          if (reply.preview == null) (reply.positions?.positions ?: legacy)?.let { PositionCards(it) }
          stocks?.let { StockHoldingsCard(it) }
          reply.analytics.forEach { AnalyticsView(it) }
          if (reply.recovery == "connect_chatgpt") TextButton(onClick = onConnect) { Text("Connect ChatGPT") }
          Row { CopyAction(reply.text); if (message.canRetry && latest) IconAction("Retry reply", Icons.Outlined.Refresh, !busy) { model.send(message.text, retryOf = message.id) } }
        }
      }
    }
  }
}

@Composable fun RichText(text: String) {
  val blocks = remember(text) { receiptPresentation(text) }
  Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
    blocks.forEach { block -> when (block) {
      is ReceiptBlock.Text -> SelectionContainer { Markdown(content = block.text, modifier = Modifier.fillMaxWidth()) }
      is ReceiptBlock.Receipts -> ReceiptLinks(block.links)
    } }
  }
}
@Composable private fun UserBubble(text: String) {
  Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
    Surface(Modifier.widthIn(max = 580.dp).clay(18), shape = RoundedCornerShape(18.dp, 18.dp, 6.dp, 18.dp), color = Amber, contentColor = androidx.compose.ui.graphics.Color.Black) {
      SelectionContainer { Text(text, Modifier.padding(horizontal = 14.dp, vertical = 10.dp), fontSize = 15.sp, lineHeight = 22.sp) }
    }
  }
}
@Composable private fun LiveReplyView(model: PecuViewModel, avatar: Boolean = true) {
  val live by model.live.collectAsStateWithLifecycle()
  Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
    if (avatar) Image(painterResource(R.drawable.pecu_thinking), null, Modifier.size(36.dp))
    Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(8.dp)) {
      Text(live.stages.lastOrNull()?.label ?: "Pecu is thinking…", fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite })
      if (live.text.isNotBlank()) RichText(live.text)
    }
  }
}

@Composable private fun Composer(model: PecuViewModel, chat: ChatState, auth: AccountUi, modifier: Modifier) {
  Column(modifier.padding(horizontal = 16.dp, vertical = 12.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
    if (chat.account?.newerCursor != null) TextButton(onClick = model::reload) { Text("Return to latest messages") }
    chat.error?.let { error -> Row(verticalAlignment = Alignment.CenterVertically) { Text(error, Modifier.weight(1f).semantics { liveRegion = LiveRegionMode.Polite }, color = MaterialTheme.colorScheme.error, fontSize = 13.sp); TextButton(onClick = { if (chat.retry != null) model.retry() else model.reload() }, enabled = chat.pending == null) { Text("Retry") } } }
    if (chat.error == null && chat.retry != null && chat.pending == null) TextButton(onClick = model::retry) { Text("Resume interrupted request") }
    if (chat.account?.messages.isNullOrEmpty() && chat.pending == null) LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) { items(suggestions) { suggestion -> SuggestionChip(onClick = { model.draft(suggestion) }, label = { Text(suggestion) }) } }
    if (chat.draft.startsWith("/") && !chat.draft.contains(' ')) LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) { items(commands.filter { it.startsWith(chat.draft) }) { command -> SuggestionChip(onClick = { model.draft("$command ") }, label = { Text(command) }) } }
    Surface(Modifier.fillMaxWidth().clay(), shape = RoundedCornerShape(22.dp), color = MaterialTheme.colorScheme.surface) {
      Row(Modifier.padding(start = 16.dp, end = 6.dp, top = 6.dp, bottom = 6.dp), verticalAlignment = Alignment.Bottom) {
        BasicTextField(value = chat.draft, onValueChange = model::draft, modifier = Modifier.weight(1f).heightIn(min = 48.dp, max = 160.dp).padding(vertical = 12.dp).semantics { contentDescription = "Message Pecu" }, textStyle = MaterialTheme.typography.bodyMedium.copy(color = MaterialTheme.colorScheme.onSurface, lineHeight = 22.sp), cursorBrush = SolidColor(Amber), decorationBox = { inner -> if (chat.draft.isEmpty()) Text("Ask Pecu about your wallet…", fontSize = 14.sp, color = MaterialTheme.colorScheme.onSurfaceVariant); inner() })
        FilledIconButton(onClick = { model.send() }, enabled = auth.ready && chat.pending == null && !chat.syncing && chat.draft.isNotBlank() && chat.account?.newerCursor == null, modifier = Modifier.size(48.dp)) { Icon(Icons.Outlined.ArrowUpward, "Send message") }
      }
    }
  }
}

@Suppress("DEPRECATION")
@Composable fun CopyAction(text: String) {
  val clipboard = LocalClipboardManager.current
  var copied by remember { mutableStateOf(false) }
  IconAction(if (copied) "Copied" else "Copy", if (copied) Icons.Outlined.Check else Icons.Outlined.ContentCopy) { clipboard.setText(AnnotatedString(text)); copied = true }
}
private fun relativeTime(time: Long): String {
  val minutes = ((System.currentTimeMillis() - time) / 60_000).coerceAtLeast(0)
  return when { minutes < 1 -> "Just now"; minutes < 60 -> "$minutes min ago"; minutes < 1440 -> "${minutes / 60} h ago"; else -> "${minutes / 1440} days ago" }
}
