package com.beegreat.app

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.runtime.CompositionLocalProvider
import com.beegreat.contract.urlFromSharedText
import com.beegreat.design.BeeTheme

class MainActivity : ComponentActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    enableEdgeToEdge()
    handleIntent(intent)
    setContent {
      CompositionLocalProvider(LocalAppContainer provides appContainer) {
        BeeTheme { BeeGreatRoot() }
      }
    }
  }

  override fun onNewIntent(intent: Intent) {
    super.onNewIntent(intent)
    handleIntent(intent)
  }

  /** `ACTION_SEND text/plain` from the share sheet lands in Mind as a new bookmark. */
  private fun handleIntent(intent: Intent?) {
    if (intent?.action != Intent.ACTION_SEND) return
    val text = intent.getStringExtra(Intent.EXTRA_TEXT) ?: return
    urlFromSharedText(text)?.let { appContainer.pendingSharedUrl.value = it }
  }
}
