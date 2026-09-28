package app.pecu

import kotlinx.serialization.Serializable

@Serializable data class PreviewField(val label: String, val value: String)
data class PreviewGroup(val amounts: List<PreviewField>, val details: List<PreviewField>)
data class PreviewPresentation(val groups: List<PreviewGroup>, val metadata: List<PreviewField>, val technical: List<PreviewField>)

private val prominentPreviewFields = setOf("You pay", "You receive", "Amount", "Spending limit", "Send")
private val sharedPreviewFields = setOf("Network", "Network fee")
private val receiptPattern = Regex("https://basescan\\.org/tx/0x[\\da-fA-F]{64}\\b")
private val addressPattern = Regex("0x[\\da-fA-F]{40}")

fun isTechnicalPreviewField(row: PreviewField): Boolean = when {
  row.label == "Position · Id" -> row.value.matches(Regex("\\d+"))
  row.label.matches(Regex("Position · Pool · (Lp|Token[01] address)")) -> row.value.matches(addressPattern)
  row.label == "Position · Pool · Is cl" -> row.value in setOf("Yes", "No")
  row.label == "Position · Pool · Type label" -> row.value.matches(Regex("cl-\\d+|volatile|stable"))
  row.label.matches(Regex("Position · Pool · Token[01]")) -> row.value.matches(Regex("[A-Za-z0-9._-]{1,24}"))
  else -> false
}

private fun previewFields(line: String): List<PreviewField> {
  fun fields(vararg pairs: Pair<String, String>) = pairs.map { PreviewField(it.first, it.second) }
  Regex("Swap (.+?) for about (.+?) on Base\\.").matchEntire(line)?.let {
    return fields("You pay" to it.groupValues[1], "You receive" to "about ${it.groupValues[2]}", "Network" to "Base")
  }
  Regex("Send (.+?) to (0x[\\da-fA-F….]+)\\.?").matchEntire(line)?.let {
    return fields("Amount" to it.groupValues[1], "To" to it.groupValues[2].removeSuffix("."))
  }
  Regex("Approve (0x[\\da-fA-F]+) to spend (.+)").matchEntire(line)?.let {
    return fields("Spending limit" to it.groupValues[2], "Spender" to it.groupValues[1])
  }
  Regex("Revoke (.+?) allowance for (0x[\\da-fA-F]+)").matchEntire(line)?.let {
    return fields("Spending limit" to "0 ${it.groupValues[1]}", "Spender" to it.groupValues[2])
  }
  Regex("Aave (.+?) on Base\\. Amount: (.+)\\.").matchEntire(line)?.let {
    return fields("Action" to "Aave ${it.groupValues[1]}", "Amount" to it.groupValues[2], "Network" to "Base")
  }
  Regex("(.+?) → about (.+)").matchEntire(line)?.let {
    return fields("You pay" to it.groupValues[1], "You receive" to "about ${it.groupValues[2]}")
  }
  Regex("([^:]{1,40}): (.+)").matchEntire(line)?.let {
    return fields(it.groupValues[1] to it.groupValues[2].removeSuffix("."))
  }
  return fields("" to line)
}

fun previewPresentation(text: String): PreviewPresentation {
  val parsed = text.split(Regex("\\n\\s*\\n")).map { block -> block.lines().map(String::trim).filter(String::isNotEmpty).flatMap(::previewFields) }
  val conflicting = sharedPreviewFields.filter { label -> parsed.flatten().filter { it.label == label }.map { it.value }.distinct().size > 1 }.toSet()
  val metadata = mutableListOf<PreviewField>()
  val technical = mutableListOf<PreviewField>()
  val groups = parsed.map { rows ->
    val amounts = mutableListOf<PreviewField>()
    val details = mutableListOf<PreviewField>()
    rows.forEach { row -> when {
      isTechnicalPreviewField(row) -> technical.add(row)
      row.label in sharedPreviewFields && row.label !in conflicting -> metadata.add(row)
      row.label in prominentPreviewFields -> amounts.add(row)
      row.label == "Position · Pool · Symbol" -> details.add(row.copy(label = "Pool"))
      else -> details.add(row)
    } }
    PreviewGroup(amounts, details)
  }.filter { it.amounts.isNotEmpty() || it.details.isNotEmpty() }
  return PreviewPresentation(groups, metadata.distinct(), technical)
}

fun previewReceipts(result: String?, hashes: List<String>): List<String> {
  val linked = hashes.map(String::lowercase).toSet()
  return receiptPattern.findAll(result.orEmpty()).map { it.value }.distinct().filter { it.takeLast(66).lowercase() !in linked }.toList()
}

fun previewResultText(result: String?): String = result.orEmpty().lines()
  .filterNot { receiptPattern.matches(it.trim()) }.joinToString("\n").trim()

fun planStepStatus(status: String?): String = when (status) {
  null -> "Ready for review"
  "waiting" -> "Waiting"
  "submitted" -> "Waiting for receipt"
  "confirmed" -> "Confirmed"
  "failed" -> "Failed"
  "skipped" -> "Not sent"
  else -> status
}

fun transactionStepTitle(step: PlanStep): String = when {
  step.kind == "approval" && step.title == "Allow the gauge to take the position for staking" -> "Allow staking"
  step.kind == "stake" && step.title == "Stake the position in its gauge" -> "Stake position"
  else -> step.title
}

fun isRepeatedSuccess(state: String, result: String): Boolean = state == "succeeded" &&
  result.matches(Regex("Aerodrome (stake|unstake|claim fees|claim emissions|deposit|withdraw|swap) confirmed on Base mainnet\\."))
