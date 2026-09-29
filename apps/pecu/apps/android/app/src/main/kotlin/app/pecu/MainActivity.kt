package app.pecu

import android.app.Application
import android.content.Intent
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
  override fun onCreate() {
    super.onCreate()
    Clerk.initialize(this, BuildConfig.CLERK_PUBLISHABLE_KEY)
    Push.initialize(this)
  }
}

class MainActivity : ComponentActivity() {
  private val model: PecuViewModel by viewModels {
    viewModelFactory { initializer { PecuViewModel(createSavedStateHandle(), HistoryDisk(File(application.noBackupFilesDir, "history")), device = AndroidDevice(application)) } }
  }
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    enableEdgeToEdge()
    open(intent)
    setContent { PecuTheme { PecuApp(model) } }
  }
  override fun onNewIntent(intent: Intent) {
    super.onNewIntent(intent)
    open(intent)
  }
  /** Deep links from notifications and the web: `pecu://agent?t=THREAD` opens that thread. */
  private fun open(intent: Intent) {
    val link = intent.data?.takeIf { it.scheme == "pecu" && it.host == "agent" } ?: return
    val thread = link.getQueryParameter("t")?.takeIf { it.matches(Regex("[a-z0-9][a-z0-9-]{0,39}")) }
    if (thread != null || link.getQueryParameter("main") == "1") model.selectThread(thread)
  }
}

private class AndroidDevice(private val context: Application) : DeviceHooks {
  override suspend fun pushToken(): String? = Push.token()
  override fun scheduleReminders(reminders: List<LocalReminder>) = ReminderAlarms.schedule(context, reminders)
}
