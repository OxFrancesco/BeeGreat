import type { SugarAction, SugarParameters, SugarTxAction } from "@beegreat/sugar/contracts";
import type { VerifiedMessage } from "./domain";
import type { EvmService, EvmTxAction } from "./evm";

type EvmReadInput<K extends "read" | "inspect" | "decode"> = Parameters<EvmService[K]>[0];

export type AgentCapabilities = Readonly<{
  yoloEnabled(): boolean;
  aaveCall(name: string, args: Record<string, unknown>): Promise<string>;
  polymarketResearch(query?: string): Promise<string>;
  walletAddress(): Promise<string>;
  walletBalances(): Promise<string>;
  aeroRead(action: Exclude<SugarAction, SugarTxAction>, parameters: SugarParameters): Promise<string>;
  aeroPropose(action: SugarTxAction, parameters: SugarParameters): Promise<string>;
  evmToken(token: string): Promise<string>;
  evmAllowance(token: string, spender: `0x${string}`): Promise<string>;
  evmRead(input: EvmReadInput<"read">): Promise<string>;
  evmInspect(input: EvmReadInput<"inspect">): Promise<string>;
  evmDecode(input: EvmReadInput<"decode">): Promise<string>;
  evmPropose(action: EvmTxAction, parameters: unknown): Promise<string>;
}>;

export interface AgentHarness {
  respond(message: VerifiedMessage, capabilities: AgentCapabilities): Promise<string>;
}
