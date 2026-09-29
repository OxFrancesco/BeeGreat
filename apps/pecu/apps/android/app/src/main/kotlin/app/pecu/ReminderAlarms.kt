package app.pecu

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString

/** A reminder the phone announces itself at its exact time, even if the push arrives late or not at all. */
@Serializable data class LocalReminder(val code: String, val title: String, val body: String, val at: Long, val threadId: String? = null, val channel: String) {
  val tag: String get() = "task:$code:$at"
}

/** Only remind-mode automations with a known next time can be announced locally; everything else needs the server's result. */
fun localReminders(tasks: List<Automation>, now: Long): List<LocalReminder> = tasks
  .filter { it.mode == "remind" && it.state == "active" && it.triggerKind != "price" && (it.nextRunAt ?: 0) > now }
  .map { LocalReminder(it.code, it.title, it.instruction, it.nextRunAt!!, it.threadId, it.channel) }

object ReminderAlarms {
  private const val Prefs = "pecu-reminders"
  private const val Key = "scheduled"

  /** Replace every scheduled reminder with this set. Signing out passes an empty list. */
  fun schedule(context: Context, reminders: List<LocalReminder>) {
    val prefs = context.getSharedPreferences(Prefs, Context.MODE_PRIVATE)
    val alarms = context.getSystemService(AlarmManager::class.java)
    val previous = prefs.getString(Key, null)?.let { runCatching { wireJson.decodeFromString<List<LocalReminder>>(it) }.getOrNull() }.orEmpty()
    previous.forEach { alarms.cancel(pending(context, it)) }
    reminders.forEach { reminder ->
      val operation = pending(context, reminder)
      if (Build.VERSION.SDK_INT < 31 || alarms.canScheduleExactAlarms()) alarms.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, reminder.at, operation)
      else alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, reminder.at, operation)
    }
    prefs.edit().putString(Key, wireJson.encodeToString(reminders)).apply()
  }

  fun restore(context: Context) {
    val stored = context.getSharedPreferences(Prefs, Context.MODE_PRIVATE).getString(Key, null) ?: return
    val reminders = runCatching { wireJson.decodeFromString<List<LocalReminder>>(stored) }.getOrNull() ?: return
    schedule(context, reminders.filter { it.at > System.currentTimeMillis() })
  }

  private fun pending(context: Context, reminder: LocalReminder): PendingIntent {
    val intent = Intent(context, ReminderReceiver::class.java).setAction("app.pecu.REMINDER").putExtra("reminder", wireJson.encodeToString(reminder))
    return PendingIntent.getBroadcast(context, reminder.code.hashCode(), intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
  }
}

class ReminderReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val reminder = intent.getStringExtra("reminder")?.let { runCatching { wireJson.decodeFromString<LocalReminder>(it) }.getOrNull() } ?: return
    showAutomationAlert(context, AutomationAlert(reminder.title, reminder.body, reminder.tag, reminder.threadId, reminder.channel))
  }
}

class BootReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action == Intent.ACTION_BOOT_COMPLETED || intent.action == Intent.ACTION_MY_PACKAGE_REPLACED) ReminderAlarms.restore(context)
  }
}
