package com.beegreat.app

import android.content.Context
import android.util.Log
import androidx.compose.runtime.Composable
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.platform.LocalContext
import com.beegreat.app.bee.BeeAgentController
import com.beegreat.convex.BeeConvexClient
import com.beegreat.convex.bookmarks.BookmarksRepository
import com.beegreat.convex.chat.ChatRepository
import com.beegreat.convex.createBeeConvexClient
import com.beegreat.convex.devin.DevinRepository
import com.beegreat.convex.focus.FirstFocusRepository
import com.beegreat.convex.goals.GoalsRepository
import com.beegreat.convex.projects.ProjectsRepository
import com.beegreat.convex.tasks.TasksRepository
import com.beegreat.convex.user.UserRepository
import com.beegreat.convex.web3.Web3ActionsRepository
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import okhttp3.OkHttpClient

/**
 * Process-wide dependencies. One instance per app, built in
 * [BeeGreatApplication]. Plain constructor wiring; no DI framework.
 */
class AppContainer(context: Context) {
  val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
  val http: OkHttpClient = OkHttpClient()
  val convex: BeeConvexClient = createBeeConvexClient(context, BuildConfig.CONVEX_URL)
  val goals = GoalsRepository(convex)
  val projects = ProjectsRepository(convex)
  val chat = ChatRepository(convex)
  val firstFocus = FirstFocusRepository(convex)
  val tasks = TasksRepository(convex)
  val user = UserRepository(convex)
  val devin = DevinRepository(convex)
  val web3Actions = Web3ActionsRepository(convex)
  val bookmarks = BookmarksRepository(convex)

  /** A link handed to the app by the share sheet or a deep link, consumed once by the shell. */
  val pendingSharedUrl = kotlinx.coroutines.flow.MutableStateFlow<String?>(null)
  val beeAgent = BeeAgentController(chat, firstFocus, user, http, scope).also { it.start() }

  init {
    if (BuildConfig.DEBUG) {
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
