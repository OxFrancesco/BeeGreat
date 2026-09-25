import type { AgentServices, AgentWallets } from "../../src/agent";
import type { AeroResult, StockBasketPlanResult } from "../../src/aerodrome";
import type { EvmPlanResult, EvmReadResult } from "../../src/evm";
import type { UserOperationOutcome } from "../../src/receipt";
import type { WalletTransaction } from "../../src/wallet";

const unexpected = (what: string) => async (): Promise<never> => { throw new Error(`unexpected ${what}`); };

export const unusedEvm: AgentServices["evm"] = {
  tokenBalance: unexpected("evm tokenBalance"),
  allowance: unexpected("evm allowance"),
  read: unexpected("evm read"),
  safeRead: unexpected("Safe read"),
  inspect: unexpected("evm inspect"),
  decode: unexpected("evm decode"),
  propose: unexpected("evm propose"),
};

export function evmStub(overrides: Partial<{ propose: EvmPlanResult; read: EvmReadResult }>): AgentServices["evm"] {
  const result = { ...unusedEvm };
  const { propose, read } = overrides;
  if (propose) result.propose = async () => propose;
  if (read) {
    result.tokenBalance = async () => read;
    result.allowance = async () => read;
  }
  return result;
}

export const confirmedOutcome = (hash = "0xabc"): UserOperationOutcome => ({ status: "confirmed", hash, block: "1", gasUsed: "1" });

export const pendingOutcome: UserOperationOutcome = { status: "pending" };

export function services(overrides: Partial<AgentServices> & { aero?: AeroResult; basket?: StockBasketPlanResult }): AgentServices {
  const { aero: _aero, basket: _basket, ...serviceOverrides } = overrides;
  return {
    ...serviceOverrides,
    aerodrome: overrides.aerodrome ?? {
      run: async () => { if (!overrides.aero) throw new Error("unexpected aero call"); return overrides.aero; },
      basket: async () => { if (!overrides.basket) throw new Error("unexpected aero basket call"); return overrides.basket; },
    },
    evm: overrides.evm ?? unusedEvm,
    verifyUserOperation: overrides.verifyUserOperation ?? (async (reference) => confirmedOutcome(reference.hash)),
  };
}

/** Crossmint record for a transaction that has already been approved and submitted. */
export function submittedTransaction(id: string, sender: string, hash = "0xabc"): WalletTransaction {
  return { id, status: "success", hash, userOperationHash: `0x${"11".repeat(32)}`, sender };
}

export function awaitingApproval(id: string, sender: string): WalletTransaction {
  return { id, status: "awaiting-approval", userOperationHash: `0x${"11".repeat(32)}`, sender };
}

/** Fail immediately if a read-only wallet fixture starts preparing or submitting a transaction. */
export const unusedWalletActions = {
  usdcBalanceUnits: unexpected("USDC balance"),
  prepare: unexpected("wallet prepare"),
  approve: unexpected("wallet approval"),
  transaction: unexpected("wallet transaction"),
} satisfies Pick<AgentWallets, "usdcBalanceUnits" | "prepare" | "approve" | "transaction">;

/** Unused tools fail instead of silently returning successful fixture data. */
export const unusedCapabilities = {
  yoloEnabled: () => false,
  askUser: unexpected("askUser"),
  aaveCall: unexpected("aaveCall"),
  polymarketResearch: unexpected("polymarketResearch"),
  polymarketRead: unexpected("polymarketRead"),
  walletAddress: unexpected("walletAddress"),
  walletBalances: unexpected("walletBalances"),
  aeroRead: unexpected("aeroRead"),
  aeroPropose: unexpected("aeroPropose"),
  stockTrades: unexpected("stockTrades"),
  evmToken: unexpected("evmToken"),
  evmAllowance: unexpected("evmAllowance"),
  evmRead: unexpected("evmRead"),
  evmInspect: unexpected("evmInspect"),
  evmDecode: unexpected("evmDecode"),
  safeRead: unexpected("safeRead"),
  safeQueue: unexpected("safeQueue"),
  evmPropose: unexpected("evmPropose"),
  depositInstructions: unexpected("depositInstructions"),
  depositSetup: unexpected("depositSetup"),
  depositStatus: unexpected("depositStatus"),
  nansenCall: unexpected("nansenCall"),
} satisfies import("../../src/harness").AgentCapabilities;
