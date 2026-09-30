package app.pecu

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject

val wireJson = Json { ignoreUnknownKeys = true; explicitNulls = false }

@Serializable data class Cursor(val at: Long, val row: Long)
@Serializable data class ThreadCursor(val at: Long, val id: String? = null)
@Serializable data class Thread(val id: String? = null, val title: String, val createdAt: Long, val updatedAt: Long, val count: Int)
@Serializable data class ThreadPage(val threads: List<Thread>, val olderCursor: ThreadCursor? = null, val newerCursor: ThreadCursor? = null)
@Serializable data class MessagePage(val messages: List<Message>, val olderCursor: Cursor? = null, val newerCursor: Cursor? = null)
@Serializable data class AccountState(
  val wallet: String? = null, val senderKind: String? = null, val yolo: Boolean = false,
  val signer: String? = null, val threadId: String? = null, val thread: Thread? = null,
  val messages: List<Message> = emptyList(), val olderCursor: Cursor? = null, val newerCursor: Cursor? = null,
)
@Serializable data class Message(val id: String, val text: String, val createdAt: Long, val canRetry: Boolean = false, val reply: Reply? = null, val origin: MessageOrigin? = null)
/** Set when an automation wrote the message; `text` is then its title, not something the user typed. */
@Serializable data class MessageOrigin(val kind: String, val code: String, val title: String, val mode: String)
@Serializable data class Grant(
  val scopes: List<String>, val maxUsdPerRun: Double, val days: Int, val state: String,
  val approvedAt: Long? = null, val expiresAt: Long? = null, val active: Boolean = false,
)
@Serializable data class Automation(
  val code: String, val title: String, val mode: String, val instruction: String, val trigger: JsonObject, val schedule: String,
  val state: String, val nextRunAt: Long? = null, val lastRunAt: Long? = null, val lastOutcome: String? = null, val runCount: Int = 0,
  val channel: String, val threadId: String? = null, val grant: Grant? = null, val yolo: Boolean = false, val createdAt: Long,
) {
  val triggerKind: String get() = (trigger["kind"] as? kotlinx.serialization.json.JsonPrimitive)?.content.orEmpty()
}
@Serializable data class AutomationList(val tasks: List<Automation>)
@Serializable data class AutomationActionResult(val task: Automation, val message: String)
@Serializable data class PecuNotification(
  val id: String, val kind: String, val title: String, val body: String, val taskCode: String? = null,
  val channel: String, val threadId: String? = null, val createdAt: Long, val readAt: Long? = null,
)
@Serializable data class NotificationList(val notifications: List<PecuNotification>, val unread: Int)
@Serializable data class ResearchChain(val id: String, val name: String)
@Serializable data class ResearchPeriod(val start: String, val end: String)
@Serializable data class ResearchStage(val role: String, val label: String, val state: String, val startedAt: Long? = null, val endedAt: Long? = null, val calls: Int = 0, val summary: String? = null, val error: String? = null)
@Serializable data class Research(
  val code: String, val chain: ResearchChain, val window: String, val period: ResearchPeriod? = null, val state: String,
  val headline: String? = null, val error: String? = null, val stages: List<ResearchStage> = emptyList(),
  val channel: String, val threadId: String? = null, val createdAt: Long, val completedAt: Long? = null,
  /** Present only on the detail read. */
  val markdown: String? = null,
) {
  val active: Boolean get() = state in setOf("queued", "collecting", "researching", "synthesizing")
}
@Serializable data class ResearchLimit(val used: Int, val daily: Int)
@Serializable data class ResearchList(val researches: List<Research>, val chains: List<ResearchChain>, val limit: ResearchLimit)
@Serializable data class ResearchActionResult(val research: Research? = null, val message: String)
@Serializable data class Reply(
  val text: String, val preview: Preview? = null, val question: Question? = null,
  val positions: PositionSnapshot? = null, val positionsOnly: Boolean = false,
  val holdings: Holdings? = null, val holdingsOnly: Boolean = false,
  val analytics: List<Analytics> = emptyList(), val analyticsOnly: Boolean = false, val recovery: String? = null,
)
@Serializable data class Question(val question: String, val options: List<String>)
@Serializable data class Preview(
  val code: String, val title: String? = null, val text: String, val state: String,
  val result: String? = null, val expiresAt: Long, val plan: Plan? = null, val signer: String? = null,
) {
  fun canConfirm(now: Long) = signer == null && ((state == "pending" && expiresAt > now) || state == "executing")
}
@Serializable data class Plan(val steps: List<PlanStep>, val route: PlanRoute? = null)
@Serializable data class PlanStep(val kind: String, val title: String, val contract: String, val contractName: String? = null, val value: String? = null, val status: String? = null, val hash: String? = null)
@Serializable data class PlanRoute(val nodes: List<PlanNode>, val edges: List<PlanEdge>)
@Serializable data class PlanNode(val id: String, val kind: String, val label: String, val detail: String? = null)
@Serializable data class PlanEdge(val from: String, val to: String, val step: Int, val label: String? = null)
@Serializable data class Stage(val id: String, val label: String, val startedAt: Long, val endedAt: Long? = null, val status: String)
@Serializable data class TurnRequest(val requestId: String, val text: String, val threadId: String? = null, val retryOf: String? = null, val answerTo: String? = null, val reviewWallet: String? = null, val steerOf: String? = null)
@Serializable data class StreamEvent(val type: String, val eventId: String? = null, val text: String? = null, val replace: Boolean = false, val status: String? = null, val error: String? = null, val stage: Stage? = null)
@Serializable data class Holdings(val stocks: List<Stock>, val observedAt: Long)
@Serializable data class Stock(val symbol: String, val name: String, val address: String, val price_usdc: String? = null, val balance: String? = null, val error: String? = null)
@Serializable data class Analytics(val snapshot: JsonObject, val text: String)
@Serializable data class Balance(val reference: String, val symbol: String, val address: String? = null, val amount: String? = null, val error: String? = null)
@Serializable data class Portfolio(val wallet: String? = null, val balances: List<Balance> = emptyList(), val positions: PositionSnapshot? = null, val positionsOnly: Boolean = false,
  val holdings: Holdings? = null, val stocksError: String? = null)
@Serializable data class Inference(
  val model: String, val reasoning: String, val connected: Boolean, val checkedAt: Long,
  val loginState: String? = null, val login: Login? = null,
)
@Serializable data class Login(val url: String, val instructions: String, val userCode: String? = null)

fun shortAddress(value: String) = if (value.length > 16) "${value.take(6)}…${value.takeLast(4)}" else value
fun mergeMessages(old: List<Message>, new: List<Message>): List<Message> =
  (old + new).associateBy { it.id }.values.sortedWith(compareBy(Message::createdAt, Message::id))

class StreamReducer {
  var eventId: String? = null
    private set
  var text: String = ""
    private set
  var complete = false
    private set
  fun accept(event: StreamEvent) {
    when (event.type) {
      "paragraph" -> {
        if (event.eventId != null && event.eventId != eventId) { text = ""; eventId = event.eventId }
        text = if (event.replace) event.text.orEmpty() else listOf(text, event.text.orEmpty()).filter(String::isNotEmpty).joinToString("\n\n")
      }
      "error" -> throw PecuException(event.error ?: "Pecu could not finish the reply.")
      "complete" -> {
        if (event.status == "busy") throw PecuException("Pecu is still working on your previous message. Check for its reply before retrying.")
        complete = true
      }
    }
  }
}

class PecuException(message: String) : Exception(message)
