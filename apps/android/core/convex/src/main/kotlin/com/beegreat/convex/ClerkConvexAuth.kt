package com.beegreat.convex

import android.content.Context
import com.clerk.api.Clerk
import com.clerk.api.network.serialization.ClerkResult
import com.clerk.api.session.GetTokenOptions
import com.clerk.api.session.Session
import com.clerk.api.session.Session.SessionStatus
import dev.convex.android.AuthProvider
import dev.convex.android.ConvexClientWithAuth
import java.lang.ref.WeakReference
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

/** Name of the Clerk JWT template the Convex backend trusts (`applicationID: 'convex'`). */
const val CONVEX_JWT_TEMPLATE = "convex"

/**
 * Bridges Clerk sessions into [ConvexClientWithAuth].
 *
 * `clerk-convex-kotlin` does the same job but asks Clerk for the default
 * session token. This backend, like `ConvexProviderWithClerk` on web and Expo,
 * validates the `convex` JWT template, and the default token fails that check,
 * so Convex closes the socket on every connect. This provider asks for the
 * template explicitly.
 */
class ClerkConvexAuthProvider(private val template: String = CONVEX_JWT_TEMPLATE) : AuthProvider<String> {
  private var client: WeakReference<ConvexClientWithAuth<String>>? = null
  private var onIdToken: ((String?) -> Unit)? = null
  private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)

  fun createClient(deploymentUrl: String, context: Context): ConvexClientWithAuth<String> {
    val created = ConvexClientWithAuth(deploymentUrl, this)
    client = WeakReference(created)
    scope.launch {
      var previous: Session? = null
      Clerk.sessionFlow.collect { next ->
        when {
          shouldLogin(previous, next) -> created.loginFromCache()
          shouldLogout(previous, next) -> {
            onIdToken?.invoke(null)
            onIdToken = null
            created.logout(context.applicationContext)
          }
        }
        previous = next
      }
    }
    return created
  }

  override suspend fun login(context: Context, onIdToken: (String?) -> Unit): Result<String> {
    this.onIdToken = onIdToken
    return fetchToken()
  }

  override suspend fun loginFromCache(onIdToken: (String?) -> Unit): Result<String> {
    this.onIdToken = onIdToken
    return fetchToken()
  }

  override suspend fun logout(context: Context): Result<Void?> {
    onIdToken = null
    if (Clerk.activeSession != null) {
      when (val result = Clerk.auth.signOut()) {
        is ClerkResult.Failure -> return Result.failure(result.throwable ?: Exception("Sign out failed"))
        is ClerkResult.Success -> Unit
      }
    }
    return Result.success(null)
  }

  override fun extractIdToken(authResult: String): String = authResult

  private suspend fun fetchToken(): Result<String> =
    when {
      !Clerk.isInitialized.value -> Result.failure(IllegalStateException("Clerk is not initialized"))
      Clerk.activeSession == null -> Result.failure(IllegalStateException("No active Clerk session"))
      else ->
        when (val result = Clerk.auth.getToken(GetTokenOptions(template = template))) {
          is ClerkResult.Success -> Result.success(result.value)
          is ClerkResult.Failure ->
            Result.failure(result.throwable ?: Exception("Clerk token for template '$template' failed"))
        }
    }

  private companion object {
    fun shouldLogin(old: Session?, new: Session?) =
      new?.status == SessionStatus.ACTIVE && (old?.status != SessionStatus.ACTIVE || old.id != new.id)

    fun shouldLogout(old: Session?, new: Session?) = old?.id != null && new == null
  }
}
