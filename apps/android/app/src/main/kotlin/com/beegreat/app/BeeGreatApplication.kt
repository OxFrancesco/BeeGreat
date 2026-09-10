package com.beegreat.app

import android.app.Application
import com.clerk.api.Clerk

class BeeGreatApplication : Application() {
  lateinit var container: AppContainer
    private set

  override fun onCreate() {
    super.onCreate()
    Clerk.initialize(this, BuildConfig.CLERK_PUBLISHABLE_KEY)
    container = AppContainer(this)
  }
}
