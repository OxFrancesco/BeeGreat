package app.pecu

import com.clerk.api.network.model.environment.UserSettings
import com.clerk.api.sso.OAuthProvider

enum class LoginProvider(val label: String, val strategy: String) {
  Google("Google", "oauth_google"),
  X("X", "oauth_x");

  fun resolve(providers: Collection<UserSettings.SocialConfig>): OAuthProvider? =
    providers.firstOrNull { it.strategy == strategy && it.enabled && it.authenticatable && !it.notSelectable }
      ?.let { OAuthProvider.fromStrategy(it.strategy) }
}

fun loginError(provider: LoginProvider, codes: List<String>, offline: Boolean = false): String = when {
  offline -> "Check your connection, then try again."
  codes.any { it.contains("rate_limit") || it == "too_many_requests" } -> "Too many attempts. Wait a moment, then try again."
  codes.any { it.contains("cancel") || it == "access_denied" } -> "Sign-in was cancelled. You can try again."
  codes.any { it.contains("strategy") || it == "form_param_value_invalid" } -> "${provider.label} sign-in is unavailable. Try again or use another account option."
  else -> "Could not finish signing in with ${provider.label}. Try again."
}
