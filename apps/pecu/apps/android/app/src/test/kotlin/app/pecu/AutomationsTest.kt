package app.pecu

import android.app.AlarmManager
import android.app.Application
import android.app.NotificationManager
import android.graphics.Bitmap
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.test.core.app.ApplicationProvider
import java.io.File
import kotlinx.serialization.Serializable
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode

@Serializable private data class AutomationFixture(val tasks: AutomationList, val notifications: NotificationList)

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [36], application = Application::class, qualifiers = "w412dp-h915dp-xhdpi")
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class AutomationsTest {
  @get:Rule val compose = createComposeRule()
  private val fixture = wireJson.decodeFromString<AutomationFixture>(javaClass.getResource("/automations.json")!!.readText())
  private val context: Application get() = ApplicationProvider.getApplicationContext()

  @Test fun `shared fixture decodes and only fixed-time reminders are armed locally`() {
    val tasks = fixture.tasks.tasks
    assertEquals(listOf("calendar", "interval", "price"), tasks.map { it.triggerKind })
    assertEquals("requested", tasks.first().grant!!.state)
    assertEquals(1, fixture.notifications.unread)
    val reminders = localReminders(tasks, 1_000)
    assertEquals(listOf("DEF567"), reminders.map { it.code })
    assertEquals("task:DEF567:1900000000000", reminders.single().tag)
    assertTrue(localReminders(tasks, 1_900_000_000_000).isEmpty())
  }

  @Test fun `allowance and schedule lines match the web wording`() {
    val index = fixture.tasks.tasks.first()
    assertEquals("Asks to execute trades up to $25 per run.", allowanceText(index))
    assertEquals("Allowance expired. Transactions wait for your confirmation.", allowanceText(index.copy(grant = index.grant!!.copy(state = "approved", active = false))))
    assertTrue(allowanceText(index.copy(yolo = false, grant = index.grant.copy(state = "approved", active = true, expiresAt = 1_900_000_000_000)))!!.endsWith("YOLO is off in its chat, so each transaction still asks."))
    assertEquals("Heartbeat · Paused", automationMeta(index.copy(mode = "heartbeat", state = "paused")))
    assertEquals("Reminder · When AERO is at or below $1", automationMeta(fixture.tasks.tasks[2]))
  }

  @Test fun `push data becomes a tagged alert that opens the right thread`() {
    val alert = automationAlert(mapOf("title" to "Buy NVDA: confirm the transaction", "body" to "YOLO is off.", "tag" to "task:ABC234:5", "threadId" to "index01", "channel" to "web"))!!
    assertEquals("pecu://agent?t=index01", automationLink(alert).toString())
    assertEquals("pecu://agent?main=1", automationLink(alert.copy(threadId = null)).toString())
    assertEquals("pecu://agent", automationLink(alert.copy(channel = "x")).toString())
    assertNull(automationAlert(mapOf("title" to "Hi", "tag" to "other")))
    shadowOf(context).grantPermissions(android.Manifest.permission.POST_NOTIFICATIONS)
    showAutomationAlert(context, alert)
    showAutomationAlert(context, alert.copy(body = "Replaced"))
    val posted = shadowOf(context.getSystemService(NotificationManager::class.java)).allNotifications
    assertEquals(1, posted.size)
    assertEquals("Replaced", posted.single().extras.getString("android.text"))
  }

  @Test fun `reminder alarms replace the previous set and clear on sign out`() {
    val alarms = shadowOf(context.getSystemService(AlarmManager::class.java))
    val reminder = LocalReminder("DEF567", "Check AERO", "Check AERO and decide", System.currentTimeMillis() + 60_000, null, "web")
    ReminderAlarms.schedule(context, listOf(reminder, reminder.copy(code = "XYZ789")))
    assertEquals(2, alarms.scheduledAlarms.size)
    ReminderAlarms.schedule(context, listOf(reminder))
    assertEquals(1, alarms.scheduledAlarms.size)
    assertEquals(reminder.at, alarms.nextScheduledAlarm!!.triggerAtTime)
    ReminderAlarms.schedule(context, emptyList())
    assertTrue(alarms.scheduledAlarms.isEmpty())
  }

  @Test fun `sheet lists automations and approves the edited limit`() {
    val actions = mutableListOf<Triple<String, String, Double?>>()
    compose.setContent { PecuTheme { Surface(Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
      AutomationsContent(AutomationsUi(tasks = fixture.tasks.tasks, alerts = fixture.notifications.notifications), notificationsOn = false, onAllowNotifications = {}, onAct = { code, kind, usd, _, _ -> actions += Triple(code, kind, usd) }, onOpenThread = {})
    } } }
    compose.onNodeWithText("Weekly index rebalance").assertIsDisplayed()
    compose.onNodeWithText("Asks to execute trades up to $25 per run.").assertIsDisplayed()
    compose.onNodeWithText("Allow notifications to hear about reminders and trades waiting for you.").assertIsDisplayed()
    save("automations-sheet")
    compose.onNodeWithText("25").performTextReplacement("40")
    compose.onNodeWithText("Approve").performScrollTo().performClick()
    assertEquals(Triple("ABC234", "allow", 40.0), actions.single())
    compose.onAllNodesWithText("Delete")[0].performScrollTo().performClick()
    compose.onNodeWithText("Delete Weekly index rebalance?").assertIsDisplayed()
    compose.onNodeWithText("Keep").performClick()
    assertEquals(1, actions.size)
  }

  @Test fun `missing allowance exposes explicit scopes and preserves approval state`() {
    val original = fixture.tasks.tasks.first().copy(grant = null, run = AutomationRun("awaiting_approval", "Fees and conversion remain.", listOf(AutomationStep("Claim emissions", "pending"))))
    var submitted: List<String>? = null
    compose.setContent { PecuTheme { Surface(Modifier.fillMaxSize()) {
      AutomationsContent(AutomationsUi(tasks = listOf(original)), true, {}, { _, _, _, scopes, _ -> submitted = scopes }, {})
    } } }
    compose.onNodeWithText("Waiting for approval").assertIsDisplayed()
    compose.onNodeWithText("Approve").performScrollTo().assertIsNotEnabled()
    compose.onAllNodes(isToggleable())[0].performScrollTo().performClick()
    compose.onAllNodes(isToggleable())[1].performScrollTo().performClick()
    compose.onNodeWithText("USD per run").performScrollTo().performTextInput("25")
    save("automation-missing-allowance")
    compose.onNodeWithText("Approve").performScrollTo().performClick()
    assertEquals(listOf("liquidity", "trade"), submitted)
  }

  @Test fun `an automation message shows its title instead of a user bubble`() {
    val state = wireJson.decodeFromString<AccountState>(javaClass.getResource("/state.json")!!.readText())
    assertEquals("run", state.messages[2].origin!!.mode)
  }

  private fun save(name: String) {
    val image = compose.onRoot().captureToImage().asAndroidBitmap()
    File("build/outputs/screenshots/$name.png").apply { parentFile!!.mkdirs() }.outputStream().use { image.compress(Bitmap.CompressFormat.PNG, 100, it) }
  }
}
