package com.beegreat.app.web3

import com.beegreat.convex.web3.EoaStep
import com.beegreat.flue.FlueJson
import com.beegreat.flue.await
import java.math.BigInteger
import kotlinx.coroutines.delay
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody

private val EVM_ADDRESS = Regex("^0x[0-9a-fA-F]{40}$")
private val EVM_HASH = Regex("^0x[0-9a-fA-F]{64}$")
private val EVM_DATA = Regex("^0x(?:[0-9a-fA-F]{2})*$")

fun sameEvmAddress(a: String?, b: String?): Boolean = a != null && b != null && a.equals(b, ignoreCase = true)

fun shortenAddress(address: String) = if (address.length > 12) "${address.take(6)}…${address.takeLast(4)}" else address

private fun weiHex(value: String): String {
  require(value.matches(Regex("^\\d+$"))) { "BeeGreat received an invalid transaction value." }
  return "0x" + BigInteger(value).toString(16)
}

/** Classifies a wallet failure the way `eoaFailureReason` does for `reportEoaFailure`. */
fun eoaFailureReason(cause: Throwable): String {
  val message = cause.message?.lowercase() ?: ""
  return when {
    cause is WalletRequestRejected && (message.contains("reject") || message.contains("denied") || message.contains("cancel")) -> "user_rejected"
    message.contains("connect the wallet shown") -> "account_changed"
    else -> "wallet_error"
  }
}

/** `personal_sign` of the Convex link challenge by the connected address. */
suspend fun WalletConnect.signWalletLink(address: String, message: String): String {
  require(EVM_ADDRESS.matches(address)) { "BeeGreat received an invalid wallet address." }
  require(message.isNotBlank()) { "The wallet-link request is empty." }
  val params = buildJsonArray { add(JsonPrimitive(message)); add(JsonPrimitive(address)) }.toString()
  return request("personal_sign", params)?.toString() ?: throw IllegalStateException("The wallet returned no signature.")
}

data class SubmittedTransaction(val index: Int, val hash: String, val role: String)

/**
 * Port of `sendFreshEoaTransactions`: verify the connected account and chain,
 * then loop: rebuild the plan, send its first approval (or the single action),
 * record the hash, wait for a successful receipt, repeat until the action
 * lands. The wallet stays the signer and shows its own approval UI.
 */
suspend fun WalletConnect.sendFreshEoaTransactions(
  http: OkHttpClient,
  address: String,
  chainId: Long,
  buildPlan: suspend () -> List<EoaStep>,
  onSubmitted: suspend (SubmittedTransaction) -> Unit,
  onConfirmed: suspend (SubmittedTransaction) -> Unit,
  maxBuilds: Int = 8,
): List<SubmittedTransaction> {
  require(EVM_ADDRESS.matches(address)) { "BeeGreat received an invalid wallet address." }
  val connected = account.value ?: throw IllegalStateException("Connect the wallet shown in this confirmation and try again.")
  if (!sameEvmAddress(connected.address, address)) throw IllegalStateException("Connect the wallet shown in this confirmation and try again.")
  if (connected.chainId != chainId) throw IllegalStateException("Switch your wallet to chain $chainId in the wallet app and try again.")
  val rpc = WalletConnect.rpcUrl(chainId) ?: throw IllegalStateException("BeeGreat does not know an RPC for chain $chainId.")

  val submitted = ArrayList<SubmittedTransaction>()
  repeat(maxBuilds) {
    val plan = buildPlan()
    if (plan.isEmpty() || plan.count { it.role == "action" } != 1 || plan.last().role != "action") throw IllegalStateException("BeeGreat received an invalid fresh transaction plan.")
    for (step in plan) {
      require(EVM_ADDRESS.matches(step.transaction.to)) { "BeeGreat received an invalid wallet address." }
      require(EVM_DATA.matches(step.transaction.data)) { "BeeGreat received invalid transaction data." }
      weiHex(step.transaction.value)
    }
    val step = plan.firstOrNull { it.role == "approval" } ?: plan.last()
    val params =
      buildJsonArray {
        add(buildJsonObject { put("from", address); put("to", step.transaction.to); put("data", step.transaction.data); put("value", weiHex(step.transaction.value)) })
      }.toString()
    val hash = request("eth_sendTransaction", params)?.toString() ?: ""
    if (!EVM_HASH.matches(hash)) throw IllegalStateException("The wallet returned an invalid transaction hash.")
    val result = SubmittedTransaction(submitted.size, hash, step.role)
    submitted += result
    onSubmitted(result)
    waitForSuccessfulReceipt(http, rpc, hash)
    onConfirmed(result)
    if (step.role == "action") return submitted
  }
  throw IllegalStateException("The wallet plan still requires approvals after repeated refreshes.")
}

/** Polls the chain RPC directly; wallets do not proxy `eth_getTransactionReceipt`. */
private suspend fun waitForSuccessfulReceipt(http: OkHttpClient, rpc: String, hash: String, timeoutMs: Long = 120_000, intervalMs: Long = 1_500) {
  val deadline = System.currentTimeMillis() + timeoutMs
  while (System.currentTimeMillis() <= deadline) {
    val body = buildJsonObject { put("jsonrpc", "2.0"); put("id", 1); put("method", "eth_getTransactionReceipt"); put("params", buildJsonArray { add(JsonPrimitive(hash)) }) }
    val response = http.newCall(Request.Builder().url(rpc).post(body.toString().toRequestBody("application/json".toMediaType())).build()).await()
    val receipt = response.use { runCatching { FlueJson.parseToJsonElement(it.body.string()).jsonObject["result"] }.getOrNull() }
    if (receipt != null && receipt !is JsonNull) {
      when ((receipt as? JsonObject)?.get("status")?.jsonPrimitive?.contentOrNull) {
        "0x1" -> return
        "0x0" -> throw IllegalStateException("Wallet transaction $hash reverted on-chain.")
        else -> throw IllegalStateException("Wallet transaction $hash returned an invalid receipt.")
      }
    }
    delay(intervalMs)
  }
  throw IllegalStateException("Timed out waiting for wallet transaction $hash.")
}
