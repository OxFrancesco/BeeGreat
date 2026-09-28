package app.pecu

import kotlinx.serialization.Serializable
import org.junit.Assert.*
import org.junit.Test

@Serializable data class AmountFixture(val exact: String, val compact: String)
@Serializable data class PositionFixture(val snapshot: PositionSnapshot, val legacy: String, val amounts: List<AmountFixture>)

class PositionContractTest {
  private val fixture = wireJson.decodeFromString<PositionFixture>(javaClass.getResource("/positions.json")!!.readText())
  @Test fun sharedAmountsNeverTurnDustIntoZero() {
    fixture.amounts.forEach { assertEquals(it.exact, it.compact, compactPositionAmount(it.exact)) }
  }
  @Test fun exactLegacyReplyUsesSameRowsAsBackend() {
    assertEquals(fixture.snapshot.positions, legacyPositions(fixture.legacy))
    assertNull(legacyPositions("Warning: incomplete result\n${fixture.legacy}"))
    assertNull(legacyPositions("${fixture.legacy}\nDo not stake these."))
    assertNull(legacyPositions(fixture.legacy.replace("Staked: 0 WETH", "Staked: 0 ETH")))
  }
  @Test fun olderRepliesRemainCompatibleAndNewSnapshotDecodes() {
    val encoded = wireJson.encodeToString(Reply(text = "Positions", preview = null, positions = fixture.snapshot))
    assertEquals(fixture.snapshot, wireJson.decodeFromString<Reply>(encoded).positions)
    assertNull(wireJson.decodeFromString<Reply>("""{"text":"Hello","preview":null}""").positions)
  }
}
