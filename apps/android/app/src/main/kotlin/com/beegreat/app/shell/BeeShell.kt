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
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.unit.dp
import androidx.navigation.NavDestination.Companion.hasRoute
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import com.beegreat.app.R
import com.beegreat.app.goals.GoalsScreen
import com.beegreat.design.BeeTheme
import com.beegreat.design.Hive
import kotlinx.serialization.Serializable

@Serializable object BeeTab

@Serializable object GoalsTab

@Serializable object HiveTab

@Serializable object MindTab

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
    // Bee is the real start tab. Goals opens first until the chat lands in Phase 2.
    NavHost(
      navController = navController,
      startDestination = GoalsTab,
      modifier = Modifier.padding(padding),
    ) {
      composable<BeeTab> { PlaceholderScreen("Bee", "Chat lands in Phase 2.") }
      composable<GoalsTab> { GoalsScreen() }
      composable<HiveTab> { PlaceholderScreen("Hive", "Economy and achievements land in Phase 3.") }
      composable<MindTab> { PlaceholderScreen("Mind", "Bookmarks land in Phase 4.") }
    }
  }
}
