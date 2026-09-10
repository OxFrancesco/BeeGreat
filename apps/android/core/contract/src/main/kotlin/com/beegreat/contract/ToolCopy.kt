package com.beegreat.contract

import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.contentOrNull

enum class ToolActivityState {
  Running,
  Done,
  Error,
}

data class ToolCopy(val label: String, val powerup: String?, val specialist: String?)

private data class Copy(val running: String, val done: String, val failed: String, val powerup: String? = null, val specialist: String? = null)

private val POWERUP_AGENTS = mapOf("devin" to "Devin", "web3" to "Web3", "google-health" to "Google Health")
private val BUILT_IN_SPECIALISTS = mapOf("imagine" to "Imagine", "google-workspace" to "Google Workspace")

private fun c(running: String, done: String, failed: String, powerup: String? = null, specialist: String? = null) =
  Copy(running, done, failed, powerup, specialist)

// Port of TOOL_COPY in packages/tool-presentation/src/index.ts.
private val TOOL_COPY: Map<String, Copy> =
  mapOf(
    "search_mind" to c("Searching your Mind…", "Searched your Mind", "Couldn’t search your Mind"),
    "list_bookmarks" to c("Checking your bookmarks…", "Checked your bookmarks", "Couldn’t read your bookmarks"),
    "get_bookmark" to c("Reading the bookmark…", "Read the bookmark", "Couldn’t read the bookmark"),
    "save_bookmark" to c("Saving the bookmark…", "Saved the bookmark", "Couldn’t save the bookmark"),
    "update_bookmark" to c("Updating the bookmark…", "Updated the bookmark", "Couldn’t update the bookmark"),
    "delete_bookmark" to c("Deleting the bookmark…", "Deleted the bookmark", "Couldn’t delete the bookmark"),
    "telegram_connection_status" to c("Checking Telegram…", "Checked Telegram", "Couldn’t check Telegram"),
    "send_telegram_message" to c("Sending to Telegram…", "Sent to Telegram", "Couldn’t send to Telegram"),
    "create_agent_job" to c("Scheduling the Job…", "Scheduled the Job", "Couldn’t schedule the Job"),
    "list_agent_jobs" to c("Checking your Jobs…", "Checked your Jobs", "Couldn’t read your Jobs"),
    "update_agent_job" to c("Updating the Job…", "Updated the Job", "Couldn’t update the Job"),
    "pause_agent_job" to c("Pausing the Job…", "Paused the Job", "Couldn’t pause the Job"),
    "resume_agent_job" to c("Resuming the Job…", "Resumed the Job", "Couldn’t resume the Job"),
    "cancel_agent_job" to c("Cancelling the Job…", "Cancelled the Job", "Couldn’t cancel the Job"),
    "run_now_agent_job" to c("Starting the Job…", "Started the Job", "Couldn’t start the Job"),
    "complete_agent_job_run" to c("Saving the Job result…", "Saved the Job result", "Couldn’t save the Job result"),
    "wait_for_agent_job_external" to c("Tracking the on-chain action…", "Tracking the on-chain action", "Couldn’t track the on-chain action"),
    "get_goals" to c("Checking your goals…", "Checked your goals", "Couldn’t read your goals"),
    "create_goal" to c("Creating your goal…", "Created your goal", "Couldn’t create the goal"),
    "update_goal" to c("Updating your goal…", "Updated your goal", "Couldn’t update the goal"),
    "delete_goal" to c("Deleting the goal…", "Deleted the goal", "Couldn’t delete the goal"),
    "create_project" to c("Creating the project…", "Created the project", "Couldn’t create the project"),
    "update_project" to c("Renaming the project…", "Renamed the project", "Couldn’t rename the project"),
    "delete_project" to c("Deleting the project…", "Deleted the project", "Couldn’t delete the project"),
    "list_tasks" to c("Looking through your tasks…", "Looked through your tasks", "Couldn’t read your tasks"),
    "create_task" to c("Adding your task…", "Added your task", "Couldn’t add the task"),
    "complete_task" to c("Marking it done…", "Marked it done", "Couldn’t complete the task"),
    "update_task" to c("Updating the task…", "Updated the task", "Couldn’t update the task"),
    "delete_task" to c("Deleting the task…", "Deleted the task", "Couldn’t delete the task"),
    "create_wallet" to c("Creating your wallet…", "Created your wallet", "Couldn’t create the wallet", "Web3"),
    "get_wallets" to c("Checking your wallets…", "Checked your wallets", "Couldn’t read your wallets", "Web3"),
    "get_wallet_balance" to c("Checking your wallet…", "Checked your wallet", "Couldn’t read your wallet", "Web3"),
    "get_wallet_activity" to c("Reading your wallet activity…", "Read your wallet activity", "Couldn’t read the activity", "Web3"),
    "fund_wallet" to c("Requesting test funds…", "Requested test funds", "Couldn’t fund the wallet", "Web3"),
    "send_tokens" to c("Sending tokens…", "Sent the tokens", "Couldn’t send the tokens", "Web3"),
    "prepare_send_tokens" to c("Preparing the transfer…", "Prepared the transfer", "Couldn’t prepare the transfer", "Web3"),
    "quote_cross_chain_swap" to c("Finding a cross-chain route…", "Found a cross-chain route", "Couldn’t find a route", "Web3"),
    "prepare_cross_chain_swap" to c("Preparing the cross-chain swap…", "Prepared the cross-chain swap", "Couldn’t prepare the swap", "Web3"),
    "prepare_sugar_execution" to c("Preparing the DeFi action…", "Prepared the DeFi action", "Couldn’t prepare the action", "Web3"),
    "check_web3_action" to c("Checking the action status…", "Checked the action status", "Couldn’t check the action", "Web3"),
    "sugar_pools" to c("Scanning liquidity pools…", "Scanned liquidity pools", "Couldn’t read the pools", "Web3"),
    "sugar_positions" to c("Checking your positions…", "Checked your positions", "Couldn’t read the positions", "Web3"),
    "sugar_epochs_latest" to c("Reading the latest epochs…", "Read the latest epochs", "Couldn’t read the epochs", "Web3"),
    "sugar_epochs" to c("Reading epoch history…", "Read the epoch history", "Couldn’t read the epochs", "Web3"),
    "sugar_quote" to c("Getting a swap quote…", "Got the swap quote", "Couldn’t get a quote", "Web3"),
    "sugar_swap" to c("Building the swap plan…", "Built the swap plan", "Couldn’t build the swap", "Web3"),
    "sugar_deposit" to c("Building the deposit plan…", "Built the deposit plan", "Couldn’t build the deposit", "Web3"),
    "sugar_withdraw" to c("Building the withdrawal plan…", "Built the withdrawal plan", "Couldn’t build the withdrawal", "Web3"),
    "sugar_stake" to c("Building the staking plan…", "Built the staking plan", "Couldn’t build the staking plan", "Web3"),
    "sugar_unstake" to c("Building the unstaking plan…", "Built the unstaking plan", "Couldn’t build the unstaking plan", "Web3"),
    "sugar_claim_emissions" to c("Building the rewards claim…", "Built the rewards claim", "Couldn’t build the claim", "Web3"),
    "sugar_claim_fees" to c("Building the fee claim…", "Built the fee claim", "Couldn’t build the claim", "Web3"),
    "get_health_context" to c("Checking your health profile…", "Checked your health profile", "Couldn’t read your health profile", "Google Health"),
    "query_health_data" to c("Reading your health data…", "Read your health data", "Couldn’t read your health data", "Google Health"),
    "start_devin_task" to c("Starting Devin in the cloud…", "Started the Devin task", "Couldn’t start the Devin task", "Devin"),
    "list_devin_tasks" to c("Checking Devin’s cloud tasks…", "Checked Devin’s cloud tasks", "Couldn’t check Devin’s tasks", "Devin"),
    "inspect_devin_task" to c("Reading Devin’s latest update…", "Read Devin’s latest update", "Couldn’t read Devin’s update", "Devin"),
    "follow_up_devin_task" to c("Sending Devin a follow-up…", "Sent Devin the follow-up", "Couldn’t send Devin the follow-up", "Devin"),
    "generate_image" to c("Creating your image…", "Created your image", "Couldn’t create your image", specialist = "Imagine"),
    "edit_image" to c("Editing your image…", "Edited your image", "Couldn’t edit your image", specialist = "Imagine"),
    "generate_video" to c("Creating your video…", "Created your video", "Couldn’t create your video", specialist = "Imagine"),
    "edit_video" to c("Editing your video…", "Edited your video", "Couldn’t edit your video", specialist = "Imagine"),
  )

/** Reads the agent name out of a raw `task` tool input, if one is present. */
fun taskAgent(input: JsonElement?): String {
  val agent = (input as? JsonObject)?.get("agent") ?: return ""
  return when (agent) {
    JsonNull -> ""
    is JsonPrimitive -> agent.contentOrNull ?: ""
    else -> agent.toString()
  }
}

private fun taskCopy(agent: String): Copy {
  POWERUP_AGENTS[agent]?.let { return c("At work…", "Finished", "Hit a snag", powerup = it) }
  BUILT_IN_SPECIALISTS[agent]?.let { return c("At work…", "Finished", "Hit a snag", specialist = it) }
  if (agent == "goals") return c("Working on your goals…", "Worked on your goals", "Couldn’t finish the goals work")
  return c("Working on it…", "Finished a side task", "Couldn’t finish the side task")
}

/** Human copy for a tool call. Never show raw tool names, payloads, or ids. */
fun getToolCopy(name: String, state: ToolActivityState, input: JsonElement? = null): ToolCopy {
  val readable = name.replace('_', ' ')
  val copy =
    if (name == "task") taskCopy(taskAgent(input))
    else TOOL_COPY[name] ?: c("Working on $readable…", "Finished $readable", "Couldn’t finish $readable")
  return ToolCopy(
    label =
      when (state) {
        ToolActivityState.Running -> copy.running
        ToolActivityState.Error -> copy.failed
        ToolActivityState.Done -> copy.done
      },
    powerup = copy.powerup,
    specialist = copy.specialist,
  )
}
