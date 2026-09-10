package com.beegreat.app

import android.app.Application
import com.clerk.api.Clerk
import io.sentry.android.core.SentryAndroid

class BeeGreatApplication : Application() {
  lateinit var container: AppContainer
    private set

  override fun onCreate() {
    super.onCreate()
    if (BuildConfig.SENTRY_DSN.isNotBlank()) {
      SentryAndroid.init(this) { options ->
        options.dsn = BuildConfig.SENTRY_DSN
        options.environment = if (BuildConfig.DEBUG) "development" else "production"
        options.release = "com.beegreat.app@${BuildConfig.VERSION_NAME}+${BuildConfig.VERSION_CODE}"
        // Same posture as the Expo app: crashes and handled failures, no PII.
        options.isSendDefaultPii = false
        options.tracesSampleRate = 0.0
      }
    }
    Clerk.initialize(this, BuildConfig.CLERK_PUBLISHABLE_KEY)
    container = AppContainer(this)
  }
}
