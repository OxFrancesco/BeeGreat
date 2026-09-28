package app.pecu

import com.clerk.api.network.model.environment.UserSettings
import org.junit.Assert.*
import org.junit.Test

class LoginProviderTest {
  private val providers = wireJson.decodeFromString<Map<String, UserSettings.SocialConfig>>(
    javaClass.getResource("/login-providers.json")!!.readText(),
  ).values

  @Test fun xUsesTheEnabledV2StrategyThroughTheInstalledClerkSdk() {
    assertEquals("oauth_x", LoginProvider.X.resolve(providers)?.strategy)
    assertFalse(providers.first { it.strategy == "oauth_twitter" }.enabled)
    assertEquals("oauth_google", LoginProvider.Google.resolve(providers)?.strategy)
  }

  @Test fun unavailableOrLinkOnlyProvidersCannotStartSignIn() {
    assertNull(LoginProvider.X.resolve(providers.map { it.copy(enabled = false) }))
    assertNull(LoginProvider.X.resolve(providers.map { it.copy(authenticatable = false) }))
    assertNull(LoginProvider.X.resolve(providers.map { it.copy(notSelectable = true) }))
    assertNull(LoginProvider.X.resolve(providers.filter { it.strategy != "oauth_x" }))
  }

  @Test fun providerFailuresHaveActionableCopyWithoutWireIdentifiers() {
    assertFalse(loginError(LoginProvider.X, listOf("form_param_value_invalid")).contains("oauth_"))
    assertTrue(loginError(LoginProvider.X, emptyList(), offline = true).contains("connection"))
    assertTrue(loginError(LoginProvider.Google, listOf("too_many_requests")).contains("Wait"))
  }
}
