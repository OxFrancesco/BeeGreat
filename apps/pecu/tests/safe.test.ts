import { expect, test } from "bun:test";
import { concatHex, encodeFunctionData, padHex, zeroAddress } from "viem";
import { safeTransactionHash } from "../../../packages/evm/src/safe/transactions";
import { safeAbi, factoryAbi } from "../../../packages/evm/src/safe/contracts";
import { validateIntentPlan } from "../src/policy";
import { safeParameterSchemas } from "../src/safe";
import { EvmService } from "../src/evm";
import { evmTools } from "../src/cloudflare/evm-tools";
import { evmRequestSchema } from "../src/cloudflare/evm-protocol";
import type { PlannedCall } from "../src/domain";

const wallet = "0x1111111111111111111111111111111111111111";
const safe = "0x2222222222222222222222222222222222222222";
const recipient = "0x3333333333333333333333333333333333333333";
const tx = { chainId: 8453, safe, to: recipient, value: "1", data: "0x", nonce: "0" } as const;
const transaction = { ...tx, hash: safeTransactionHash(tx) };
const approveCall: PlannedCall = { from: wallet, to: safe, data: encodeFunctionData({ abi: safeAbi, functionName: "approveHash", args: [transaction.hash] }), value: "0", role: "action" };

const approval = { family: "evm", action: "safe_approve", parameters: { transaction } } as const;

test("Pecu Safe approval is bound to the exact SDK proposal and verified sender", () => {
  expect(() => validateIntentPlan(approval, wallet, [approveCall])).not.toThrow();
  expect(() => validateIntentPlan(approval, wallet, [{ ...approveCall, from: recipient }])).toThrow("wrong sender");
  expect(() => validateIntentPlan(approval, wallet, [{ ...approveCall, to: recipient }])).toThrow("reviewed proposal");
  expect(() => validateIntentPlan({ ...approval, parameters: { transaction: { ...transaction, value: "2" } } }, wallet, [approveCall])).toThrow("reviewed proposal");
  expect(() => validateIntentPlan(approval, wallet, [{ ...approveCall, value: "1" }])).toThrow("zero value");
});

test("Pecu rejects Safe execution that changes the inner call, refunds or operation", () => {
  const signatures = concatHex([padHex(wallet, { size: 32 }), padHex("0x", { size: 32 }), "0x01"]);
  const encode = (to: `0x${string}` = recipient, operation = 0, gasPrice = 0n) => encodeFunctionData({ abi: safeAbi, functionName: "execTransaction", args: [to, 1n, "0x", operation, 0n, 0n, gasPrice, zeroAddress, zeroAddress, signatures] });
  const intent = { ...approval, action: "safe_execute" } as const;
  expect(() => validateIntentPlan(intent, wallet, [{ ...approveCall, data: encode() }])).not.toThrow();
  for (const data of [encode(safe), encode(recipient, 1), encode(recipient, 0, 1n)]) {
    expect(() => validateIntentPlan(intent, wallet, [{ ...approveCall, data }])).toThrow("reviewed proposal");
  }
});

test("Pecu validates the Safe deployment owners, threshold and initializer", () => {
  const parameters = safeParameterSchemas.safe_create.parse({ owners: [wallet, recipient], threshold: 2, saltNonce: "7" });
  const encode = (threshold = 2, target: `0x${string}` = zeroAddress) => encodeFunctionData({ abi: factoryAbi, functionName: "createProxyWithNonce", args: ["0x29fcB43b46531BcA003ddC8FCB67FFE91900C762", encodeFunctionData({ abi: safeAbi, functionName: "setup", args: [parameters.owners, BigInt(threshold), target, "0x", zeroAddress, zeroAddress, 0n, zeroAddress] }), 7n] });
  const intent = { family: "evm", action: "safe_create", parameters } as const;
  const call: PlannedCall = { ...approveCall, to: "0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67", data: encode() };
  expect(() => validateIntentPlan(intent, wallet, [call])).not.toThrow();
  for (const data of [encode(1), encode(2, recipient)]) expect(() => validateIntentPlan(intent, wallet, [{ ...call, data }])).toThrow("reviewed proposal");
});

test("Safe tools are shared and sandbox commands remain unsigned", () => {
  expect(evmTools.filter(tool => tool.name.startsWith("safe_")).map(tool => tool.name)).toHaveLength(8);
  for (const command of ["safe-info", "safe-propose", "safe-approve", "safe-execute", "safe-deploy"]) expect(evmRequestSchema.safeParse({ command, input: {} }).success).toBe(true);
  for (const command of ["execute", "sign-typed-data", "wallet-connect"]) expect(evmRequestSchema.safeParse({ command, input: {} }).success).toBe(false);
  const create = evmTools.find(tool => tool.name === "safe_create");
  expect(create?.input.safeParse({ owners: [wallet], threshold: 1, account: recipient }).success).toBe(false);
});

test("Safe service always uses the verified wallet and Base when preparing an approval", async () => {
  const seen: Array<{ command: string; input: Record<string, unknown> }> = [];
  const service = new EvmService(async (command, input) => {
    seen.push({ command, input });
    return { plan: { chainId: 8453, account: wallet, to: safe, value: "0", data: approveCall.data, fingerprint: transaction.hash, expiresAt: Date.now() + 60_000, simulationBlock: "100", gas: "90000", gasPrice: "1" }, state: { _tag: "prepared" } };
  });
  const result = await service.propose(wallet, "safe_approve", { transaction });
  expect(seen[0]).toMatchObject({ command: "safe-approve", input: { chainId: 8453, account: wallet, transaction } });
  expect(result.summary).toContain("does not execute");
  expect(result.calls).toEqual([approveCall]);
  await expect(service.propose(wallet, "safe_approve", { transaction, account: recipient })).rejects.toThrow();
});
