import type { Result, ToolContext } from "@opencode-ai/plugin/promise/tool";
import { Schema } from "effect";
import { z } from "zod";
import type { PecuAgent } from "./agent";
import { taskInstructions } from "./agent-skills";
import { PecuCodeMode, codeModeName } from "./cloudflare/code-mode";
import { isJsonObject, jsonValueSchema, type JsonInput, type JsonValue } from "./json-contract";
import { mcpExecutionInstructions, mcpToolScope } from "./mcp-catalog";
import { mcpBackendRequestSchema, type McpBackendRequest, type McpCallResult } from "./mcp-contract";
import { digest } from "./plan-digest";
import { toolLabel } from "./progress";
import { registerPecuTools, type PecuToolServices } from "./tool-catalog";
import type { WebAgent, WebSql } from "./web";
import { webConversation } from "./web-identity";

const sessionId = Schema.String.pipe(Schema.brand("SessionID"));
const agentId = Schema.String.pipe(Schema.brand("Agent.ID"));
const messageId = Schema.String.pipe(Schema.brand("Session.Message.ID"));
const callId = Schema.String.pipe(Schema.brand("Tool.CallID"));
const codeInput = z.strictObject({ code: z.string().min(1).max(24_000) });
const skillInstructions = `${mcpExecutionInstructions}\nThese MCP rules take precedence over chat execution rules in the following skills.\n\n`;

function canonical(value: JsonValue): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (isJsonObject(value)) {
    return `{${Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, child]) => `${JSON.stringify(key)}:${canonical(child)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function resultText(result: Result): string {
  if (result.output !== undefined) return JSON.stringify(jsonValueSchema.parse(result.output));
  return Array.isArray(result.content)
    ? result.content.flatMap(part => part.type === "text" ? [part.text] : []).join("\n")
    : z.string().catch("").parse(result.content);
}

function initializeCalls(sql: WebSql): void {
  sql.exec("CREATE TABLE IF NOT EXISTS basedbot_mcp_calls (event_id TEXT PRIMARY KEY, fingerprint TEXT NOT NULL, admitted INTEGER NOT NULL DEFAULT 0, completed INTEGER NOT NULL DEFAULT 0)");
  const columns = new Set(sql.exec<{ name: string }>("PRAGMA table_info(basedbot_mcp_calls)").toArray().map(column => column.name));
  // Earlier records lack admission evidence, so unfinished writes must remain closed.
  if (!columns.has("admitted")) sql.exec("ALTER TABLE basedbot_mcp_calls ADD COLUMN admitted INTEGER NOT NULL DEFAULT 1");
  if (!columns.has("completed")) sql.exec("ALTER TABLE basedbot_mcp_calls ADD COLUMN completed INTEGER NOT NULL DEFAULT 0");
}

export async function executePecuMcpTool(
  agent: PecuAgent,
  webAgent: WebAgent,
  sql: WebSql,
  rawInput: McpBackendRequest,
  services: PecuToolServices,
): Promise<McpCallResult> {
  const input = mcpBackendRequestSchema.parse(rawInput);
  const visible = (name: string) => input.scopes.includes(mcpToolScope(name));
  if (!visible(input.name)) return { text: "This connection does not have permission to use this tool. Reconnect with Pecu write access.", isError: true };
  const threadId = `mcp-${(await digest(input.clientId)).slice(0, 32)}`;
  const scope = { ...input.identity, threadId };
  const conversationId = webConversation(scope);
  const eventId = `${conversationId}:${input.requestId}`;
  const fingerprint = await digest(canonical({ name: input.name, arguments: input.arguments }));
  return webAgent.recordTool(scope, eventId, `/mcp ${toolLabel(input.name)}`, async () => {
    initializeCalls(sql);
    const previous = sql.exec<{ fingerprint: string; admitted: number; completed: number }>("SELECT fingerprint,admitted,completed FROM basedbot_mcp_calls WHERE event_id=?", eventId).toArray()[0];
    if (previous && previous.fingerprint !== fingerprint) throw new Error("This MCP request ID already belongs to another tool call. Use a new request ID for a new action.");
    sql.exec("INSERT OR IGNORE INTO basedbot_mcp_calls(event_id,fingerprint,admitted,completed) VALUES(?,?,0,0)", eventId, fingerprint);
    const result = await agent.handleTool({ ...input.identity, eventId, conversationId, text: `/mcp ${toolLabel(input.name)}`, encodedEvent: "" }, async capabilities => {
      if (previous?.admitted === 1 && (input.name === codeModeName || mcpToolScope(input.name) === "pecu:write")) {
        throw new Error("The previous attempt started, but its result is unavailable. Check this Pecu thread and the action's current state before creating a new request. This attempt did not repeat any writes.");
      }
      sql.exec("UPDATE basedbot_mcp_calls SET admitted=1 WHERE event_id=?", eventId);
      const context: ToolContext = {
        sessionID: sessionId.make(conversationId),
        agent: agentId.make("pecu-mcp"),
        messageID: messageId.make(eventId),
        id: callId.make(input.requestId),
        progress: async () => {},
      };
      const codeMode = new PecuCodeMode();
      const entries = new Map<string, (input: JsonInput) => Promise<Result>>();
      registerPecuTools(tool => {
        const registration: typeof tool = {
          ...tool,
          execute: async (input, context) => {
            const result = await tool.execute(input, context);
            return tool.name === "aave_skill" ? { ...result, content: skillInstructions + resultText(result) } : result;
          },
        };
        codeMode.register(registration);
        entries.set(tool.name, raw => registration.execute(tool.input.parse(raw), context));
      }, {
        capabilities: () => capabilities,
        services,
        loadSkills: async names => ({ content: skillInstructions + taskInstructions(names) + "\nAll supported Pecu tools are already available on this MCP connection. Loading instructions does not approve a transaction." }),
      });
      let result: Result;
      if (input.name === codeModeName) {
        result = await codeMode.execute(codeInput.parse(input.arguments).code, context, visible);
      } else {
        const execute = entries.get(input.name);
        if (!execute) throw new Error("This tool is not available on Pecu MCP.");
        result = await execute(input.arguments);
      }
      return { text: resultText(result), isError: result.metadata?.pecu_code_error === true };
    });
    if (agent.storedToolResult(eventId)) sql.exec("UPDATE basedbot_mcp_calls SET completed=1 WHERE event_id=?", eventId);
    return result;
  });
}
