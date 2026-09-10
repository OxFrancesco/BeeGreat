package com.beegreat.app

import android.content.Intent
import android.os.Bundle
import androidx.fragment.app.FragmentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.runtime.CompositionLocalProvider
import com.beegreat.contract.urlFromSharedText
import com.beegreat.design.BeeTheme

class MainActivity : FragmentActivity() {
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

  /**
   * Share-sheet text lands in Mind as a bookmark; `/tap/<id>` (NFC tag or App
   * Link) runs the tap action; `beegreat://profile|wallet` returns from an
   * OAuth or wallet hop.
   */
  private fun handleIntent(intent: Intent?) {
    when (intent?.action) {
      Intent.ACTION_SEND -> {
        val text = intent.getStringExtra(Intent.EXTRA_TEXT) ?: return
        urlFromSharedText(text)?.let { appContainer.pendingSharedUrl.value = it }
      }
      Intent.ACTION_VIEW, android.nfc.NfcAdapter.ACTION_NDEF_DISCOVERED -> {
        val uri = intent.data ?: return
        val segments = uri.pathSegments
        when {
          segments.firstOrNull() == "tap" && segments.size >= 2 -> appContainer.pendingTapPublicId.value = segments[1]
          uri.scheme == "beegreat" && uri.host == "tap" && segments.isNotEmpty() -> appContainer.pendingTapPublicId.value = segments[0]
          uri.scheme == "beegreat" && (uri.host == "profile" || uri.host == "wallet") -> appContainer.pendingDeepLink.value = uri.host
        }
      }
    }
  }
}
