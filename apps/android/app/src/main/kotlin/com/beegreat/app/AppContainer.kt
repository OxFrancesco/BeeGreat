package com.beegreat.app

import android.content.Context
import android.util.Log
import androidx.compose.runtime.Composable
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.platform.LocalContext
import com.beegreat.convex.BeeConvexClient
import com.beegreat.convex.createBeeConvexClient
import com.beegreat.convex.goals.GoalsRepository
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

/**
 * Process-wide dependencies. One instance per app, built in
 * [BeeGreatApplication]. Plain constructor wiring; no DI framework yet.
 */
class AppContainer(context: Context) {
  val convex: BeeConvexClient = createBeeConvexClient(context, BuildConfig.CONVEX_URL)
  val goals: GoalsRepository by lazy { GoalsRepository(convex) }

  init {
    if (BuildConfig.DEBUG) {
      val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
      scope.launch { convex.webSocketStateFlow.collect { Log.d(TAG, "convex socket: $it") } }
      scope.launch { convex.authState.collect { Log.d(TAG, "convex auth: ${it::class.simpleName}") } }
    }
  }

  private companion object {
    const val TAG = "BeeGreat"
  }
}

val LocalAppContainer = staticCompositionLocalOf<AppContainer> { error("AppContainer not provided") }

val Context.appContainer: AppContainer
  get() = (applicationContext as BeeGreatApplication).container

@Composable
@ReadOnlyComposable
fun appContainer(): AppContainer = LocalContext.current.appContainer
