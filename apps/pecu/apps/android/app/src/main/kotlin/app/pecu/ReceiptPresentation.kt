package app.pecu

import kotlinx.serialization.Serializable

@Serializable data class ReceiptLink(val url: String, val hash: String, val label: String)
sealed interface ReceiptBlock {
  data class Text(val text: String) : ReceiptBlock
  data class Receipts(val links: List<ReceiptLink>) : ReceiptBlock
}
private val receiptUrl = Regex("https://basescan\\.org/tx/(0x[\\da-fA-F]{64})")
private val namedReceipt = Regex("\\[([^]\\n]*)]\\(([^\\s)]+)\\)")
private val inlineTokens = Regex("(`+).*?\\1|`+.*$|!?\\[[^]\\n]*]\\([^\\s)]+\\)|https?://[^\\s<>()]+")

fun receiptLink(url: String, label: String = ""): ReceiptLink? {
  val hash = receiptUrl.matchEntire(url)?.groupValues?.get(1) ?: return null
  return ReceiptLink(url, hash, if (label.isEmpty() || label == url || label.matches(Regex("0x[\\da-fA-F]{64}"))) "View transaction" else label)
}

private fun standaloneReceipt(line: String): ReceiptLink? {
  var text = line.trim().replace(Regex("^(?:[-*+] |\\d+[.)] )"), "")
  if ((text.startsWith("**") && text.endsWith("**")) || (text.startsWith("__") && text.endsWith("__"))) text = text.substring(2, text.length - 2)
  namedReceipt.matchEntire(text)?.let { return receiptLink(it.groupValues[2], it.groupValues[1]) }
  if (text.startsWith("<") && text.endsWith(">")) text = text.substring(1, text.length - 1)
  return receiptLink(text)
}

private fun inlineReceipts(line: String): String = inlineTokens.replace(line) { match ->
  val token = match.value
  if (token.startsWith("`") || token.startsWith("!")) token else {
    val named = namedReceipt.matchEntire(token)
    val url = named?.groupValues?.get(2) ?: token.trimEnd('.', ',', ';')
    val receipt = receiptLink(url, named?.groupValues?.get(1).orEmpty())
    if (receipt == null || (named != null && receipt.label == named.groupValues[1])) token
    else "[${receipt.label}](${receipt.url})" + if (named == null) token.substring(url.length) else ""
  }
}

fun receiptPresentation(text: String): List<ReceiptBlock> {
  if (!text.contains("https://basescan.org/tx/")) return if (text.isEmpty()) emptyList() else listOf(ReceiptBlock.Text(text))
  val blocks = mutableListOf<ReceiptBlock>()
  val lines = mutableListOf<String>()
  val links = mutableListOf<ReceiptLink>()
  var fence: String? = null
  fun flushText() { if (lines.any { it.isNotBlank() }) blocks.add(ReceiptBlock.Text(lines.joinToString("\n"))); lines.clear() }
  fun flushLinks() { if (links.isNotEmpty()) blocks.add(ReceiptBlock.Receipts(links.toList())); links.clear() }
  text.split("\n").forEach { line ->
    val marker = Regex("^ {0,3}(`{3,}|~{3,})").find(line)?.groupValues?.get(1)
    val literal = fence != null || marker != null || line.startsWith("    ") || line.startsWith("\t")
    val previousFence = fence
    if (marker != null && previousFence == null) fence = marker
    else if (marker != null && previousFence != null && marker.first() == previousFence.first() && marker.length >= previousFence.length && line.trim() == marker) fence = null
    val receipt = if (literal) null else standaloneReceipt(line)
    if (receipt != null) {
      flushText()
      if (links.none { it.hash.equals(receipt.hash, true) && it.label == receipt.label }) links.add(receipt)
    } else if (line.isBlank() && links.isNotEmpty()) {
      // Blank separators between receipt-only lines do not create empty blocks.
    } else { flushLinks(); lines.add(if (literal) line else inlineReceipts(line)) }
  }
  flushLinks(); flushText()
  return blocks
}

private val confirmationPattern = Regex("^/(confirm|cancel) ([A-Z0-9]{6})$", RegexOption.IGNORE_CASE)

fun visibleReplyMessages(messages: List<Message>): List<Message> {
  val previews = mutableMapOf<String, Preview>()
  messages.forEach { it.reply?.preview?.let { preview -> previews.putIfAbsent(preview.code, preview) } }
  return messages.filter { message ->
    val command = confirmationPattern.matchEntire(message.text.trim())
    val preview = command?.groupValues?.get(2)?.uppercase()?.let(previews::get)
    val reply = message.reply
    if (command == null || preview == null || reply == null || reply.preview != null || reply.question != null || reply.positions != null || reply.holdings != null || reply.analytics.isNotEmpty() || reply.recovery != null) true
    else when (command.groupValues[1].lowercase()) {
      "confirm" -> preview.result == null || reply.text != preview.result
      "cancel" -> preview.state != "cancelled" || reply.text != "Proposal cancelled. Nothing was sent."
      else -> true
    }
  }
}
