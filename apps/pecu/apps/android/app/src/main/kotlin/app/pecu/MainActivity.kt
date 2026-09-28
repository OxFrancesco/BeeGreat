package app.pecu

import android.app.Application
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.viewModels
import com.clerk.api.Clerk
import androidx.lifecycle.createSavedStateHandle
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import java.io.File

class PecuApplication : Application() {
  override fun onCreate() { super.onCreate(); Clerk.initialize(this, BuildConfig.CLERK_PUBLISHABLE_KEY) }
}

class MainActivity : ComponentActivity() {
  private val model: PecuViewModel by viewModels {
    viewModelFactory { initializer { PecuViewModel(createSavedStateHandle(), HistoryDisk(File(application.noBackupFilesDir, "history"))) } }
  }
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    enableEdgeToEdge()
    intent.data?.takeIf { it.scheme == "pecu" && it.host == "agent" }?.getQueryParameter("t")
      ?.takeIf { it.matches(Regex("[a-z0-9][a-z0-9-]{0,39}")) }?.let(model::selectThread)
    setContent { PecuTheme { PecuApp(model) } }
  }
}
