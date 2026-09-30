package app.pecu

import android.content.Context
import com.clerk.api.Clerk
import com.clerk.api.network.serialization.ClerkResult
import com.google.firebase.FirebaseApp
import com.google.firebase.FirebaseOptions
import com.google.firebase.installations.FirebaseInstallations
import com.google.firebase.messaging.FirebaseMessaging
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import kotlin.coroutines.resume
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import kotlinx.coroutines.suspendCancellableCoroutine

/**
 * FCM is configured from Gradle properties instead of google-services.json,
 * so a build without a Firebase project still works and simply has no push.
 */
object Push {
  val configured: Boolean get() = BuildConfig.FIREBASE_APP_ID.isNotBlank() && BuildConfig.FIREBASE_PROJECT_ID.isNotBlank()

  fun initialize(context: Context) {
    if (!configured || FirebaseApp.getApps(context).isNotEmpty()) return
    FirebaseApp.initializeApp(context, FirebaseOptions.Builder()
      .setApplicationId(BuildConfig.FIREBASE_APP_ID)
      .setProjectId(BuildConfig.FIREBASE_PROJECT_ID)
      .setApiKey(BuildConfig.FIREBASE_API_KEY)
      .setGcmSenderId(BuildConfig.FIREBASE_SENDER_ID)
      .build())
  }

  /** Register with FCM and return this install's Firebase Installation ID, the device target Pecu stores. */
  suspend fun token(): String? {
    if (!configured) return null
    FirebaseMessaging.getInstance().register()
    return suspendCancellableCoroutine { continuation ->
      FirebaseInstallations.getInstance().id.addOnCompleteListener { task ->
        continuation.resume(if (task.isSuccessful) task.result else null)
      }
    }
  }

  fun api() = PecuApi(token = {
    when (val result = Clerk.auth.getToken()) {
      is ClerkResult.Success -> result.value
      is ClerkResult.Failure -> throw PecuException("Sign in again to reconnect to Pecu.")
    }
  })
}

/** Parse an FCM data message into the alert the app shows. Returns null for anything that is not a Pecu automation or research message. */
fun automationAlert(data: Map<String, String>): AutomationAlert? {
  val title = data["title"]?.takeIf { it.isNotBlank() } ?: return null
  val tag = data["tag"]?.takeIf { it.startsWith("task:") || it.startsWith("research:") } ?: return null
  return AutomationAlert(title, data["body"].orEmpty(), tag, data["threadId"]?.takeIf { it.isNotBlank() }, data["channel"] ?: "web")
}

class PecuMessagingService : FirebaseMessagingService() {
  private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

  override fun onMessageReceived(message: RemoteMessage) {
    automationAlert(message.data)?.let { showAutomationAlert(this, it) }
  }

  /** FCM calls this at first registration and whenever the installation ID changes. */
  override fun onRegistered(installationId: String) {
    if (Clerk.session == null) return
    scope.launch { runCatching { Push.api().registerPush(installationId) } }
  }
}
