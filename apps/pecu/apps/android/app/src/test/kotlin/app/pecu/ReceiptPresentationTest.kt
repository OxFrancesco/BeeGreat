package app.pecu

import kotlinx.serialization.Serializable
import org.junit.Assert.*
import org.junit.Test

@Serializable data class ReceiptExample(val name: String, val input: String, val expected: List<ReceiptExpected>)
@Serializable data class ReceiptExpected(val kind: String, val text: String? = null, val links: List<ReceiptLink> = emptyList())
class ReceiptPresentationTest {
  @Test fun sharedExamplesAcrossAllActionsAndMarkdownContexts() {
    val cases = wireJson.decodeFromString<List<ReceiptExample>>(javaClass.getResource("/receipts.json")!!.readText())
    cases.forEach { example ->
      val actual = receiptPresentation(example.input).map { when (it) {
        is ReceiptBlock.Text -> ReceiptExpected("text", text = it.text)
        is ReceiptBlock.Receipts -> ReceiptExpected("receipts", links = it.links)
      } }
      assertEquals(example.name, example.expected, actual)
    }
  }
  @Test fun duplicateCommandOutcomesDisappearOnlyWhenCardContainsExactResult() {
    val preview = transactionFixture().preview
    val original = Message("1", "Stake my position", 1, reply = Reply("Review", preview))
    val command = Message("2", "/confirm ${preview.code}", 2, reply = Reply(preview.result!!))
    assertEquals(listOf(original), visibleReplyMessages(listOf(original, command)))
    assertEquals(listOf(command), visibleReplyMessages(listOf(command)))
    listOf(command.copy(reply = null), command.copy(reply = Reply(preview.result + "\nDo not retry.")), command.copy(reply = Reply(preview.result, recovery = "connect_chatgpt")), command.copy(reply = Reply(preview.result, question = Question("Continue?", listOf("No"))))).forEach { turn ->
      assertEquals(listOf(original, turn), visibleReplyMessages(listOf(original, turn)))
    }
    assertEquals(listOf(original, command.copy(text = "Explain this result")), visibleReplyMessages(listOf(original, command.copy(text = "Explain this result"))))
  }
  @Test fun cancellationKeepsAnyAdditionalWarning() {
    val preview = transactionFixture().preview.copy(state = "cancelled")
    val original = Message("1", "Stake", 1, reply = Reply("Review", preview))
    val command = Message("2", "/cancel ${preview.code}", 2, reply = Reply("Proposal cancelled. Nothing was sent."))
    assertEquals(listOf(original), visibleReplyMessages(listOf(original, command)))
    val warning = command.copy(reply = Reply(command.reply!!.text + "\nCheck your allowance."))
    assertEquals(listOf(original, warning), visibleReplyMessages(listOf(original, warning)))
  }
}
