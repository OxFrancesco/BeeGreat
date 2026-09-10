package com.beegreat.app.web3

import android.app.Application
import android.util.Log
import androidx.fragment.app.FragmentActivity
import com.beegreat.app.BuildConfig
import com.reown.android.Core
import com.reown.android.CoreClient
import com.reown.appkit.client.AppKit
import com.reown.appkit.client.Modal
import com.reown.appkit.client.models.request.Request
import com.reown.appkit.client.models.request.SentRequestResult
import com.reown.appkit.presets.AppKitChainsPresets
import com.reown.appkit.ui.AppKitSheet
import com.reown.appkit.utils.EthUtils
import java.util.concurrent.ConcurrentHashMap
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeout

data class ConnectedWallet(val address: String, val chainId: Long)

class WalletRequestRejected(message: String) : RuntimeException(message)

/**
 * Reown AppKit bridge. Port of `wallet-connect.ts` and `useEoaWallet`: the
 * same chain list as the Expo app, the account exposed as state, and JSON-RPC
 * requests to the connected wallet awaited through the modal delegate.
 * Unconfigured (no project id) behaves like the Expo build: everything about
 * the linked wallet says so and nothing crashes.
 */
class WalletConnect(private val application: Application) {
  val configured: Boolean = BuildConfig.REOWN_PROJECT_ID.isNotBlank()

  private val _account = MutableStateFlow<ConnectedWallet?>(null)
  val account: StateFlow<ConnectedWallet?> = _account.asStateFlow()

  private val pending = ConcurrentHashMap<Long, CompletableDeferred<Any?>>()
  private var initialized = false

  fun initialize() {
    if (!configured || initialized) return
    initialized = true
    val metaData =
      Core.Model.AppMetaData(
        name = "BeeGreat",
        description = "Bee, your goals coach",
        url = "https://beegreat.app",
        icons = listOf("https://beegreat.app/icon.png"),
        redirect = "beegreat://wallet",
      )
    CoreClient.initialize(application = application, projectId = BuildConfig.REOWN_PROJECT_ID, metaData = metaData) { Log.w(TAG, "walletconnect.core ${it.throwable}") }
    AppKit.initialize(Modal.Params.Init(core = CoreClient)) { Log.w(TAG, "walletconnect.appkit ${it.throwable}") }
    AppKit.setChains(CHAINS)
    AppKit.setDelegate(delegate)
    refreshAccount()
  }

  private fun refreshAccount() {
    val current = runCatching { AppKit.getAccount() }.getOrNull()
    _account.value = current?.let { ConnectedWallet(it.address, it.chain.chainReference.toLongOrNull() ?: 0) }
  }

  /** Opens the AppKit sheet over the given activity. Connection lands in [account]. */
  fun connect(activity: FragmentActivity) {
    if (!configured) return
    AppKitSheet().show(activity.supportFragmentManager, "appkit")
  }

  suspend fun disconnect() {
    if (!configured) return
    suspendCancellableCoroutine { continuation ->
      AppKit.disconnect(onSuccess = { continuation.resume(Unit) }, onError = { continuation.resumeWithException(it) })
    }
    _account.value = null
  }

  /** Sends one JSON-RPC request to the wallet and returns its result (a JSON scalar or object). */
  suspend fun request(method: String, paramsJson: String, timeoutMs: Long = 180_000): Any? =
    withTimeout(timeoutMs) {
      val deferred = CompletableDeferred<Any?>()
      withContext(Dispatchers.IO) {
        suspendCancellableCoroutine<Unit> { continuation ->
          AppKit.request(
            Request(method = method, params = paramsJson),
            onSuccess = { sent ->
              val id = (sent as? SentRequestResult.WalletConnect)?.requestId
              if (id != null) pending[id] = deferred else deferred.completeExceptionally(IllegalStateException("The wallet did not accept the request."))
              continuation.resume(Unit)
            },
            onError = { continuation.resumeWithException(it) },
          )
        }
      }
      deferred.await()
    }

  private val delegate =
    object : AppKit.ModalDelegate {
      override fun onSessionApproved(approvedSession: Modal.Model.ApprovedSession) = refreshAccount()

      override fun onSessionRejected(rejectedSession: Modal.Model.RejectedSession) = refreshAccount()

      override fun onSessionUpdate(updatedSession: Modal.Model.UpdatedSession) = refreshAccount()

      @Deprecated("Use onSessionEvent(Modal.Model.Event) instead. Using both will result in duplicate events.")
      override fun onSessionEvent(sessionEvent: Modal.Model.SessionEvent) = refreshAccount()

      override fun onSessionExtend(session: Modal.Model.Session) = Unit

      override fun onSessionDelete(deletedSession: Modal.Model.DeletedSession) {
        _account.value = null
      }

      override fun onSessionRequestResponse(response: Modal.Model.SessionRequestResponse) {
        val result = response.result
        val deferred = pending.remove(result.id) ?: return
        when (result) {
          is Modal.Model.JsonRpcResponse.JsonRpcResult -> deferred.complete(result.result)
          is Modal.Model.JsonRpcResponse.JsonRpcError -> deferred.completeExceptionally(WalletRequestRejected(result.message))
        }
      }

      override fun onProposalExpired(proposal: Modal.Model.ExpiredProposal) = Unit

      override fun onRequestExpired(request: Modal.Model.ExpiredRequest) {
        pending.remove(request.id)?.completeExceptionally(WalletRequestRejected("The wallet request expired."))
      }

      override fun onConnectionStateChange(state: Modal.Model.ConnectionState) = Unit

      override fun onError(error: Modal.Model.Error) {
        Log.w(TAG, "walletconnect ${error.throwable}")
      }
    }

  companion object {
    private const val TAG = "BeeGreat"

    private fun chain(name: String, id: String, rpc: String, explorer: String) =
      Modal.Model.Chain(
        chainName = name,
        chainNamespace = "eip155",
        chainReference = id,
        requiredMethods = EthUtils.ethRequiredMethods,
        optionalMethods = EthUtils.ethOptionalMethods,
        events = EthUtils.ethEvents,
        token = AppKitChainsPresets.ethToken,
        rpcUrl = rpc,
        blockExplorerUrl = explorer,
      )

    /** Same networks as `wallet-connect.ts`, Superchain plus Celo. */
    val CHAINS: List<Modal.Model.Chain> =
      listOf(
        chain("Base", "8453", "https://mainnet.base.org", "https://basescan.org"),
        chain("OP Mainnet", "10", "https://mainnet.optimism.io", "https://optimistic.etherscan.io"),
        chain("Arbitrum One", "42161", "https://arb1.arbitrum.io/rpc", "https://arbiscan.io"),
        chain("Celo", "42220", "https://forno.celo.org", "https://celoscan.io"),
        chain("Fraxtal", "252", "https://rpc.frax.com", "https://fraxscan.com"),
        chain("Ink", "57073", "https://rpc-gel.inkonchain.com", "https://explorer.inkonchain.com"),
        chain("Lisk", "1135", "https://rpc.api.lisk.com", "https://blockscout.lisk.com"),
        chain("Mode", "34443", "https://mainnet.mode.network", "https://explorer.mode.network"),
        chain("Soneium", "1868", "https://rpc.soneium.org", "https://soneium.blockscout.com"),
        chain("Superseed", "5330", "https://mainnet.superseed.xyz", "https://explorer.superseed.xyz"),
        chain("Unichain", "130", "https://mainnet.unichain.org", "https://uniscan.xyz"),
      )

    fun rpcUrl(chainId: Long): String? = CHAINS.firstOrNull { it.chainReference == chainId.toString() }?.rpcUrl
  }
}
