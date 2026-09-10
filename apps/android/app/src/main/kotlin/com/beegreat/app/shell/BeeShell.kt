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
import com.beegreat.design.BeeTheme
import com.beegreat.design.Hive
import kotlinx.serialization.Serializable

@Serializable object BeeTab

@Serializable object GoalsTab

@Serializable object HiveTab

@Serializable object MindTab

@Serializable data class GoalRoute(val goalId: String)

@Serializable data class ProjectRoute(val projectId: String)

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
  private val showProfile: () -> Unit,
  private val showVoice: () -> Unit,
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

  override fun openThreads() = showThreads()

  override fun openProfile() = showProfile()

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
  var profileOpen by remember { mutableStateOf(false) }
  val navigator = remember(navController) { ShellNavigator(navController, { threadsOpen = true }, { profileOpen = true }, { /* Phase 5 */ }) }

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
            onClick = { /* Phase 5 wires the mic bus. */ },
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
      NavHost(navController = navController, startDestination = BeeTab, modifier = Modifier.padding(padding)) {
        composable<BeeTab> { BeeScreen() }
        composable<GoalsTab> { GoalsScreen() }
        composable<HiveTab> { HiveScreen() }
        composable<MindTab> { PlaceholderScreen("Mind", "Bookmarks land in Phase 4.") }
        composable<GoalRoute> { entry -> GoalDetailScreen(entry.toRoute<GoalRoute>().goalId) }
        composable<ProjectRoute> { entry -> ProjectScreen(entry.toRoute<ProjectRoute>().projectId) }
      }
    }
    if (threadsOpen) ThreadsSheet(onDismiss = { threadsOpen = false })
    if (profileOpen) ProfilePlaceholderSheet(onDismiss = { profileOpen = false })
  }
}
