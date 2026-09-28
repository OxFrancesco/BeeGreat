package app.pecu

import java.math.BigDecimal
import org.junit.Assert.*
import org.junit.Test

class StockHoldingsTest {
  private val fixture = wireJson.decodeFromString<LegacyStocksFixture>(javaClass.getResource("/legacy-stocks.json")!!.readText())

  @Test fun oldReplyPreservesExactHistoricalAmountsAndExcludesZeroHoldings() {
    val snapshot = legacyStockHoldings(fixture.text, fixture.createdAt)!!
    assertEquals(fixture.createdAt, snapshot.observedAt)
    assertEquals(10, snapshot.stocks.size)
    assertEquals("0.00004267", snapshot.stocks[0].balance)
    val allocation = stockAllocation(snapshot.stocks)
    assertEquals(1, allocation.priced.size)
    assertEquals("NVDAc", allocation.priced.single().stock.symbol)
    assertEquals(BigDecimal("0.00905488024259"), allocation.total)
    assertEquals("<0.01", stockValueText(allocation.total))
    assertFalse(allocation.partial)
  }

  @Test fun ambiguousOldRepliesRemainText() {
    assertNull(legacyStockHoldings("Incomplete result:\n${fixture.text}", 1))
    assertNull(legacyStockHoldings("${fixture.text}\nDo not trade this.", 1))
    assertNull(legacyStockHoldings(fixture.text.replace("212.207177", "NaN"), 1))
    assertNull(legacyStockHoldings("${fixture.text}\n\n${fixture.text}", 1))
    assertNull(legacyStockHoldings("", 1))
  }

  @Test fun partialAndEmptyResultsStayDistinct() {
    val partial = stockAllocation(legacyStockHoldings("NVIDIA, NVDAc\nPrice unavailable\n\nApple, AAPLc\n100 USDC · You hold 2", 1)!!.stocks)
    assertTrue(partial.partial)
    assertEquals(BigDecimal("200"), partial.total)
    assertEquals("AAPLc", partial.priced.single().stock.symbol)
    val unpriced = stockAllocation(listOf(HoldingStock("NVDAc", "NVIDIA", null, "2")))
    assertTrue(unpriced.partial)
    assertTrue(unpriced.priced.isEmpty())
    assertEquals(1, unpriced.rows.size)
    val empty = stockAllocation(listOf(HoldingStock("NVDAc", "NVIDIA", "100", "0")))
    assertFalse(empty.partial)
    assertTrue(empty.rows.isEmpty())
  }

  @Test fun structuredRepliesHaveTheSamePresentation() {
    val recovered = legacyStockHoldings(fixture.text, fixture.createdAt)!!
    val structured = Holdings(recovered.stocks.map { Stock(it.symbol, it.name, "0x0000000000000000000000000000000000000001", it.price, it.balance, it.error) }, fixture.createdAt)
    assertEquals(stockAllocation(recovered.stocks), stockAllocation(structured.presentation().stocks))
  }
}
