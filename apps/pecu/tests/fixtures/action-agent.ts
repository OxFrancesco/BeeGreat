import { encodeFunctionData, erc20Abi } from "viem";
import { PecuAgent } from "../../src/agent";
import { evmTxParameterSchemas } from "../../src/evm";
import type { AgentHarness } from "../../src/harness";
import type { PecuStore } from "../../src/state";
import type { WalletTransaction } from "../../src/wallet";
import { services, unusedWalletActions, confirmedOutcome, awaitingApproval, submittedTransaction } from "./agent-services";

const wallet = "0x1111111111111111111111111111111111111111";
const usdc = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

export function actionAgent(store: PecuStore, harness: AgentHarness, pending = false) {
  const records = new Map<string, WalletTransaction>();
  const approvals: string[] = [];
  const reads: string[] = [];
  let prepared = 0;
  const agent = new PecuAgent(
    { enableMainnetExecution: true, maxSlippageBps: 100, quoteTtlSeconds: 120, depositRelayMaxUsd: 500, depositRelayDailyMaxUsd: 2000 }, store,
    {
      ...unusedWalletActions, getOrCreate: async () => ({ address: wallet }),
      balances: async () => { reads.push("balances"); return "ETH: 1\nUSDC: 20"; },
      prepare: async () => { const id = `tx-${++prepared}`; records.set(id, awaitingApproval(id, wallet)); return { transactionId: id }; },
      approve: async (_sender, id) => { approvals.push(id); records.set(id, submittedTransaction(id, wallet, `0x${approvals.length.toString(16).padStart(64, "0")}`)); return { hash: records.get(id)?.hash }; },
      transaction: async (_sender, id) => { const record = records.get(id); if (!record) throw new Error("Missing fixture transaction"); return record; },
    },
    services({
      evm: { ...services({}).evm,
        tokenBalance: async (_wallet, token) => { reads.push(token); return { kind: "read", command: "token", output: { token: usdc, symbol: "USDC", decimals: 6, amount: "20000000", block: "1" } }; },
        propose: async (_wallet, action, input) => {
          if (action !== "transfer") throw new Error("Only fixture USDC transfers are supported");
          const parameters = evmTxParameterSchemas.transfer.parse(input);
          if (parameters.token !== "USDC") throw new Error("Only fixture USDC transfers are supported");
          return { kind: "transaction", action, parameters, summary: `Send ${parameters.amount} USDC to ${parameters.to}`, context: {}, calls: [{ role: "action", from: wallet, to: usdc, data: encodeFunctionData({ abi: erc20Abi, functionName: "transfer", args: [parameters.to, BigInt(parameters.amount) * 1_000_000n] }), value: "0" }] };
        },
      },
      verifyUserOperation: async reference => pending ? { status: "pending" } : confirmedOutcome(reference.hash),
    }), harness,
  );
  return { agent, approvals, reads };
}
