import type { JsonInput, JsonFields } from "./json-contract";
import type { PolymarketEndpointName } from "./integrations/polymarket/catalog.generated";
import type { SafeReadCommand } from "./safe";
import type { SugarAction, SugarParameters, SugarTxAction } from "@beegreat/sugar/contracts";
import type { VerifiedMessage } from "./domain";
import type { EvmService, EvmTxAction } from "./evm";
import type { NansenEndpointName, NansenQuery } from "./integrations/nansen";
import type { LiquidityRequest } from "./liquidity-contract";
import type { StockTrade } from "./stock-contract";
import type { ParagraphSink } from "./web-stream";
import type { ToolFamily } from "./tool-families";

type EvmReadInput<K extends "read" | "inspect" | "decode"> = Parameters<EvmService[K]>[0];

export type AgentCapabilities = Readonly<{
  yoloEnabled(): boolean;
  askUser(question: string, options?: readonly string[]): Promise<string>;
  aaveCall(name: string, args: JsonFields): Promise<string>;
  polymarketResearch(query?: string): Promise<string>;
  polymarketRead(endpoint: PolymarketEndpointName, input: JsonInput): Promise<string>;
  walletAddress(): Promise<string>;
  walletBalances(): Promise<string>;
  aeroRead(action: Exclude<SugarAction, SugarTxAction>, parameters: SugarParameters): Promise<string>;
  aeroPropose(action: SugarTxAction, parameters: SugarParameters): Promise<string>;
  liquidity(request: LiquidityRequest): Promise<string>;
  stockTrades(trades: readonly StockTrade[], slippage?: number): Promise<string>;
  evmToken(token: string): Promise<string>;
  evmAllowance(token: string, spender: `0x${string}`): Promise<string>;
  evmRead(input: EvmReadInput<"read">): Promise<string>;
  evmInspect(input: EvmReadInput<"inspect">): Promise<string>;
  evmDecode(input: EvmReadInput<"decode">): Promise<string>;
  safeRead(command: SafeReadCommand, input: JsonFields): Promise<string>;
  safeQueue(safe: `0x${string}`): Promise<string>;
  evmPropose(action: EvmTxAction, parameters: JsonInput): Promise<string>;
  depositInstructions(amount?: string): Promise<string>;
  depositSetup(email: string): Promise<string>;
  depositStatus(): Promise<string>;
  nansenCall(endpoint: NansenEndpointName, input: NansenQuery): Promise<string>;
}>;

export type ResponseMode = "response" | "mixed" | Readonly<{ kind: "mixed"; family: ToolFamily }>;

export interface AgentHarness {
  warm?(senderId: string): Promise<void>;
  /** `progress` receives finished paragraphs while the model is still writing; channels that cannot show partial replies omit it. */
  respond(message: VerifiedMessage, capabilities: AgentCapabilities, mode?: ResponseMode, progress?: ParagraphSink): Promise<string>;
}
