package com.beegreat.app.shell

import androidx.annotation.DrawableRes
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Bookmark
import androidx.compose.material.icons.outlined.BookmarkBorder
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.unit.dp
import androidx.navigation.NavDestination.Companion.hasRoute
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.navigation.toRoute
import com.beegreat.app.R
import com.beegreat.app.bee.BeeScreen
import com.beegreat.app.bee.ThreadsSheet
import com.beegreat.app.goals.GoalDetailScreen
import com.beegreat.app.goals.GoalsScreen
import com.beegreat.app.goals.ProjectScreen
import com.beegreat.app.hive.HiveScreen
import com.beegreat.app.healthy.BeeHealthyScreen
import com.beegreat.app.healthy.JournalEntryScreen
import com.beegreat.app.LocalAppContainer
import com.beegreat.app.mind.AddBookmarkSheet
import com.beegreat.app.mind.BookmarkDetailScreen
import com.beegreat.app.mind.MindScreen
import androidx.compose.runtime.LaunchedEffect
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.beegreat.design.BeeTheme
import com.beegreat.design.Hive
import kotlinx.serialization.Serializable
import android.Manifest
import android.content.pm.PackageManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.platform.LocalContext
import androidx.core.content.ContextCompat
import com.beegreat.app.voice.VoiceConversationScreen
import com.beegreat.app.voice.VoiceMode
import com.beegreat.app.profile.ConnectionsScreen
import com.beegreat.app.profile.JobsScreen
import com.beegreat.app.profile.ProfileScreen
import com.beegreat.app.profile.PublicProfileScreen
import com.beegreat.app.web3.WalletsScreen
import com.beegreat.app.nfc.NfcActionsScreen
import com.beegreat.app.nfc.TapScreen
import kotlinx.coroutines.launch
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.ui.Alignment
import com.beegreat.app.voice.ListeningIsland
import com.beegreat.app.voice.OrbState
import com.beegreat.design.Spacing

@Serializable object BeeTab

@Serializable object GoalsTab

@Serializable object HiveTab

@Serializable object MindTab

@Serializable data class GoalRoute(val goalId: String)

@Serializable data class ProjectRoute(val projectId: String)

@Serializable data class BookmarkRoute(val bookmarkId: String)

@Serializable object BeeHealthyRoute

@Serializable data class JournalEntryRoute(val entryId: String)

@Serializable object NfcActionsRoute

@Serializable object VoiceConversationRoute

@Serializable object ProfileRoute

@Serializable object ConnectionsRoute

@Serializable object JobsRoute

@Serializable object WalletsRoute

@Serializable object PublicProfileRoute

@Serializable data class RemindersRoute(val kind: String = "reminder")

@Serializable data class TapRoute(val publicId: String)

private data class AddBookmarkRequest(val url: String?)

private data class TabSpec(val route: Any, val label: String, val icon: @Composable (selected: Boolean) -> Unit)

private fun template(@DrawableRes id: Int): @Composable (Boolean) -> Unit = {
  Icon(painterResource(id), contentDescription = null, modifier = Modifier.size(25.dp))
}

private val tabs =
  listOf(
    TabSpec(BeeTab, "Bee", template(R.drawable.tab_bee)),
    TabSpec(GoalsTab, "Goals", template(R.drawable.tab_honeycomb)),
    TabSpec(HiveTab, "Hive", template(R.drawable.tab_hive)),
    TabSpec(MindTab, "Mind") { selected ->
      Icon(if (selected) Icons.Filled.Bookmark else Icons.Outlined.BookmarkBorder, contentDescription = null)
    },
  )

private class ShellNavigator(
  private val nav: NavHostController,
  private val showThreads: () -> Unit,
  private val showVoice: () -> Unit,
  private val showAddBookmark: (String?) -> Unit,
) : Navigator {
  private fun tab(route: Any) {
    nav.navigate(route) {
      popUpTo(nav.graph.findStartDestination().id) { saveState = true }
      launchSingleTop = true
      restoreState = true
    }
  }

  override fun openBee() = tab(BeeTab)

  override fun openHive() = tab(HiveTab)

  override fun openGoals() = tab(GoalsTab)

  override fun openGoal(goalId: String) = nav.navigate(GoalRoute(goalId))

  override fun openProject(projectId: String) = nav.navigate(ProjectRoute(projectId))

  override fun openBookmark(bookmarkId: String) = nav.navigate(BookmarkRoute(bookmarkId))

  override fun openAddBookmark(url: String?) = showAddBookmark(url)

  override fun openBeeHealthy() = nav.navigate(BeeHealthyRoute)

  override fun openJournalEntry(entryId: String) = nav.navigate(JournalEntryRoute(entryId))

  override fun openNfcActions() = nav.navigate(NfcActionsRoute)

  override fun openReminders() = nav.navigate(RemindersRoute())

  override fun openThreads() = showThreads()

  override fun openProfile() = nav.navigate(ProfileRoute)

  override fun openConnections() = nav.navigate(ConnectionsRoute)

  override fun openJobs() = nav.navigate(JobsRoute)

  override fun openWallets() = nav.navigate(WalletsRoute)

  override fun openPublicProfile() = nav.navigate(PublicProfileRoute)

  override fun openVoiceConversation() = showVoice()

  override fun back() {
    nav.popBackStack()
  }
}

/**
 * Main shell: Bee, Goals, Hive, Mind, plus a Talk action that never
 * navigates. Same structure as `(tabs)/_layout.tsx`.
 */
@Composable
fun BeeShell() {
  val navController = rememberNavController()
  val backStack by navController.currentBackStackEntryAsState()
  val destination = backStack?.destination
  val colors = BeeTheme.colors
  val tint = if (colors.isDark) Hive.honey else Hive.cacao
  var threadsOpen by remember { mutableStateOf(false) }
  var addBookmark by remember { mutableStateOf<AddBookmarkRequest?>(null) }
  val navigator =
    remember(navController) {
      ShellNavigator(navController, { threadsOpen = true }, { navController.navigate(VoiceConversationRoute) }, { addBookmark = AddBookmarkRequest(it) })
    }
  val container = LocalAppContainer.current
  val scope = rememberCoroutineScope()
  val voiceMode by container.preferences.voiceMode.collectAsStateWithLifecycle()
  val micPermission = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
    if (granted) scope.launch { container.voiceNotes.toggleRecording() } else container.beeAgent.voiceError.value = "Microphone access is off. Enable it in Settings to talk to Bee."
  }
  val context = LocalContext.current
  fun onTalk() {
    if (voiceMode == VoiceMode.Conversation) {
      navController.navigate(VoiceConversationRoute)
      return
    }
    if (ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) scope.launch { container.voiceNotes.toggleRecording() }
    else micPermission.launch(Manifest.permission.RECORD_AUDIO)
  }
  val sharedUrl by container.pendingSharedUrl.collectAsStateWithLifecycle()
  LaunchedEffect(sharedUrl) {
    val url = sharedUrl ?: return@LaunchedEffect
    container.pendingSharedUrl.value = null
    addBookmark = AddBookmarkRequest(url)
  }
  val pendingTap by container.pendingTapPublicId.collectAsStateWithLifecycle()
  LaunchedEffect(pendingTap) {
    val id = pendingTap ?: return@LaunchedEffect
    container.pendingTapPublicId.value = null
    navController.navigate(TapRoute(id))
  }
  val pendingLink by container.pendingDeepLink.collectAsStateWithLifecycle()
  LaunchedEffect(pendingLink) {
    val link = pendingLink ?: return@LaunchedEffect
    container.pendingDeepLink.value = null
    when (link) {
      "profile" -> navController.navigate(ProfileRoute)
      "wallet" -> navController.navigate(WalletsRoute)
    }
  }

  CompositionLocalProvider(LocalNavigator provides navigator) {
    Scaffold(
      containerColor = colors.background,
      bottomBar = {
        NavigationBar(containerColor = colors.card) {
          tabs.forEach { tab ->
            val selected = destination?.hasRoute(tab.route::class) == true
            NavigationBarItem(
              selected = selected,
              onClick = {
                navController.navigate(tab.route) {
                  popUpTo(navController.graph.findStartDestination().id) { saveState = true }
                  launchSingleTop = true
                  restoreState = true
                }
              },
              icon = { tab.icon(selected) },
              label = { Text(tab.label) },
              colors =
                NavigationBarItemDefaults.colors(
                  selectedIconColor = tint,
                  selectedTextColor = tint,
                  indicatorColor = colors.secondary,
                  unselectedIconColor = colors.textSecondary,
                  unselectedTextColor = colors.textSecondary,
                ),
            )
          }
          // Original rendering keeps the honey microphone so Talk stands apart
          // from the navigation tabs.
          NavigationBarItem(
            selected = false,
            onClick = ::onTalk,
            icon = {
              Icon(
                painterResource(R.drawable.tab_mic_honey),
                contentDescription = "Talk to Bee",
                modifier = Modifier.size(25.dp),
                tint = Color.Unspecified,
              )
            },
            label = { Text("Talk") },
            colors = NavigationBarItemDefaults.colors(unselectedTextColor = colors.textSecondary),
          )
        }
      },
    ) { padding ->
      Box(modifier = Modifier.padding(padding).fillMaxSize()) {
        NavHost(navController = navController, startDestination = BeeTab) {
        composable<BeeTab> { BeeScreen() }
        composable<GoalsTab> { GoalsScreen() }
        composable<HiveTab> { HiveScreen() }
        composable<MindTab> { MindScreen() }
        composable<BookmarkRoute> { entry -> BookmarkDetailScreen(entry.toRoute<BookmarkRoute>().bookmarkId) }
        composable<BeeHealthyRoute> { BeeHealthyScreen() }
        composable<JournalEntryRoute> { entry -> JournalEntryScreen(entry.toRoute<JournalEntryRoute>().entryId) }
        composable<NfcActionsRoute> { NfcActionsScreen() }
        composable<RemindersRoute> { NfcActionsScreen(kind = "reminder") }
        composable<TapRoute> { entry -> TapScreen(entry.toRoute<TapRoute>().publicId) }
        composable<VoiceConversationRoute> { VoiceConversationScreen() }
        composable<ProfileRoute> { ProfileScreen() }
        composable<ConnectionsRoute> { ConnectionsScreen() }
        composable<JobsRoute> { JobsScreen() }
        composable<WalletsRoute> { WalletsScreen() }
        composable<PublicProfileRoute> { PublicProfileScreen() }
        composable<GoalRoute> { entry -> GoalDetailScreen(entry.toRoute<GoalRoute>().goalId) }
        composable<ProjectRoute> { entry -> ProjectScreen(entry.toRoute<ProjectRoute>().projectId) }
        }
        val voice by container.voiceNotes.state.collectAsStateWithLifecycle()
        val onVoiceRoute = destination?.hasRoute(VoiceConversationRoute::class) == true
        ListeningIsland(
          state = voice.orbState,
          detail = voice.activityDetail,
          visible = voice.orbState != OrbState.Idle && !onVoiceRoute,
          onClick = navigator::openBee,
          modifier = Modifier.align(Alignment.BottomCenter).padding(bottom = Spacing.two),
        )
      }
    }
    if (threadsOpen) ThreadsSheet(onDismiss = { threadsOpen = false })
    addBookmark?.let { request ->
      AddBookmarkSheet(
        initialUrl = request.url,
        onDismiss = { addBookmark = null },
        onSaved = { id ->
          addBookmark = null
          navigator.openBookmark(id)
        },
      )
    }
  }
}
