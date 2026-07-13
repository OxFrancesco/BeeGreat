import {
  getToolCopy as getSharedToolCopy,
  type ToolActivityState,
} from "@beegreat/tool-presentation";

const TOOL_SYMBOLS: Record<string, string> = {
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
  get_wallet_balance: "wallet.pass",
  send_tokens: "paperplane",
  get_health_context: "heart.text.square",
  query_health_data: "heart.text.square",
};

function taskSymbol(input: unknown) {
  const agent =
    typeof input === "object" && input !== null && "agent" in input
      ? String((input as { agent?: unknown }).agent ?? "")
      : "";
  if (agent === "goals") return "scope";
  if (agent === "web3" || agent === "google-health") return "bolt.fill";
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
