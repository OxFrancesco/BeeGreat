import type { AgentServices } from "../../src/agent";
import type { AeroResult } from "../../src/aerodrome";
import type { EvmPlanResult, EvmReadResult } from "../../src/evm";
import type { UserOperationOutcome } from "../../src/receipt";
import type { WalletTransaction } from "../../src/wallet";

const unexpected = (what: string) => async (): Promise<never> => { throw new Error(`unexpected ${what}`); };

export const unusedEvm: AgentServices["evm"] = {
  tokenBalance: unexpected("evm tokenBalance"),
  allowance: unexpected("evm allowance"),
  read: unexpected("evm read"),
  inspect: unexpected("evm inspect"),
  decode: unexpected("evm decode"),
  propose: unexpected("evm propose"),
};

export function evmStub(overrides: Partial<{ propose: EvmPlanResult; read: EvmReadResult }>): AgentServices["evm"] {
  return {
    ...unusedEvm,
    ...(overrides.propose ? { propose: async () => overrides.propose as EvmPlanResult } : {}),
    ...(overrides.read ? { tokenBalance: async () => overrides.read as EvmReadResult, allowance: async () => overrides.read as EvmReadResult } : {}),
  };
}

export const confirmedOutcome = (hash = "0xabc"): UserOperationOutcome => ({ status: "confirmed", hash, block: "1", gasUsed: "1" });

export const pendingOutcome: UserOperationOutcome = { status: "pending" };

export function services(overrides: Partial<AgentServices> & { aero?: AeroResult }): AgentServices {
  return {
    aerodrome: overrides.aerodrome ?? { run: async () => { if (!overrides.aero) throw new Error("unexpected aero call"); return overrides.aero; } },
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
