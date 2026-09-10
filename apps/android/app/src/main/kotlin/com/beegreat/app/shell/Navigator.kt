package com.beegreat.app.shell

import androidx.compose.runtime.staticCompositionLocalOf

/**
 * The few cross-screen jumps cards and sheets need. Screens do not hold a
 * NavController; the shell implements this once.
 */
interface Navigator {
  fun openBee()

  fun openHive()

  fun openGoals()

  fun openGoal(goalId: String)

  fun openProject(projectId: String)

  fun openBookmark(bookmarkId: String)

  fun openAddBookmark(url: String?)

  fun openThreads()

  fun openProfile()

  fun openVoiceConversation()

  fun back()
}

val LocalNavigator = staticCompositionLocalOf<Navigator> { error("Navigator not provided") }
