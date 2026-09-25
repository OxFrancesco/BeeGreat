import { jsonValueSchema, type JsonInput, type JsonFields } from "../json-contract";
import { z } from "zod";
import { decodeFunctionData, encodeFunctionData, erc20Abi, formatUnits, parseUnits } from "viem";
import tools from "./aave-tools.json";
import skills from "./aave-skills.json";
import type { PlannedCall } from "../domain";

export const aaveSkillNames = ["safe-transactions", "yield-analysis", "deleverage", "account-activity", "tx-confirmation"] as const;
export function aaveSkill(name: typeof aaveSkillNames[number]): string {
  return `${skills[name]}\n\nPecu integration: use aave_schema to inspect a tool and aave_call to call it. The verified sender wallet is supplied by the bot. Signing is supported only on Base v3 through prepare_action, with Pecu confirmation or explicit YOLO. A required approval is its own preview; after it confirms, ask to continue the original action. Reads may compare other chains, but label the coverage. Do not imply unsupported prepared actions can execute here. Normal replies contain human amounts, warnings, and the confirmation instructions, not JSON.`;
}
export function aaveSchema(name?: string) {
  if (!name) return tools.map(({ name, description }) => ({ name, description }));
  const tool = tools.find((item) => item.name === name);
  if (!tool) throw new Error("That Aave tool is not supported by Pecu.");
  return tool;
}
const address = z.templateLiteral(["0x", z.string().regex(/^[0-9a-fA-F]{40}$/)]);
export const aaveParameters = z.object({
  action: z.enum(["supply", "borrow", "withdraw", "repay"]),
  chainId: z.literal(8453), version: z.literal("v3"), sender: address,
  market: address, token: address, amount: z.string().regex(/^(?:0|[1-9]\d*)(?:\.\d+)?$/).optional(),
  max: z.boolean().optional(), native: z.boolean().optional(), enableCollateral: z.boolean().optional(),
}).strict();
export const aaveIntentParameters = aaveParameters.extend({ stage: z.enum(["approval", "action"]) });
export type AaveParameters = z.infer<typeof aaveIntentParameters>;
const transaction = z.object({
  __typename: z.literal("TransactionRequest"), chainId: z.literal(8453), from: address, to: address,
  data: z.templateLiteral(["0x", z.string().regex(/^(?:[0-9a-fA-F]{2}){4,}$/)]), value: z.string().regex(/^\d+$/),
});
const envelope = z.object({ data: jsonValueSchema, warnings: z.array(z.object({ level: z.string(), message: z.string() }).catchall(jsonValueSchema)).optional() }).catchall(jsonValueSchema);
export type AavePlan = { parameters: AaveParameters; calls: PlannedCall[]; preview: string; details: JsonInput };

export class AaveService {
  constructor(private readonly request: typeof fetch = fetch) {}
  async call(name: string, input: JsonFields, wallet: string): Promise<JsonInput> {
    const tool = tools.find((item) => item.name === name);
    if (!tool) throw new Error("That Aave tool is not supported by Pecu.");
    if (name === "prepare_action") throw new Error("Aave transactions must use the transaction preview flow.");
    const args = { ...input };
    if ("sender" in tool.inputSchema.properties) args.sender = wallet;
    if ("user" in tool.inputSchema.properties && !args.user) args.user = wallet;
    // SAFETY: this pinned JSON Schema snapshot is checked by fromJSONSchema; JSON imports widen its type keyword to string.
    const schema = z.fromJSONSchema(tool.inputSchema as Parameters<typeof z.fromJSONSchema>[0]);
    return this.rpc(name, jsonValueSchema.parse(schema.parse(args)));
  }
  private async rpc(name: string, args: JsonInput): Promise<JsonInput> {
    const response = await this.request.call(globalThis, "https://mcp.aave.com", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) throw new Error(`Aave is unavailable right now (${response.status}).`);
    const parsed = z.object({ error: jsonValueSchema.optional(), result: z.object({ isError: z.boolean().optional(), structuredContent: jsonValueSchema.optional(), content: z.array(z.object({ type: z.string(), text: z.string().optional() })).optional() }).optional() }).parse(await response.json());
    if (parsed.error || !parsed.result || parsed.result.isError) throw new Error("Aave couldn't complete that request. Check the market and amount.");
    const output = parsed.result.structuredContent ?? JSON.parse(parsed.result.content?.find((item) => item.type === "text")?.text ?? "null");
    return jsonValueSchema.parse(output);
  }
  async propose(input: JsonFields, wallet: string): Promise<AavePlan> {
    if (input.chainId !== undefined && input.chainId !== 8453 || input.version !== undefined && input.version !== "v3") throw new Error("Aave transactions in Pecu use Base v3 only.");
    const parameters = aaveParameters.parse({ ...input, sender: wallet, chainId: 8453, version: "v3" });
    if (!parameters.max && (!parameters.amount || /^0(?:\.0*)?$/.test(parameters.amount))) throw new Error("Choose a positive amount, or use max for a withdrawal or repayment.");
    if (parameters.max && parameters.action !== "withdraw" && parameters.action !== "repay") throw new Error("Max is only available for withdrawing or repaying.");
    const markets = envelope.parse(await this.rpc("get_markets", { version: "v3", chainId: 8453, user: wallet }));
    const discovered = z.object({ v3: z.object({ markets: z.array(z.object({ market: address, chainId: z.number(), reserves: z.array(z.object({ underlyingToken: address, symbol: z.string() }).catchall(jsonValueSchema)) })) }) }).parse(markets.data);
    const selected = discovered.v3.markets.find((item) => item.chainId === 8453 && item.market.toLowerCase() === parameters.market.toLowerCase())?.reserves.find((item) => item.underlyingToken.toLowerCase() === parameters.token.toLowerCase());
    if (!selected) throw new Error("That Aave market or token is not available on Base. Refresh the markets first.");
    const [account, reserve] = await Promise.all([
      this.rpc("get_user_summary", { version: "v3", chainId: 8453, user: wallet }),
      this.rpc("get_reserve_details", { version: "v3", chainId: 8453, market: parameters.market, token: parameters.token }),
    ]);
    const simulated = envelope.parse(await this.rpc("preview_action", parameters));
    if (simulated.warnings?.some((warning) => warning.level.toLowerCase() === "error")) throw new Error("Aave's simulation says this action cannot proceed. Adjust the amount or position first.");
    const built = envelope.parse(await this.rpc("prepare_action", parameters));
    const raw = z.object({ __typename: z.string() }).catchall(jsonValueSchema).parse(built.data);
    let phase: string = parameters.action;
    let txs: JsonInput[];
    if (raw.__typename === "TransactionRequest") txs = [raw];
    else if (raw.__typename === "ApprovalRequired" || raw.__typename === "Erc20ApprovalRequired") { txs = [raw.approval ?? raw.byTransaction]; phase = "token approval"; }
    else if (raw.__typename === "PreContractActionRequired") txs = [raw.transaction, raw.originalTransaction];
    else throw new Error("Aave could not build this action. Check your balance and position.");
    let approvalLimit: string | undefined;
    const calls = txs.map((item, index): PlannedCall => {
      const tx = transaction.parse(item);
      if (tx.from.toLowerCase() !== wallet.toLowerCase()) throw new Error("Aave returned a transaction for a different wallet.");
      if (phase === "token approval" && (tx.value !== "0" || !tx.data.toLowerCase().startsWith("0x095ea7b3"))) throw new Error("Aave returned an invalid approval transaction.");
      if (phase === "token approval") {
        const approved = decodeFunctionData({ abi: erc20Abi, data: tx.data });
        if (tx.to.toLowerCase() !== parameters.token.toLowerCase() || approved.functionName !== "approve" || approved.args[0].toLowerCase() !== parameters.market.toLowerCase()) throw new Error("Aave returned an approval for a different token or spender.");
        const required = z.object({ raw: z.string().regex(/^[1-9]\d*$/), decimals: z.number().int().min(0).max(255) }).parse(raw.requiredAmount);
        const amount = BigInt(required.raw);
        if (amount > approved.args[1] || (!parameters.max && parseUnits(parameters.amount!, required.decimals) !== amount)) throw new Error("Aave returned an approval amount that does not match this action.");
        tx.data = encodeFunctionData({ abi: erc20Abi, functionName: "approve", args: [approved.args[0], amount] });
        approvalLimit = `${formatUnits(amount, required.decimals)} ${selected.symbol}`;
      }
      return { from: tx.from, to: tx.to, data: tx.data, value: tx.value, role: index < txs.length - 1 ? "approval" : "action" };
    });
    const health = z.object({ healthFactorAfter: jsonValueSchema.optional() }).catchall(jsonValueSchema).safeParse(simulated.data);
    const nestedWarnings = z.array(z.object({ level: z.string(), message: z.string() })).optional().parse(raw.warnings);
    const warnings = [...simulated.warnings ?? [], ...built.warnings ?? [], ...nestedWarnings ?? []];
    if (warnings.some((warning) => warning.level.toLowerCase() === "error")) throw new Error("Aave blocked this action. Adjust the amount or position first.");
    const preview = [
      `Aave ${phase} on Base. Amount: ${parameters.max ? "full balance" : parameters.amount} ${parameters.native ? "ETH" : selected.symbol}.`,
      `Token: ${parameters.token}`,
      ...(approvalLimit ? [`Spending limit: ${approvalLimit}.`] : []),
      ...(health.success && health.data.healthFactorAfter != null ? [`Health factor after: ${String(health.data.healthFactorAfter)}`] : []),
      ...warnings.map((warning) => `${warning.level}: ${warning.message}`),
      ...(phase === "token approval" ? ["This only approves token spending. After confirmation, ask me to continue the original Aave action."] : []),
      "Network fee: not estimated yet.",
    ].join("\n");
    return { parameters: { ...parameters, stage: phase === "token approval" ? "approval" : "action" }, calls, preview, details: { markets, account, reserve, simulated, built } };
  }
}
