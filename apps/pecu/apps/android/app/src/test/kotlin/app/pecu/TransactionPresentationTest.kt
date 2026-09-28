package app.pecu

import kotlinx.serialization.Serializable
import org.junit.Assert.*
import org.junit.Test

@Serializable data class TransactionFixture(val preview: Preview, val visible: List<String>, val technical: List<PreviewField>)
fun transactionFixture() = wireJson.decodeFromString<TransactionFixture>(TransactionFixture::class.java.getResource("/stake.json")!!.readText())

class TransactionPresentationTest {
  @Test fun sharedStakeFixtureKeepsReviewShortAndDetailsExact() {
    val fixture = transactionFixture()
    val parsed = previewPresentation(fixture.preview.text)
    assertEquals(fixture.technical, parsed.technical)
    assertEquals(fixture.visible, (parsed.groups.flatMap { it.details } + parsed.metadata).map { it.value })
    assertTrue(previewReceipts(fixture.preview.result, fixture.preview.plan!!.steps.mapNotNull { it.hash }).isEmpty())
  }
  @Test fun criticalAndUnknownFieldsNeverCollapse() {
    val address = "0x" + "a".repeat(40)
    listOf("Minimum received: 0.000000000000000001 ETH", "Warning: Do not retry", "Custom constraint: 42", "Position · Pool · Token0: WARNING do not sign", "To: $address", "Spender: $address", "Continue with /confirm only after checking the receipt").forEach { line ->
      val parsed = previewPresentation(line)
      assertTrue(parsed.technical.isEmpty())
      assertEquals(1, parsed.groups.single().details.size)
    }
    val send = previewPresentation("Send 0.000000000000000001 ETH to $address").groups.single()
    assertEquals("0.000000000000000001 ETH", send.amounts.single().value)
    assertEquals(address, send.details.single().value)
  }
  @Test fun receiptsDeduplicateOnlyExactHashesAndKeepUnlinkedReceipts() {
    val hash = "0x" + "a".repeat(64); val other = "0x" + "b".repeat(64)
    assertEquals(listOf("https://basescan.org/tx/$other"), previewReceipts("https://basescan.org/tx/$hash\nhttps://basescan.org/tx/$other\nhttps://basescan.org/tx/$other", listOf(hash)))
    assertEquals("Approval succeeded.\nDo not retry the stake.", previewResultText("Approval succeeded.\nhttps://basescan.org/tx/$hash\nDo not retry the stake."))
  }
  @Test fun multipleTradesKeepSeparateMinimaAndConflictingFees() {
    val parsed = previewPresentation("1 USDC → about 2 AAA\nMinimum received: 1.9 AAA\nNetwork fee: 0.01 ETH\n\n2 USDC → about 3 BBB\nMinimum received: 2.9 BBB\nNetwork fee: 0.02 ETH")
    assertEquals(2, parsed.groups.size)
    assertTrue(parsed.metadata.isEmpty())
    assertEquals(listOf("1.9 AAA", "0.01 ETH"), parsed.groups[0].details.map { it.value })
    assertEquals(listOf("2.9 BBB", "0.02 ETH"), parsed.groups[1].details.map { it.value })
  }
}
