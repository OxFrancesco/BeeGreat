import type { PolymarketEndpointName } from "./integrations/polymarket/catalog.generated";
import type { SafeReadCommand } from "./safe";
import type { SugarAction, SugarParameters, SugarTxAction } from "@beegreat/sugar/contracts";
import type { VerifiedMessage } from "./domain";
import type { EvmService, EvmTxAction } from "./evm";
import type { NansenEndpointName } from "./integrations/nansen";
import type { StockTrade } from "./stock-contract";
import type { ParagraphSink } from "./web-stream";

type EvmReadInput<K extends "read" | "inspect" | "decode"> = Parameters<EvmService[K]>[0];

export type AgentCapabilities = Readonly<{
  yoloEnabled(): boolean;
  askUser(question: string, options?: readonly string[]): Promise<string>;
  aaveCall(name: string, args: Record<string, unknown>): Promise<string>;
  polymarketResearch(query?: string): Promise<string>;
  polymarketRead(endpoint: PolymarketEndpointName, input: unknown): Promise<string>;
  walletAddress(): Promise<string>;
  walletBalances(): Promise<string>;
  aeroRead(action: Exclude<SugarAction, SugarTxAction>, parameters: SugarParameters): Promise<string>;
  aeroPropose(action: SugarTxAction, parameters: SugarParameters): Promise<string>;
  stockTrades(trades: readonly StockTrade[], slippage?: number): Promise<string>;
  evmToken(token: string): Promise<string>;
  evmAllowance(token: string, spender: `0x${string}`): Promise<string>;
  evmRead(input: EvmReadInput<"read">): Promise<string>;
  evmInspect(input: EvmReadInput<"inspect">): Promise<string>;
  evmDecode(input: EvmReadInput<"decode">): Promise<string>;
  safeRead(command: SafeReadCommand, input: Record<string, unknown>): Promise<string>;
  safeQueue(safe: `0x${string}`): Promise<string>;
  evmPropose(action: EvmTxAction, parameters: unknown): Promise<string>;
  depositInstructions(amount?: string): Promise<string>;
  depositSetup(email: string): Promise<string>;
  depositStatus(): Promise<string>;
  nansenCall(endpoint: NansenEndpointName, input: unknown): Promise<string>;
}>;

export type ResponseMode = "response" | "mixed";

export interface AgentHarness {
  /** `progress` receives finished paragraphs while the model is still writing; channels that cannot show partial replies omit it. */
  respond(message: VerifiedMessage, capabilities: AgentCapabilities, mode?: ResponseMode, progress?: ParagraphSink): Promise<string>;
}
