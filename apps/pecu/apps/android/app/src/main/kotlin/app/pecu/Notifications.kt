package app.pecu

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat

const val AutomationChannel = "automations"
private const val NotificationId = 1

/** What an automation notification shows, whether it came from FCM or a local reminder alarm. */
data class AutomationAlert(val title: String, val body: String, val tag: String, val threadId: String?, val channel: String)

fun notificationsAllowed(context: Context): Boolean =
  Build.VERSION.SDK_INT < 33 || ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED

fun ensureAutomationChannel(context: Context) {
  if (Build.VERSION.SDK_INT < 26) return
  val manager = context.getSystemService(NotificationManager::class.java)
  if (manager.getNotificationChannel(AutomationChannel) == null) {
    manager.createNotificationChannel(NotificationChannel(AutomationChannel, "Automations", NotificationManager.IMPORTANCE_HIGH).apply {
      description = "Reminders, alerts and transactions waiting for your confirmation"
    })
  }
}

/** The deep link a notification opens: a finished research report, the automation's web thread, the original conversation, or just the app for X Chat. */
fun automationLink(alert: AutomationAlert): Uri {
  alert.tag.removePrefix("research:").takeIf { alert.tag.startsWith("research:") && it.matches(Regex("[A-HJ-NP-Z2-9]{6}")) }?.let { return Uri.parse("pecu://researches?code=$it") }
  if (alert.channel != "web") return Uri.parse("pecu://agent")
  val thread = alert.threadId?.takeIf { it.matches(Regex("[a-z0-9][a-z0-9-]{0,39}")) }
  return Uri.parse(if (thread != null) "pecu://agent?t=$thread" else "pecu://agent?main=1")
}

/**
 * Shows the alert. The tag is `task:CODE:OCCURRENCE`, so a server push for an
 * occurrence replaces the local reminder that already announced it.
 */
fun showAutomationAlert(context: Context, alert: AutomationAlert) {
  if (!notificationsAllowed(context)) return
  ensureAutomationChannel(context)
  val intent = Intent(Intent.ACTION_VIEW, automationLink(alert), context, MainActivity::class.java)
    .addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP)
  val open = PendingIntent.getActivity(context, alert.tag.hashCode(), intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
  val notification = NotificationCompat.Builder(context, AutomationChannel)
    .setSmallIcon(R.drawable.pecu_avatar)
    .setContentTitle(alert.title)
    .setContentText(alert.body)
    .setStyle(NotificationCompat.BigTextStyle().bigText(alert.body))
    .setPriority(NotificationCompat.PRIORITY_HIGH)
    .setCategory(NotificationCompat.CATEGORY_REMINDER)
    .setAutoCancel(true)
    .setContentIntent(open)
    .build()
  try { NotificationManagerCompat.from(context).notify(alert.tag, NotificationId, notification) }
  catch (_: SecurityException) { }
}
