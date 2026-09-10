package com.beegreat.convex.connections

import com.beegreat.convex.BeeConvexClient
import com.beegreat.convex.ConvexLong
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable

@Serializable data class Powerup(val id: String, val name: String, val tagline: String, val description: String, val enabled: Boolean)

/** `github`, `linear`, `notion`, or `google`; `state` is disconnected/pending/connected/needs_reauth/failed. */
@Serializable
data class Beennector(
  val provider: String,
  val name: String,
  val description: String,
  val state: String,
  val accountName: String? = null,
  val workspaceName: String? = null,
  val message: String? = null,
)

@Serializable data class AuthorizationStart(val authorizationUrl: String, val sessionId: String? = null)

@Serializable
data class ChatGptStatus(
  /** loading, starting, pending, connected, needs_reauth, failed, disconnected. */
  val state: String,
  val skipped: Boolean = false,
  val sessionId: String? = null,
  val userCode: String? = null,
  val verificationUri: String? = null,
  val expiresAt: ConvexLong? = null,
  val message: String? = null,
)

@Serializable
data class TelegramStatus(val state: String, val displayName: String? = null, val username: String? = null, val photoUrl: String? = null, val message: String? = null)

@Serializable data class ImessageConnection(val address: String, val addressKind: String, val connectedAt: ConvexLong)

@Serializable data class GoogleHealthStatus(val state: String, val message: String? = null)

/** Power-ups, work connectors, and the channel links, over the same functions as the Expo profile. */
class ConnectionsRepository(private val convex: BeeConvexClient) {
  fun powerups(): Flow<Result<List<Powerup>>> = convex.subscribe("powerups:list")

  suspend fun setPowerupEnabled(id: String, enabled: Boolean) = io { convex.mutation("powerups:setEnabled", mapOf("powerupId" to id, "enabled" to enabled)) }

  fun beennectors(): Flow<Result<List<Beennector>>> = convex.subscribe("beennectors:list")

  suspend fun beginBeennector(provider: String, googleServices: List<String>?, googleDisclosureVersion: String?): AuthorizationStart =
    io {
      convex.action<AuthorizationStart>(
        "beennectorAuthActions:beginAuthorization",
        buildMap {
          put("provider", provider)
          put("client", "mobile")
          if (googleServices != null) put("googleServices", googleServices)
          if (googleDisclosureVersion != null) put("googleDisclosureVersion", googleDisclosureVersion)
        },
      )
    }

  suspend fun disconnectBeennector(provider: String) = io { convex.action("beennectorAuthActions:disconnect", mapOf("provider" to provider)) }

  suspend fun cancelBeennector(sessionId: String) = io { convex.mutation("beennectors:cancelAuthorization", mapOf("sessionId" to sessionId)) }

  fun chatgpt(): Flow<Result<ChatGptStatus>> = convex.subscribe("chatgptAuth:status")

  suspend fun startChatgpt(): String = io { convex.mutation<String>("chatgptAuth:start") }

  suspend fun disconnectChatgpt() = io { convex.mutation("chatgptAuth:disconnect") }

  suspend fun skipChatgpt() = io { convex.mutation("chatgptAuth:skip") }

  fun telegram(): Flow<Result<TelegramStatus>> = convex.subscribe("telegram:status")

  suspend fun beginTelegram(): AuthorizationStart = io { convex.action<AuthorizationStart>("telegramAuthActions:beginAuthorization", mapOf("client" to "mobile")) }

  suspend fun disconnectTelegram() = io { convex.mutation("telegram:disconnect") }

  fun imessage(): Flow<Result<List<ImessageConnection>>> = convex.subscribe("imessage:connections")

  suspend fun disconnectImessage(address: String) = io { convex.mutation("imessage:disconnect", mapOf("address" to address)) }

  fun googleHealth(): Flow<Result<GoogleHealthStatus>> = convex.subscribe("googleHealthAuth:status")

  suspend fun beginGoogleHealth(): AuthorizationStart = io { convex.action<AuthorizationStart>("googleHealthAuthActions:beginAuthorization", mapOf("client" to "mobile")) }

  suspend fun disconnectGoogleHealth() = io { convex.mutation("googleHealthAuth:disconnect") }

  private suspend inline fun <T> io(crossinline block: suspend () -> T): T = withContext(Dispatchers.IO) { block() }
}
