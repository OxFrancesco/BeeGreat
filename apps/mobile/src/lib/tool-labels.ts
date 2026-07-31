import {
  getToolCopy as getSharedToolCopy,
  type ToolActivityState,
} from "@beegreat/tool-presentation";

const TOOL_SYMBOLS: Record<string, string> = {
  search_mind: "magnifyingglass",
  list_bookmarks: "bookmark",
  get_bookmark: "bookmark",
  save_bookmark: "bookmark.fill",
  update_bookmark: "pencil",
  delete_bookmark: "trash",
  get_goals: "scope",
  create_goal: "plus.circle",
  update_goal: "pencil",
  delete_goal: "trash",
  create_project: "plus.circle",
  update_project: "pencil",
  delete_project: "trash",
  list_tasks: "checklist",
  create_task: "plus.circle",
  complete_task: "checkmark.circle",
  update_task: "pencil",
  delete_task: "trash",
  create_wallet: "wallet.pass",
  get_wallets: "wallet.pass",
  get_wallet_balance: "wallet.pass",
  get_wallet_activity: "clock.arrow.circlepath",
  fund_wallet: "drop.fill",
  send_tokens: "paperplane",
  prepare_send_tokens: "paperplane",
  prepare_sugar_execution: "arrow.triangle.2.circlepath.circle",
  check_web3_action: "checkmark.shield",
  sugar_pools: "drop.triangle",
  sugar_positions: "chart.pie",
  sugar_epochs_latest: "calendar",
  sugar_epochs: "calendar",
  sugar_quote: "arrow.left.arrow.right",
  sugar_swap: "arrow.left.arrow.right.circle",
  sugar_deposit: "plus.circle",
  sugar_withdraw: "minus.circle",
  sugar_stake: "lock",
  sugar_unstake: "lock.open",
  sugar_claim_emissions: "gift",
  sugar_claim_fees: "gift",
  get_health_context: "heart.text.square",
  query_health_data: "heart.text.square",
  start_devin_task: "cloud.fill",
  list_devin_tasks: "cloud.fill",
  inspect_devin_task: "cloud.fill",
  follow_up_devin_task: "paperplane",
  generate_image: "wand.and.stars",
  edit_image: "wand.and.stars",
  generate_video: "film",
  edit_video: "film",
};

function taskSymbol(input: unknown) {
  const agent =
    typeof input === "object" && input !== null && "agent" in input
      ? String((input as { agent?: unknown }).agent ?? "")
      : "";
  if (agent === "goals") return "scope";
  if (
    agent === "web3" ||
    agent === "google-health" ||
    agent === "devin" ||
    agent === "imagine"
  ) return "bolt.fill";
  return "sparkles";
}

export type { ToolActivityState };

export function getToolCopy(
  name: string,
  state: ToolActivityState,
  input?: unknown,
) {
  const copy = getSharedToolCopy(name, state, input);
  const symbol =
    state === "error"
      ? "exclamationmark.triangle"
      : name === "task"
        ? taskSymbol(input)
        : (TOOL_SYMBOLS[name] ?? "sparkles");
  return { ...copy, symbol };
}
