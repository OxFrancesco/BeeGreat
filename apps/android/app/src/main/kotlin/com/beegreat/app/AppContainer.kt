package com.beegreat.app

import android.content.Context
import androidx.compose.runtime.Composable
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.platform.LocalContext
import com.beegreat.convex.BeeConvexClient
import com.beegreat.convex.createBeeConvexClient
import com.beegreat.convex.goals.GoalsRepository

/**
 * Process-wide dependencies. One instance per app, built in
 * [BeeGreatApplication]. Plain constructor wiring; no DI framework yet.
 */
class AppContainer(context: Context) {
  val convex: BeeConvexClient = createBeeConvexClient(context, BuildConfig.CONVEX_URL)
  val goals: GoalsRepository by lazy { GoalsRepository(convex) }
}

val LocalAppContainer = staticCompositionLocalOf<AppContainer> { error("AppContainer not provided") }

val Context.appContainer: AppContainer
  get() = (applicationContext as BeeGreatApplication).container

@Composable
@ReadOnlyComposable
fun appContainer(): AppContainer = LocalContext.current.appContainer
