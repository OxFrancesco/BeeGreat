package com.beegreat.app.voice

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import com.beegreat.app.MainActivity
import com.beegreat.app.R

/**
 * Android's stand-in for the iOS Live Activity: while Bee is listening,
 * thinking, or speaking, a foreground-service notification keeps the mic and
 * playback alive off-screen and shows the state. Idle stops the service.
 */
class VoiceSessionService : Service() {
  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    val label = intent?.getStringExtra(EXTRA_LABEL) ?: "Bee is listening"
    val detail = intent?.getStringExtra(EXTRA_DETAIL)
    val notification = buildNotification(this, label, detail)
    val type = ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE or ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) startForeground(NOTIFICATION_ID, notification, type) else startForeground(NOTIFICATION_ID, notification)
    return START_NOT_STICKY
  }

  companion object {
    private const val CHANNEL_ID = "bee.voice"
    private const val NOTIFICATION_ID = 41
    private const val EXTRA_LABEL = "label"
    private const val EXTRA_DETAIL = "detail"

    fun update(context: Context, state: OrbState, detail: String?) {
      if (state == OrbState.Idle) {
        context.stopService(Intent(context, VoiceSessionService::class.java))
        return
      }
      ensureChannel(context)
      val label = when (state) {
        OrbState.Listening -> "Bee is listening"
        OrbState.Thinking -> "Bee is thinking"
        OrbState.Speaking -> "Bee is speaking"
        OrbState.Idle -> ""
      }
      val intent = Intent(context, VoiceSessionService::class.java).putExtra(EXTRA_LABEL, label).putExtra(EXTRA_DETAIL, detail)
      runCatching { context.startForegroundService(intent) }
    }

    private fun ensureChannel(context: Context) {
      val manager = context.getSystemService(NotificationManager::class.java)
      if (manager.getNotificationChannel(CHANNEL_ID) == null) {
        manager.createNotificationChannel(NotificationChannel(CHANNEL_ID, "Voice session", NotificationManager.IMPORTANCE_LOW).apply { description = "Shows when Bee is listening or speaking." })
      }
    }

    private fun buildNotification(context: Context, label: String, detail: String?): Notification {
      val open = PendingIntent.getActivity(context, 0, Intent(context, MainActivity::class.java), PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
      return Notification.Builder(context, CHANNEL_ID)
        .setSmallIcon(R.drawable.tab_bee)
        .setContentTitle(label)
        .setContentText(detail ?: "Tap to return to Bee")
        .setContentIntent(open)
        .setOngoing(true)
        .setCategory(Notification.CATEGORY_SERVICE)
        .build()
    }
  }
}
