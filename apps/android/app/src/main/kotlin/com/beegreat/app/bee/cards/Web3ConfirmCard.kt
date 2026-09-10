package com.beegreat.app.bee.cards

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.beegreat.app.LocalAppContainer
import com.beegreat.app.shell.LocalNavigator
import com.beegreat.app.web3.eoaFailureReason
import com.beegreat.app.web3.sameEvmAddress
import com.beegreat.app.web3.sendFreshEoaTransactions
import com.beegreat.app.web3.shortenAddress
import com.beegreat.contract.Web3Confirmation
import com.beegreat.design.BeeTheme
import com.beegreat.design.Radius
import com.beegreat.design.Spacing
import com.beegreat.design.components.Hairline
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.launch

private val WEB3_BORDER = Color(0x668066E8)
private val WEB3_ACCENT = Color(0xFF6248C6)

/**
 * Action-bound Web3 confirmation. Smart-wallet actions confirm through Convex
 * with the exact summary the user read; linked-wallet actions claim the plan,
 * then the connected wallet signs each fresh step. The card follows the
 * action's live status afterwards.
 */
@Composable
fun Web3ConfirmCard(confirmation: Web3Confirmation, onReply: (String) -> Unit) {
  val colors = BeeTheme.colors
  val container = LocalAppContainer.current
  val navigator = LocalNavigator.current
  val scope = rememberCoroutineScope()
  val liveFlow = remember(confirmation.actionId) { container.web3Actions.status(confirmation.actionId).map { it.getOrNull() } }
  val live by liveFlow.collectAsStateWithLifecycle(initialValue = null)
  var decision by remember(confirmation.actionId) { mutableStateOf("idle") }
  var error by remember(confirmation.actionId) { mutableStateOf<String?>(null) }
  val status = live?.status
  val summary = live?.summary ?: confirmation.summary
  val isEoa = live?.kind == "execute_eoa_plan"
  val settled = decision != "idle" || (status != null && status != "pending")

  val connected by container.walletConnect.account.collectAsStateWithLifecycle()
  val expectedEoa = live?.eoaRequest?.walletAddress
  val eoaSessionMatches = isEoa && connected != null && sameEvmAddress(connected?.address, expectedEoa)

  fun confirm() {
    val action = live ?: return
    if (settled) return
    if (isEoa && !eoaSessionMatches) {
      error = "Connect the wallet ${expectedEoa?.let(::shortenAddress) ?: ""} in Wallets first, then authorize."
      return
    }
    decision = "confirming"
    error = null
    scope.launch {
      var eoaClaimed = false
      try {
        if (isEoa) {
          val plan = container.web3Actions.beginEoaExecution(action.id, action.summary)
          eoaClaimed = true
          try {
            container.walletConnect.sendFreshEoaTransactions(
              http = container.http,
              address = plan.walletAddress,
              chainId = plan.chainId.toLong(),
              buildPlan = { container.web3Actions.refreshEoaExecution(action.id).transactionSteps },
              onSubmitted = { container.web3Actions.recordEoaSubmission(action.id, it.index, it.hash, it.role) },
              onConfirmed = { container.web3Actions.recordEoaReceipt(action.id, it.index, it.hash) },
            )
          } catch (cause: Exception) {
            container.web3Actions.reportEoaFailure(action.id, eoaFailureReason(cause))
            throw cause
          }
          onReply("I signed the linked-wallet action in the app. Check its status.")
        } else {
          container.web3Actions.confirm(action.id, action.summary)
          onReply("I confirmed the action in the app. Check its status.")
        }
        decision = "confirmed"
      } catch (e: Exception) {
        decision = if (eoaClaimed) "confirmed" else "idle"
        error = e.message ?: "Could not confirm the action."
      }
    }
  }

  fun decline() {
    val action = live ?: return
    if (settled) return
    decision = "declining"
    error = null
    scope.launch {
      try {
        val cancelled = container.web3Actions.cancel(action.id)
        decision = "declined"
        if (cancelled) onReply("No, I declined the action.")
      } catch (e: Exception) {
        decision = "idle"
        error = e.message ?: "Could not decline the action."
      }
    }
  }

  Column(
    modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(Radius.card)).background(colors.card).border(Hairline, WEB3_BORDER, RoundedCornerShape(Radius.card)).padding(Spacing.three),
    verticalArrangement = Arrangement.spacedBy(Spacing.two),
  ) {
    Text(
      when {
        live?.autoConfirmed == true -> "Auto-approved"
        status == null -> "Web3 action"
        status == "pending" -> "Authorize this action"
        else -> "Web3 action ${status.replace('_', ' ')}"
      },
      style = BeeTheme.typography.smallBold,
      color = WEB3_ACCENT,
    )
    Text(summary, style = BeeTheme.typography.body, color = colors.text)
    when {
      live == null -> Text("Loading the action…", style = BeeTheme.typography.small, color = colors.textSecondary)
      isEoa && status == "pending" && !eoaSessionMatches && !settled -> {
        Text("Sign with your linked wallet ${expectedEoa?.let(::shortenAddress) ?: ""}. Connect it in Wallets, then come back.", style = BeeTheme.typography.small, color = colors.textSecondary)
        ConfirmRow(onYes = { navigator.openWallets() }, onNo = ::decline, yesLabel = "Open Wallets", noLabel = "Decline")
      }
      isEoa && status == "pending" && !settled -> ConfirmRow(onYes = ::confirm, onNo = ::decline, yesLabel = "Sign in wallet", noLabel = "Decline")
      status == "pending" && !settled -> ConfirmRow(onYes = ::confirm, onNo = ::decline, yesLabel = "Authorize", noLabel = "Decline")
      status == "pending" -> Text(if (decision == "declining") "Declining…" else "Authorizing…", style = BeeTheme.typography.small, color = colors.textSecondary)
      status == "cancelled" -> Text("You declined this action.", style = BeeTheme.typography.small, color = colors.textSecondary)
      status == "expired" -> Text("This action expired before it was authorized.", style = BeeTheme.typography.small, color = colors.textSecondary)
      status == "failed" -> Text("The action failed. Ask Bee to check what happened.", style = BeeTheme.typography.small, color = colors.destructive)
      status == "succeeded" -> Text("Done. Ask Bee for the receipt.", style = BeeTheme.typography.small, color = colors.textSecondary)
      else -> Text("In progress…", style = BeeTheme.typography.small, color = colors.textSecondary)
    }
    error?.let { Text(it, style = BeeTheme.typography.small, color = colors.destructive) }
  }
}
