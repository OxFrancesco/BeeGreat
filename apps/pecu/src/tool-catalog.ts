import type { Result, ToolContext } from "@opencode-ai/plugin/promise/tool";
import { isSugarTxAction, type SugarParameters } from "@beegreat/sugar/contracts";
import { z } from "zod";
import { skillNames, type AgentSkill } from "./agent-skills";
import { aeroTools } from "./cloudflare/aero-tools";
import { evmTools } from "./cloudflare/evm-tools";
import type { AgentCapabilities } from "./harness";
import { aaveSkill, aaveSkillNames, aaveSchema } from "./integrations/aave";
import { chainDataEndpointNames, chainDataEndpoints, chainDataTool, type ChainDataService } from "./integrations/chain-data";
import { nansenEndpointNames, nansenEndpoints, nansenQuerySchema, type NansenService } from "./integrations/nansen";
import { polymarketEndpoints, polymarketEndpointNames } from "./integrations/polymarket/catalog.generated";
import { twitterEndpointNames, twitterEndpoints, type TwitterService } from "./integrations/twitter";
import { jsonObjectSchema, jsonValueSchema, type JsonValue } from "./json-contract";
import { liquidityRequestSchema } from "./liquidity-contract";
import { findingsSchema, reportSchema, researchCodeSchema, researchWindowSchema } from "./research-contract";
import { resolveChainProfile } from "./research/agents";
import { stockTradeSchema } from "./stock-contract";
import { taskCreateInputSchema, taskUpdateInputSchema } from "./task-control";

export type PecuToolRegistration<Input extends z.ZodType> = Readonly<{
  name: string;
  description: string;
  input: Input;
  options: { codemode: false };
  execute(input: z.output<Input>, context: ToolContext): Promise<Result>;
}>;

export type PecuToolRegistrar = <Input extends z.ZodType>(tool: PecuToolRegistration<Input>) => void;
export type PecuToolServices = Readonly<{
  chainData: ChainDataService;
  twitter: TwitterService;
  nansen?: Pick<NansenService, "call">;
}>;
export type PecuToolDependencies = Readonly<{
  capabilities(sessionId: string): AgentCapabilities;
  services?: PecuToolServices;
  loadSkills(names: AgentSkill[], context: ToolContext): Promise<Result>;
  research?: Readonly<{
    active(sessionId: string): boolean;
    meter(sessionId: string, read: () => Promise<string>): Promise<string>;
    submit(sessionId: string, payload: JsonValue): Result;
  }>;
}>;

/** The chat and MCP transports share every schema and business-tool dispatch. */
export function registerPecuTools(register: PecuToolRegistrar, dependencies: PecuToolDependencies): void {
  const { capabilities } = dependencies;
  const service = <K extends keyof PecuToolServices>(name: K): NonNullable<PecuToolServices[K]> => {
    const value = dependencies.services?.[name];
    if (!value) throw new Error(name === "twitter" ? "X data is not configured yet." : "This data source is not configured yet.");
    return value;
  };
  const resolveChain = async (query: string) => {
    const chain = await resolveChainProfile(query, service("chainData"));
    if (!chain) throw new Error(`DefiLlama does not know the chain "${query.slice(0, 40)}". Use a chain id such as base, ethereum or solana.`);
    return chain;
  };
  const metered = (sessionId: string, read: () => Promise<string>) =>
    dependencies.research ? dependencies.research.meter(sessionId, read) : read();
  const zeroAddress = "0x0000000000000000000000000000000000000000";
  register({
    name: "load_skills",
    options: { codemode: false },
    description: "Load task skills marked not loaded in the skill list. Their tools and instructions appear on the next step. Does not approve or execute anything.",
    input: z.object({ names: z.array(z.enum(skillNames)).min(1).max(skillNames.length) }),
    execute: ({ names }, toolContext) => dependencies.loadSkills(names, toolContext),
  });
  register({
    name: "ask_user",
    options: { codemode: false },
    description: "Present a concrete recommendation for acceptance or ask for a genuinely missing choice. Retrieve discoverable facts first. Include the full recommendation and rationale in question, because this replaces the final chat reply. Stop this turn and wait for their next message; this never approves a transaction.",
    input: z.object({ question: z.string().trim().min(1).max(1500), options: z.array(z.string().trim().min(1).max(150)).max(6).optional() }),
    execute: async ({ question, options }, toolContext) => ({ content: await capabilities(toolContext.sessionID).askUser(question, options) }),
  });
  register({ name: "aave_skill", options: { codemode: false }, description: "Load one of the five official Aave workflows before using Aave tools.", input: z.object({ name: z.enum(aaveSkillNames) }), execute: async ({ name }) => ({ content: aaveSkill(name) }) });
  register({ name: "aave_schema", options: { codemode: false }, description: "List available Aave tools or get the exact argument schema for one tool.", input: z.object({ name: z.string().optional() }), execute: async ({ name }) => ({ content: JSON.stringify(aaveSchema(name)) }) });
  register({ name: "aave_call", options: { codemode: false }, description: "Call an Aave read, simulation, or prepare_action. Load a skill and schema first. Wallet signing uses the verified sender and Base only.", input: z.object({ name: z.string(), arguments: jsonObjectSchema }), execute: async (input, toolContext) => ({ content: await capabilities(toolContext.sessionID).aaveCall(input.name, input.arguments) }) });
  register({ name: "polymarket_research", options: { codemode: false }, description: "Research public Polymarket odds, history, order books, and positions through Exa. Omit query to check the latest research. Never places bets.", input: z.object({ query: z.string().min(1).max(2000).optional() }), execute: async ({ query }, toolContext) => ({ content: await capabilities(toolContext.sessionID).polymarketResearch(query) }) });
  register({
    name: "wallet_address",
    options: { codemode: false },
    description: "Get the verified X sender's Base smart-wallet address.",
    input: z.object({}),
    execute: async (_input, toolContext) => ({
      content: await capabilities(toolContext.sessionID).walletAddress(),
    }),
  });
  register({
    name: "wallet_balances",
    options: { codemode: false },
    description: "Get balances for the verified X sender's Base smart wallet.",
    input: z.object({}),
    execute: async (_input, toolContext) => ({
      content: await capabilities(toolContext.sessionID).walletBalances(),
    }),
  });
  register({
    name: "deposit_instructions",
    options: { codemode: false },
    description: "Get the user's Whop funding page, bank transfer details, and crypto deposit addresses for adding money to their Pecu wallet. Omit amount unless the user named one in USD.",
    input: z.object({ amount: z.string().regex(/^(?:[1-9]\d*)(?:\.\d{1,2})?$/).optional() }),
    execute: async ({ amount }, toolContext) => ({
      content: await capabilities(toolContext.sessionID).depositInstructions(amount),
    }),
  });
  register({
    name: "deposit_setup",
    options: { codemode: false },
    description: "Create the user's Whop funding account with the email they provided. Only call after the user gave an email.",
    input: z.object({ email: z.string().email().max(254) }),
    execute: async ({ email }, toolContext) => ({
      content: await capabilities(toolContext.sessionID).depositSetup(email),
    }),
  });
  register({
    name: "deposit_status",
    options: { codemode: false },
    description: "List the user's recent deposits and whether the USDC was sent.",
    input: z.object({}),
    execute: async (_input, toolContext) => ({
      content: await capabilities(toolContext.sessionID).depositStatus(),
    }),
  });
  for (const name of polymarketEndpointNames) {
    const endpoint = polymarketEndpoints[name];
    register({
      name: `polymarket_${name}`,
      options: { codemode: false },
      description: endpoint.description,
      input: endpoint.input,
      execute: async (input, toolContext) => ({ content: await capabilities(toolContext.sessionID).polymarketRead(name, input) }),
    });
  }
  for (const name of nansenEndpointNames) {
    const entry = nansenEndpoints[name];
    register({
      name: `nansen_${name}`,
      options: { codemode: false },
      description: entry.description,
      input: entry.input,
      execute: async (input, toolContext) => {
        if (!dependencies.research?.active(toolContext.sessionID)) return { content: await capabilities(toolContext.sessionID).nansenCall(name, input) };
        const query = nansenQuerySchema.parse(input);
        // Research has no user wallet; wallet reads must name the address they inspect.
        if (name.startsWith("wallet_") && !query.address) throw new Error("Give the wallet address from an earlier result.");
        return { content: await metered(toolContext.sessionID, async () => (await service("nansen").call(name, query, { wallet: zeroAddress })).text) };
      },
    });
  }
  for (const name of twitterEndpointNames) {
    const endpoint = twitterEndpoints[name];
    register({
      name: `twitter_${name}`,
      options: { codemode: false },
      description: endpoint.description,
      input: endpoint.input,
      execute: async (input, toolContext) => ({ content: await metered(toolContext.sessionID, async () => (await service("twitter").call(name, jsonValueSchema.parse(input))).text) }),
    });
  }
  for (const name of chainDataEndpointNames) {
    const endpoint = chainDataEndpoints[name];
    register({
      name: `chain_${name}`,
      options: { codemode: false },
      description: endpoint.description,
      input: endpoint.input,
      execute: async (input, toolContext) => ({ content: await metered(toolContext.sessionID, () => chainDataTool(service("chainData"), resolveChain, name, jsonValueSchema.parse(input))) }),
    });
  }
  const research = dependencies.research;
  if (research) {
    register({ name: "research_findings", options: { codemode: false }, description: "Submit this specialist's structured findings. Call once, at the end.", input: findingsSchema, execute: async (input, toolContext) => research.submit(toolContext.sessionID, jsonValueSchema.parse(input)) });
    register({ name: "research_report", options: { codemode: false }, description: "Submit the finished causal report. Call once.", input: reportSchema, execute: async (input, toolContext) => research.submit(toolContext.sessionID, jsonValueSchema.parse(input)) });
  }
  register({
    name: "research_start",
    options: { codemode: false },
    description: "Start a research run that explains why a chain moved over a window, with specialist agents and an editor. Takes several minutes and counts toward the user's daily limit. Only when the user asked for research or a deep explanation.",
    input: z.strictObject({ chain: z.string().trim().min(2).max(60).describe("Chain id or name, for example base, ethereum or solana."), window: researchWindowSchema.default("7d") }),
    execute: async ({ chain, window }, toolContext) => ({ content: await capabilities(toolContext.sessionID).researchStart(chain, window) }),
  });
  register({ name: "research_list", options: { codemode: false }, description: "List the user's research runs with code, chain, state, headline and today's remaining runs.", input: z.object({}), execute: async (_input, toolContext) => ({ content: await capabilities(toolContext.sessionID).researchList() }) });
  register({ name: "research_get", options: { codemode: false }, description: "Read one research run: the full report when finished, otherwise its progress.", input: z.strictObject({ code: researchCodeSchema }), execute: async ({ code }, toolContext) => ({ content: await capabilities(toolContext.sessionID).researchGet(code) }) });
  register({ name: "research_cancel", options: { codemode: false }, description: "Cancel a running research run by its code.", input: z.strictObject({ code: researchCodeSchema }), execute: async ({ code }, toolContext) => ({ content: await capabilities(toolContext.sessionID).researchCancel(code) }) });
  for (const tool of aeroTools) {
    register({
      name: tool.name,
      options: { codemode: false },
      description: tool.description,
      input: tool.input,
      execute: async (input, toolContext) => {
        const bound = capabilities(toolContext.sessionID);
        const parameters = Object.fromEntries(Object.entries(input).flatMap(([key, value]) => value === undefined ? [] : [[key, value]])) satisfies SugarParameters;
        return { content: isSugarTxAction(tool.action)
          ? await bound.aeroPropose(tool.action, parameters)
          : await bound.aeroRead(tool.action, parameters) };
      },
    });
  }
  register({
    name: "aero_liquidity",
    options: { codemode: false },
    description: "Fund a concentrated-liquidity position from ONE total token budget, including a funding swap, approvals and deposit in one Pecu smart-wallet batch. Use after the user specifies the pool/pair and budget, including half my ETH as fraction bps 5000. Reads live balances and pool price, computes token amounts, and defaults to a range 20 percent below/above spot. ETH funds WETH pools without a separate wrap. Only ask for budget and pool preference; do not ask users for tick spacing, token split, or initial price. For an existing-pool position, use selection kind discover with token0 and token1 immediately when pair and budget are known; no balance or pool lookup is needed first. Discovery ranks up to eight matching catalog pools by fresh TVL. Use kind pool for an explicit pool address and for explicit price ranges. Reserve kind pair for a specifically requested new pool, using verified token order, supported tick spacing and initial market price. Explicit ranges are token1 per token0. Previews with confirmation; may execute when YOLO is on. Not supported for linked external wallets.",
    input: liquidityRequestSchema,
    execute: async (input, toolContext) => ({ content: await capabilities(toolContext.sessionID).liquidity(input), metadata: { pecu_direct_reply: true } }),
  });
  register({
    name: "aero_stock_trades",
    options: { codemode: false },
    description: "Propose several tokenized stock buys and sells as one transaction with one confirmation. Use this whenever one message asks for more than one stock trade, for example $1 of NVDAc and $1 of AAPLc. Base mainnet only. Never executes a transaction.",
    input: z.strictObject({
      trades: z.array(stockTradeSchema).min(1).max(8).describe("One entry per trade. Buy amounts are USDC to spend in human units; sell amounts are stock token units."),
      slippage: z.number().gt(0).lt(1).optional().describe("Fraction, for example 0.005 means 0.5 percent. Omit to use the configured maximum."),
    }),
    execute: async ({ trades, slippage }, toolContext) => ({
      content: await capabilities(toolContext.sessionID).stockTrades(trades, slippage),
    }),
  });
  register({
    name: "task_create",
    options: { codemode: false },
    description: "Schedule an automation in this chat: a reminder, a recurring or one-time agent run, a heartbeat checklist, or a price alert. Use the user's own words for instruction. Set grant only when the user explicitly asked Pecu to execute transactions without asking; it stays a request until the user approves it. Never executes anything now.",
    input: taskCreateInputSchema,
    execute: async (input, toolContext) => ({ content: await capabilities(toolContext.sessionID).taskCreate(input) }),
  });
  register({
    name: "task_list",
    options: { codemode: false },
    description: "List the user's automations with code, title, mode, state, schedule, next run, full instruction, allowance and whether each belongs to this chat. Read it before editing or deleting one the user describes in words.",
    input: z.object({}),
    execute: async (_input, toolContext) => ({ content: await capabilities(toolContext.sessionID).taskList() }),
  });
  register({
    name: "task_update",
    options: { codemode: false },
    description: "Edit, pause, resume, delete or run now an automation by its code. edit takes only the fields that change: title, mode, instruction, trigger, grant, or remove_grant. Changing the instruction, mode or grant sends the allowance back for the user's approval. Cannot approve allowances.",
    input: taskUpdateInputSchema,
    execute: async (input, toolContext) => ({ content: await capabilities(toolContext.sessionID).taskUpdate(input) }),
  });
  for (const tool of evmTools) {
    register({
      name: tool.name,
      options: { codemode: false },
      description: tool.description,
      input: tool.input,
      execute: async (input, toolContext) => ({
        content: await tool.execute(capabilities(toolContext.sessionID), jsonValueSchema.parse(input)),
      }),
    });
  }
}
