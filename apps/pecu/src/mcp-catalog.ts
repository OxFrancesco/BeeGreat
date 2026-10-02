import { z } from "zod";
import { isSugarTxAction } from "@beegreat/sugar/contracts";
import { aeroTools } from "./cloudflare/aero-tools";
import { registerPecuTools } from "./tool-catalog";

const readTools = new Set([
  "load_skills", "aave_skill", "aave_schema", "wallet_address", "wallet_balances",
  "deposit_status", "research_list", "research_get", "task_list", "evm_token_balance",
  "evm_allowance", "evm_read", "evm_inspect", "evm_decode", "safe_list", "safe_info",
  "safe_queue", "safe_approvals", "safe_module_info", "safe_budget", "safe_role_check",
  "safe_passkey_address",
  ...aeroTools.filter(tool => !isSugarTxAction(tool.action)).map(tool => tool.name),
]);

export function mcpToolScope(name: string): "pecu:read" | "pecu:write" {
  return readTools.has(name) || name === "run_tools" || name.startsWith("nansen_") ||
    name.startsWith("twitter_") || name.startsWith("chain_") ||
    (name.startsWith("polymarket_") && name !== "polymarket_research")
    ? "pecu:read" : "pecu:write";
}

export const mcpExecutionInstructions = "Pecu MCP transaction tools always return unsigned previews. MCP never signs or submits a transaction, regardless of chat YOLO settings. Review and confirm the specific preview in the signed-in Pecu app. MCP cannot enable YOLO or approve automation allowances.";

export function mcpToolDescription(name: string, description: string): string {
  if (name === "load_skills") return "Read instructions for one or more Pecu tool families. All public tools are already available. This call stores no session state and never approves a transaction.";
  if (name === "wallet_address") return "Get the signed-in account's Pecu Base smart-wallet address.";
  if (name === "wallet_balances") return "Get balances for the signed-in account's Pecu Base smart wallet.";
  const text = description
    .replace(" Uses the normal confirmation flow and can execute when YOLO is enabled.", "")
    .replace(" Previews with confirmation; may execute when YOLO is on.", "")
    .replace(" Wallet signing uses the verified sender and Base only.", " Uses the signed-in account's Pecu wallet on Base.");
  return mcpToolScope(name) === "pecu:write" ? `${text} ${mcpExecutionInstructions}` : text;
}

export function mcpInputSchema(input: z.ZodType) {
  return z.toJSONSchema(input, {
    io: "input",
    override({ zodSchema, jsonSchema }) {
      // Keep defaults optional on input. Close declared object shapes without
      // changing records, JSON values or objects with an explicit catchall.
      if (zodSchema instanceof z.ZodObject && !zodSchema.def.catchall)
        jsonSchema.additionalProperties = false;
    },
  });
}

export const mcpToolCatalog = (() => {
  const entries: { name: string; description: string; input: z.ZodType }[] = [];
  registerPecuTools(tool => entries.push(tool), {
    capabilities: () => { throw new Error("Catalog has no execution capabilities"); },
    loadSkills: async () => { throw new Error("Catalog has no execution capabilities"); },
  });
  entries.push({
    name: "run_tools",
    description: "Run JavaScript using the Pecu tools in this catalog. Each nested tool checks your permissions. Transactions return previews for review in Pecu. No imports, fetch or credentials. Maximum 24 tool calls, 120 seconds and 24 KB of output. Completed calls remain completed after a script error.",
    input: z.strictObject({ code: z.string().min(1).max(24_000) }),
  });
  return entries.map(tool => ({
    ...tool,
    description: mcpToolDescription(tool.name, tool.description),
    inputSchema: mcpInputSchema(tool.input),
    scope: mcpToolScope(tool.name),
    readOnly: mcpToolScope(tool.name) === "pecu:read" && tool.name !== "run_tools",
  }));
})();
