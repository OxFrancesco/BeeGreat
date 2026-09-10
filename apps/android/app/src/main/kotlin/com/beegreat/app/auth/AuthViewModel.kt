package com.beegreat.app.auth

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.beegreat.convex.BeeConvexClient
import com.clerk.api.Clerk
import com.clerk.api.network.serialization.errorMessage
import com.clerk.api.network.serialization.onFailure
import com.clerk.api.session.Session.SessionStatus
import com.clerk.api.sso.OAuthProvider
import dev.convex.android.AuthState
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.transformLatest
import kotlinx.coroutines.launch

enum class AppAuthState {
  Loading,
  SignedOut,
  SignedIn,
}

/**
 * Signed in means Convex has a Clerk token, not just that Clerk has a session.
 * Queries would otherwise run unauthenticated for a moment and return empty.
 */
class AuthViewModel(private val convex: BeeConvexClient) : ViewModel() {
  private val _error = MutableStateFlow<String?>(null)
  val error: StateFlow<String?> = _error.asStateFlow()

  private val _pending = MutableStateFlow(false)
  val pending: StateFlow<Boolean> = _pending.asStateFlow()

  @OptIn(ExperimentalCoroutinesApi::class)
  val state: StateFlow<AppAuthState> =
    combine(convex.authState, Clerk.isInitialized, Clerk.sessionFlow) { convexAuth, initialized, session ->
        when (convexAuth) {
          is AuthState.Authenticated -> AppAuthState.SignedIn
          is AuthState.AuthLoading -> AppAuthState.Loading
          is AuthState.Unauthenticated ->
            when {
              !initialized -> AppAuthState.Loading
              session?.status == SessionStatus.ACTIVE -> AppAuthState.Loading
              else -> AppAuthState.SignedOut
            }
        }
      }
      .transformLatest { state ->
        // Clerk clears its session a beat before Convex reports authenticated
        // on cold start. Hold signed-out briefly so the gate does not flash.
        if (state == AppAuthState.SignedOut) delay(SIGNED_OUT_SETTLE_MS)
        emit(state)
      }
      .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), AppAuthState.Loading)

  fun signInWithGoogle() {
    if (_pending.value) return
    _pending.value = true
    _error.value = null
    viewModelScope.launch {
      Clerk.auth.signInWithOAuth(OAuthProvider.GOOGLE).onFailure {
        _error.value = it.errorMessage.ifBlank { "Google sign-in did not complete. Try again." }
      }
      _pending.value = false
    }
  }

  fun signOut() {
    viewModelScope.launch { Clerk.auth.signOut() }
  }

  private companion object {
    const val SIGNED_OUT_SETTLE_MS = 250L
  }
}
