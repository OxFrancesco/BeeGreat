@file:OptIn(androidx.compose.foundation.layout.ExperimentalLayoutApi::class)
package app.pecu

import android.graphics.Bitmap
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.text.selection.SelectionContainer
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.innerShadow
import androidx.compose.ui.graphics.shadow.Shadow
import androidx.compose.ui.unit.DpOffset
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.google.zxing.BarcodeFormat
import com.google.zxing.MultiFormatWriter
import java.math.BigDecimal
import java.math.RoundingMode
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

private val walletTokenPattern = Regex("(?:0x[0-9a-fA-F]{40}|[A-Za-z][A-Za-z0-9.-]{0,19})")
private val walletAddressPattern = Regex("0x[0-9a-fA-F]{40}")
private val walletAmountPattern = Regex("[0-9]+(?:\\.[0-9]{1,18})?")
internal val WalletSheetMaxWidth = 960.dp

fun walletBalanceText(raw: String?): String {
  val value = raw?.takeIf { it.length <= 100 && it.matches(Regex("[0-9]+(?:\\.[0-9]+)?")) }?.toBigDecimalOrNull() ?: return "Unavailable"
  if (value.signum() > 0 && value < BigDecimal("0.000001")) return "<0.000001"
  val rounded = value.setScale(6, RoundingMode.DOWN).stripTrailingZeros()
  return (if (rounded.compareTo(value) == 0) "" else "≈") + rounded.toPlainString()
}

fun walletTransferAllowed(account: AccountState?, blocked: Boolean, symbol: String, amount: String, recipient: String): Boolean =
  account?.wallet != null && account.signer == null && !account.yolo && !blocked &&
    symbol.matches(walletTokenPattern) && amount.matches(walletAmountPattern) &&
    amount.toBigDecimalOrNull()?.signum() == 1 && recipient.matches(walletAddressPattern)

@Composable fun WalletSheet(model: PecuViewModel, chat: ChatState, close: () -> Unit) {
  val portfolio by model.portfolio.collectAsStateWithLifecycle()
  val error by model.panelError.collectAsStateWithLifecycle()
  val busy by model.panelBusy.collectAsStateWithLifecycle()
  val pnl by model.pnl.collectAsStateWithLifecycle()
  val wallet = chat.account?.signer ?: chat.account?.wallet
  LaunchedEffect(wallet) { model.loadPortfolio() }
  WalletContent(chat.account, portfolio, busy, error, pnl,
    transferBlocked = chat.pending != null || chat.syncing || chat.account?.newerCursor != null,
    onLoadPortfolio = model::loadPortfolio, onLoadPnl = model::loadPnl,
    onReview = { command -> if (model.reviewTransfer(command, wallet)) close() })
}

@Composable internal fun WalletContent(
  account: AccountState?, portfolio: Portfolio?, busy: Boolean = false, error: String? = null,
  pnl: Analytics? = null, transferBlocked: Boolean = false,
  onLoadPortfolio: (List<String>) -> Unit, onLoadPnl: (Int) -> Unit, onReview: (String) -> Unit,
) {
  val wallet = account?.signer ?: account?.wallet
  var panel by rememberSaveable(wallet) { mutableStateOf<String?>(null) }
  var adding by rememberSaveable(wallet) { mutableStateOf(false) }
  var token by rememberSaveable(wallet) { mutableStateOf("") }
  var showPnl by rememberSaveable(wallet) { mutableStateOf(false) }
  var days by rememberSaveable(wallet) { mutableIntStateOf(30) }
  val tokens = remember(portfolio?.balances) { (listOf("ETH", "USDC", "AERO") + portfolio?.balances.orEmpty().map { it.reference }).distinct() }
  BoxWithConstraints(Modifier.fillMaxWidth().heightIn(max = 760.dp).testTag("wallet-sheet")) {
    val fontScale = LocalDensity.current.fontScale
    val wide = maxWidth >= 700.dp && fontScale < 1.5f
    val stacked = maxWidth / fontScale < 330.dp
    Column(Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).imePadding().padding(horizontal = 22.dp, vertical = 12.dp), verticalArrangement = Arrangement.spacedBy(22.dp)) {
      val heading: @Composable () -> Unit = {
        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
          Text("Wallet", style = MaterialTheme.typography.headlineMedium)
          Text("Base network", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
      }
      val address: @Composable () -> Unit = {
        if (wallet != null) Row(verticalAlignment = Alignment.CenterVertically) {
          Text(shortAddress(wallet), style = MaterialTheme.typography.bodySmall, fontFamily = Mono)
          key(wallet) { CopyAction(wallet) }
        }
      }
      if (stacked) Column(verticalArrangement = Arrangement.spacedBy(8.dp)) { heading(); address() }
      else Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        Box(Modifier.weight(1f)) { heading() }; address()
      }
      val balances: @Composable () -> Unit = {
        Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
          Column(Modifier.fillMaxWidth().clayMaterial(MaterialTheme.colorScheme.surface, radius = 30).padding(18.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            if (portfolio?.balances.isNullOrEmpty()) Text(
              if (wallet == null) "Your Base wallet is created with your first message." else if (busy) "Loading balances…" else "No balances available.",
              Modifier.padding(vertical = 12.dp), style = MaterialTheme.typography.bodyMedium)
            portfolio?.balances?.forEach { balance -> key(balance.reference) { WalletBalanceRow(balance) } }
            if (busy) LinearProgressIndicator(Modifier.fillMaxWidth().padding(top = 12.dp))
          }
          val receive: @Composable (Modifier) -> Unit = { modifier ->
            WalletAction(if (panel == "receive") "Close receive" else "Receive", Icons.Outlined.ArrowDownward,
              modifier, primary = true, enabled = wallet != null) { panel = if (panel == "receive") null else "receive" }
          }
          val send: @Composable (Modifier) -> Unit = { modifier ->
            WalletAction(if (panel == "send") "Close transfer" else "Send", Icons.Outlined.ArrowUpward,
              modifier, enabled = wallet != null) { panel = if (panel == "send") null else "send" }
          }
          if (stacked) Column(verticalArrangement = Arrangement.spacedBy(12.dp)) { receive(Modifier.fillMaxWidth()); send(Modifier.fillMaxWidth()) }
          else Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) { receive(Modifier.weight(1f)); send(Modifier.weight(1f)) }
          TextButton(onClick = { adding = !adding }, modifier = Modifier.align(Alignment.Start)) {
            Icon(if (adding) Icons.Outlined.Close else Icons.Outlined.Add, null, Modifier.size(18.dp)); Spacer(Modifier.width(8.dp))
            Text(if (adding) "Cancel adding token" else "Add token")
          }
          if (adding) {
            WalletField(token, { token = it }, "Ticker or token address")
            WalletAction("Add", Icons.Outlined.Add, Modifier.fillMaxWidth(), enabled = !busy && token.trim().matches(walletTokenPattern)) {
              onLoadPortfolio((tokens + token.trim()).distinct())
            }
          }
          error?.let {
            Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodyMedium)
            TextButton(onClick = { onLoadPortfolio(tokens) }, enabled = !busy) { Text("Retry") }
          }
        }
      }
      val activity: @Composable () -> Unit = {
        Column(verticalArrangement = Arrangement.spacedBy(22.dp)) {
          if (panel == "receive" && wallet != null) WalletReceive(wallet)
          if (panel == "send") WalletTransfer(account, portfolio, transferBlocked, onReview)
          portfolio?.holdings?.let { HoldingsView(it) }
          portfolio?.stocksError?.let { Text(it, color = MaterialTheme.colorScheme.error) }
          WalletAction(if (showPnl) "Hide P&L" else "Trading P&L", if (showPnl) Icons.Outlined.ExpandLess else Icons.Outlined.ExpandMore, Modifier.fillMaxWidth()) {
            showPnl = !showPnl; if (showPnl) onLoadPnl(days)
          }
          if (showPnl) {
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
              listOf(7, 30, 90, 365).forEach { period ->
                FilterChip(selected = days == period, onClick = { days = period; onLoadPnl(days) }, label = { Text("${period}d") })
              }
            }
            pnl?.let { AnalyticsView(it) } ?: if (!busy) Text("No trading P&L returned for this period.") else Unit
          }
        }
      }
      if (wide) Row(horizontalArrangement = Arrangement.spacedBy(24.dp), verticalAlignment = Alignment.Top) {
        Column(Modifier.weight(1f)) { balances() }; Column(Modifier.weight(1f)) { activity() }
      } else { balances(); activity() }
      Spacer(Modifier.height(12.dp))
    }
  }
}

@Composable private fun WalletBalanceRow(balance: Balance) {
  var details by rememberSaveable(balance.reference) { mutableStateOf(false) }
  val compact = remember(balance.amount, balance.error) { if (balance.error != null) "Unavailable" else walletBalanceText(balance.amount) }
  val colors = MaterialTheme.colorScheme
  Column(Modifier.fillMaxWidth()) {
    Row(Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).clickable(role = Role.Button, onClickLabel = "${if (details) "Hide" else "Show"} ${balance.symbol} balance details") { details = !details }
      .semantics { stateDescription = if (details) "Expanded" else "Collapsed" }.padding(vertical = 12.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
      Box(Modifier.size(42.dp).clayMaterial(colors.surfaceVariant, radius = 21), contentAlignment = Alignment.Center) {
        Text(balance.symbol.take(1), style = MaterialTheme.typography.titleMedium, color = colors.primary)
      }
      Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(5.dp)) {
        Text(balance.symbol, style = MaterialTheme.typography.titleMedium)
        Text(compact, style = MaterialTheme.typography.bodyLarge, fontFamily = Mono)
      }
      Icon(if (details) Icons.Outlined.ExpandLess else Icons.Outlined.ExpandMore, null, Modifier.size(20.dp), tint = colors.onSurfaceVariant)
    }
    if (details) Column(Modifier.fillMaxWidth().padding(start = 4.dp, bottom = 14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
      SelectionContainer { Text(balance.error ?: "${balance.amount ?: "Unavailable"} ${balance.symbol}", style = MaterialTheme.typography.bodySmall, color = if (balance.error != null) colors.error else colors.onSurfaceVariant) }
      balance.address?.let { address ->
        Row(verticalAlignment = Alignment.CenterVertically) {
          SelectionContainer(Modifier.weight(1f)) { Text(address, style = MaterialTheme.typography.bodySmall, fontFamily = Mono) }
          CopyAction(address)
        }
      }
    }
  }
}

@Composable private fun WalletReceive(address: String) {
  Column(Modifier.fillMaxWidth().clayMaterial(MaterialTheme.colorScheme.surface, radius = 30).padding(20.dp), verticalArrangement = Arrangement.spacedBy(16.dp), horizontalAlignment = Alignment.CenterHorizontally) {
    Text("Receive on Base", style = MaterialTheme.typography.titleMedium)
    WalletQrCode(address)
    Row(verticalAlignment = Alignment.CenterVertically) {
      SelectionContainer(Modifier.weight(1f)) { Text(address, style = MaterialTheme.typography.bodySmall, fontFamily = Mono) }
      CopyAction(address)
    }
  }
}

@Composable private fun WalletTransfer(account: AccountState?, portfolio: Portfolio?, blocked: Boolean, onReview: (String) -> Unit) {
  var symbol by rememberSaveable { mutableStateOf("USDC") }
  var amount by rememberSaveable { mutableStateOf("") }
  var recipient by rememberSaveable { mutableStateOf("") }
  val selected = portfolio?.balances?.firstOrNull { it.symbol.equals(symbol.trim(), true) || it.address.equals(symbol.trim(), true) }
  Column(Modifier.fillMaxWidth().clayMaterial(MaterialTheme.colorScheme.surface, radius = 30).padding(20.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
    Text("Send tokens", style = MaterialTheme.typography.titleMedium)
    WalletField(symbol, { symbol = it }, "Token ticker or address")
    selected?.let { Text("Available: ${if (it.error != null) "Unavailable" else walletBalanceText(it.amount)} ${it.symbol}", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant) }
    WalletField(amount, { amount = it }, "Amount", KeyboardType.Decimal)
    WalletField(recipient, { recipient = it }, "Recipient on Base")
    if (account?.yolo == true) Text("Turn off YOLO before reviewing a transfer.", color = MaterialTheme.colorScheme.error)
    if (account?.signer != null) Text("Use pecu.app to send from your linked wallet.", style = MaterialTheme.typography.bodyMedium)
    WalletAction("Review transfer", Icons.Outlined.ArrowUpward, Modifier.fillMaxWidth(), primary = true,
      enabled = walletTransferAllowed(account, blocked, symbol.trim(), amount, recipient.trim())) {
      onReview("/send $amount ${symbol.trim()} to ${recipient.trim()}")
    }
  }
}

@Composable private fun WalletField(value: String, change: (String) -> Unit, label: String, keyboard: KeyboardType = KeyboardType.Text) {
  val shape = RoundedCornerShape(16.dp)
  val inset = Modifier.fillMaxWidth().background(MaterialTheme.colorScheme.surfaceVariant, shape)
    .innerShadow(shape, Shadow(radius = 4.dp, offset = DpOffset(2.dp, 2.dp), color = Color.Black.copy(alpha = .18f)))
    .innerShadow(shape, Shadow(radius = 3.dp, offset = DpOffset((-2).dp, (-2).dp), color = Color.White.copy(alpha = .08f)))
  TextField(value, change, inset, label = { Text(label) }, singleLine = true,
    shape = RoundedCornerShape(16.dp), keyboardOptions = KeyboardOptions(keyboardType = keyboard),
    colors = TextFieldDefaults.colors(focusedContainerColor = Color.Transparent, unfocusedContainerColor = Color.Transparent,
      focusedIndicatorColor = Color.Transparent, unfocusedIndicatorColor = Color.Transparent))
}

@Composable private fun WalletAction(label: String, icon: ImageVector, modifier: Modifier = Modifier, primary: Boolean = false, enabled: Boolean = true, onClick: () -> Unit) {
  val fill = if (primary && enabled) Amber else MaterialTheme.colorScheme.surfaceVariant
  Button(onClick, modifier.heightIn(min = 52.dp).clayMaterial(fill, primary && enabled, radius = 18), enabled = enabled,
    shape = RoundedCornerShape(18.dp), contentPadding = PaddingValues(horizontal = 16.dp, vertical = 14.dp),
    colors = ButtonDefaults.buttonColors(containerColor = Color.Transparent, contentColor = if (primary) Color.Black else MaterialTheme.colorScheme.onSurface,
      disabledContainerColor = Color.Transparent)) {
    Icon(icon, null, Modifier.size(20.dp)); Spacer(Modifier.width(10.dp))
    Text(label, Modifier.weight(1f, fill = false), textAlign = TextAlign.Center)
  }
}

internal fun walletQrBitmap(address: String): Bitmap {
  val bits = MultiFormatWriter().encode(address, BarcodeFormat.QR_CODE, 400, 400)
  return Bitmap.createBitmap(400, 400, Bitmap.Config.ARGB_8888).apply {
    val pixels = IntArray(400 * 400) { i -> if (bits[i % 400, i / 400]) android.graphics.Color.BLACK else android.graphics.Color.WHITE }
    setPixels(pixels, 0, 400, 0, 0, 400, 400)
  }
}

@Composable private fun WalletQrCode(address: String) {
  val qr by produceState<Bitmap?>(null, address) { value = withContext(Dispatchers.Default) { walletQrBitmap(address) } }
  Box(Modifier.widthIn(max = 220.dp).fillMaxWidth().aspectRatio(1f).background(Color.White, RoundedCornerShape(22.dp)).padding(8.dp), contentAlignment = Alignment.Center) {
    qr?.let { Image(it.asImageBitmap(), "Wallet QR code", Modifier.fillMaxSize().testTag("wallet-qr")) }
      ?: CircularProgressIndicator(Modifier.size(24.dp), color = Color.Black)
  }
}
