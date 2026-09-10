package com.beegreat.convex.web3

import com.beegreat.convex.BeeConvexClient
import com.beegreat.convex.ConvexLong
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable

@Serializable data class SmartWallet(val address: String, val chain: String, val supportedChains: List<String>)

@Serializable data class LinkedEoa(val address: String, val linkedAt: ConvexLong)

@Serializable data class MyWallets(val smartWallet: SmartWallet? = null, val eoa: LinkedEoa? = null)

@Serializable data class EoaLinkChallenge(val challengeId: String, val message: String, val expiresAt: ConvexLong)

@Serializable data class LinkedAddress(val address: String)

@Serializable data class Web3Prefs(val yoloEnabled: Boolean = false)

class WalletsRepository(private val convex: BeeConvexClient) {
  fun myWallets(): Flow<Result<MyWallets>> = convex.subscribe("wallets:myWallets")

  /** Short-lived message the connected wallet signs to prove it is the user's. */
  suspend fun beginEoaLink(address: String): EoaLinkChallenge = io { convex.mutation<EoaLinkChallenge>("wallets:beginEoaLink", mapOf("address" to address)) }

  suspend fun linkEoa(challengeId: String, signature: String): LinkedAddress =
    io { convex.mutation<LinkedAddress>("wallets:linkEoa", mapOf("challengeId" to challengeId, "signature" to signature)) }

  suspend fun unlinkEoa() = io { convex.mutation("wallets:unlinkEoa") }

  fun prefs(): Flow<Result<Web3Prefs>> = convex.subscribe("web3Prefs:get")

  suspend fun setYolo(enabled: Boolean) = io { convex.mutation("web3Prefs:setYolo", mapOf("enabled" to enabled)) }

  private suspend inline fun <T> io(crossinline block: suspend () -> T): T = withContext(Dispatchers.IO) { block() }
}
