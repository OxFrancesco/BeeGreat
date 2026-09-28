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
@Serializable data class Message(val id: String, val text: String, val createdAt: Long, val canRetry: Boolean = false, val reply: Reply? = null)
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
@Serializable data class TurnRequest(val requestId: String, val text: String, val threadId: String? = null, val retryOf: String? = null, val answerTo: String? = null, val reviewWallet: String? = null)
@Serializable data class StreamEvent(val type: String, val text: String? = null, val replace: Boolean = false, val status: String? = null, val error: String? = null, val stage: Stage? = null)
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
  var text: String = ""
    private set
  var complete = false
    private set
  fun accept(event: StreamEvent) {
    when (event.type) {
      "paragraph" -> text = if (event.replace) event.text.orEmpty() else listOf(text, event.text.orEmpty()).filter(String::isNotEmpty).joinToString("\n\n")
      "error" -> throw PecuException(event.error ?: "Pecu could not finish the reply.")
      "complete" -> {
        if (event.status == "busy") throw PecuException("Pecu is still working on your previous message. Check for its reply before retrying.")
        complete = true
      }
    }
  }
}

class PecuException(message: String) : Exception(message)
