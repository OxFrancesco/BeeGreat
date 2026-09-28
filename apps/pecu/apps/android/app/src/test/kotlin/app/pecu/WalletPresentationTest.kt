package app.pecu

import org.junit.Assert.*
import org.junit.Test

class WalletPresentationTest {
  @Test fun displayNeverLosesDustOrInventsAvailableBalance() {
    assertEquals("<0.000001", walletBalanceText("0.000000000000000001"))
    assertEquals("≈0.000348", walletBalanceText("0.000348107746868867"))
    assertEquals("0.045763", walletBalanceText("0.045763"))
    assertEquals("0", walletBalanceText("0.000000"))
    listOf(null, "NaN", "-1", "1e100000", "").forEach { assertEquals("Unavailable", walletBalanceText(it)) }
  }
  @Test fun reviewRequiresPecuWalletValidExactInputAndNoOtherAction() {
    val wallet = AccountState(wallet = "0x" + "1".repeat(40))
    val recipient = "0x" + "2".repeat(40)
    fun allowed(account: AccountState? = wallet, blocked: Boolean = false, amount: String = "0.000000000000000001", symbol: String = "USDC", to: String = recipient) = walletTransferAllowed(account, blocked, symbol, amount, to)
    assertTrue(allowed())
    assertTrue(allowed(symbol = "0x" + "3".repeat(40)))
    assertFalse(allowed(null)); assertFalse(allowed(wallet.copy(yolo = true)))
    assertFalse(allowed(wallet.copy(signer = recipient))); assertFalse(allowed(blocked = true))
    listOf("0", "-1", "1e2", "0.0000000000000000001", "1 /confirm").forEach { assertFalse(allowed(amount = it)) }
    assertFalse(allowed(symbol = "USDC to someone")); assertFalse(allowed(to = "0x123"))
  }
}
