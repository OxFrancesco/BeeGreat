import { strict as assert } from "node:assert";
import { encodeFunctionData, erc20Abi } from "viem";
import { PecuAgent } from "../src/agent";
import { Store } from "../src/store";
import { evmTxParameterSchemas } from "../src/evm";
import type { WalletTransaction } from "../src/wallet";
import type { VerifiedMessage } from "../src/domain";
import { services, unusedWalletActions, confirmedOutcome, awaitingApproval, submittedTransaction } from "../tests/fixtures/agent-services";

const wallet = "0x1111111111111111111111111111111111111111";
const recipient = "0x2222222222222222222222222222222222222222";
const usdc = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const rows: { scenario: string; transactions: number }[] = [];

async function scenario(name: string, options: { yolo: boolean; clarify?: boolean; pending?: boolean; fail?: boolean; retry?: boolean; duplicate?: boolean; questionAfter?: boolean }) {
  const store = new Store(":memory:");
  const records = new Map<string, WalletTransaction>();
  const approved: string[] = [];
  let prepared = 0;
  let turns = 0;
  const results: string[] = [];
  const agent = new PecuAgent(
    { enableMainnetExecution: true, maxSlippageBps: 100, quoteTtlSeconds: 120, depositRelayMaxUsd: 500, depositRelayDailyMaxUsd: 2000 }, store,
    {
      ...unusedWalletActions, getOrCreate: async () => ({ address: wallet }), balances: async () => "ETH: 1\nUSDC: 20",
      prepare: async () => { const id = `tx-${++prepared}`; records.set(id, awaitingApproval(id, wallet)); return { transactionId: id }; },
      approve: async (_sender, id) => { approved.push(id); records.set(id, submittedTransaction(id, wallet, `0x${approved.length.toString(16).padStart(64, "0")}`)); return { hash: records.get(id)?.hash }; },
      transaction: async (_sender, id) => { const record = records.get(id); if (!record) throw new Error("Missing fixture transaction"); return record; },
    },
    services({
      evm: { ...services({}).evm, propose: async (_wallet, action, input) => {
        assert.equal(action, "transfer");
        const parameters = evmTxParameterSchemas.transfer.parse(input);
        return { kind: "transaction", action, parameters, summary: `Send ${parameters.amount} USDC`, context: {}, calls: [{ role: "action", from: wallet, to: usdc, data: encodeFunctionData({ abi: erc20Abi, functionName: "transfer", args: [parameters.to, BigInt(parameters.amount) * 1_000_000n] }), value: "0" }] };
      } },
      verifyUserOperation: async reference => options.pending ? { status: "pending" } : options.fail ? { status: "reverted", hash: reference.hash, block: "1", gasUsed: "1" } : confirmedOutcome(reference.hash),
    }),
    { respond: async (_message, tools) => {
      if (options.clarify && turns++ === 0) return tools.askUser("Send 1, 2 and 3 USDC to the specified recipient?", ["Use this plan", "Cancel"]);
      for (const amount of ["1", "2", "3"]) {
        try { results.push(await tools.evmPropose("transfer", { token: "USDC", to: recipient, amount })); }
        catch (error) { results.push(error instanceof Error ? error.message : String(error)); break; }
      }
      if (options.duplicate) results.push(await tools.evmPropose("transfer", { token: "USDC", to: recipient, amount: "1" }));
      if (options.questionAfter) return tools.askUser("A further action needs a new amount. How much?", ["Cancel"]);
      return results.join("\n\n");
    } },
  );
  store.setYolo("owner", "chat", options.yolo);
  const message = { senderId: "owner", conversationId: "chat", eventId: crypto.randomUUID(), encodedEvent: "", text: "Send 1, 2 and 3 USDC to the specified recipient" };
  try {
    if (options.clarify) await agent.handle({ ...message, eventId: crypto.randomUUID() });
    const request: VerifiedMessage = { ...message, text: options.clarify ? "Use this plan" : message.text, retryContext: options.retry ? "[]" : undefined };
    const reply = await agent.handle(request);
    const expected = !options.yolo || options.retry ? 0 : options.pending || options.fail ? 1 : 3;
    assert.equal(approved.length, expected, `${name}: expected ${expected} transactions from one accepted request; got ${approved.length}. Reply: ${reply}`);
    assert.equal(await agent.handle(request), reply, "Event replay must return its saved response");
    assert.equal(approved.length, expected, "Event replay must not submit again");
    if (options.questionAfter) for (let step = 1; step <= 3; step++) assert(reply?.includes(`0x${step.toString(16).padStart(64, "0")}`), "A later clarification must keep every completed transaction link");
    if (expected === 3) for (let step = 1; step <= 3; step++) assert.equal(store.intentForSource(step === 1 ? message.eventId : `${message.eventId}#${step}`)?.state, "succeeded");
    rows.push({ scenario: name, transactions: approved.length });
    console.log(`${name}: ${approved.length} fixture transactions; replay did not resubmit`);
  } finally { store.close(); }
}

await scenario("YOLO completes three requested actions", { yolo: true });
await scenario("accepted clarification retains YOLO", { yolo: true, clarify: true });
await scenario("YOLO off waits for confirmation", { yolo: false });
await scenario("pending receipt stops dependent actions", { yolo: true, pending: true });
await scenario("reverted receipt stops dependent actions", { yolo: true, fail: true });
await scenario("regeneration stays preview-only", { yolo: true, retry: true });
await scenario("a repeated tool call cannot duplicate a completed action", { yolo: true, duplicate: true });
await scenario("a later question preserves completed receipts", { yolo: true, questionAfter: true });
console.log(JSON.stringify({ scope: "Real PecuAgent message, clarification, persistence, execution and replay paths. Wallet provider and receipts are fixtures. No funds moved.", rows }));
