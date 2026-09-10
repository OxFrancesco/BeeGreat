package com.beegreat.app

import androidx.compose.animation.Crossfade
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.beegreat.app.auth.AppAuthState
import com.beegreat.app.auth.AuthViewModel
import com.beegreat.app.auth.SignInScreen
import com.beegreat.app.shell.BeeShell
import com.beegreat.design.BeeTheme
import com.beegreat.design.Hive

/**
 * Auth gate. Mirrors `Stack.Protected` in the Expo `_layout.tsx`: signed-out
 * users only ever see sign-in, signed-in users get the tab shell.
 */
@Composable
fun BeeGreatRoot() {
  val container = LocalAppContainer.current
  val authViewModel: AuthViewModel = viewModel { AuthViewModel(container.convex) }
  val authState by authViewModel.state.collectAsStateWithLifecycle()

  Crossfade(targetState = authState, label = "authGate") { state ->
    when (state) {
      AppAuthState.Loading ->
        Box(
          modifier = Modifier.fillMaxSize().background(Hive.cream),
          contentAlignment = Alignment.Center,
        ) {
          CircularProgressIndicator(color = BeeTheme.colors.primary)
        }
      AppAuthState.SignedOut -> SignInScreen(onSignInWithGoogle = authViewModel::signInWithGoogle)
      AppAuthState.SignedIn -> BeeShell()
    }
  }
}
