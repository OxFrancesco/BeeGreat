import { buildSignatureBytes, EthSafeSignature } from "@safe-global/protocol-kit";
import { allowanceAbi, rolesAbi } from "../../../packages/evm/src/safe/module-contracts";
import { decodeSafeBatch as sdkDecodeSafeBatch } from "../../../packages/evm/src/safe/batch";
import { decodeSafeBatch, multiSendAbi } from "../src/safe";
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

const allowanceModule: `0x${string}` = "0xAA46724893dedD72658219405185Fb0Fc91e091C";
const wallet: `0x${string}` = "0x1111111111111111111111111111111111111111";
const safe: `0x${string}` = "0x2222222222222222222222222222222222222222";
const recipient: `0x${string}` = "0x3333333333333333333333333333333333333333";
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
  expect(evmTools.filter(tool => tool.name.startsWith("safe_")).map(tool => tool.name)).toHaveLength(25);
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

test("Budget payments bind the delegate, recipient, amount and zero fee", () => {
  const parameters = { safe, token: recipient, to: wallet, amount: "7" };
  const intent = { family: "evm", action: "safe_budget_spend", parameters } as const;
  const data = encodeFunctionData({ abi: allowanceAbi, functionName: "executeAllowanceTransfer", args: [safe, recipient, wallet, 7n, zeroAddress, 0n, wallet, "0x"] });
  const call = { ...approveCall, to: allowanceModule, data };
  expect(() => validateIntentPlan(intent, wallet, [call])).not.toThrow();
  for (const change of [{ amount: "8" }, { to: recipient }, { safe: recipient }, { token: wallet }]) {
    expect(() => validateIntentPlan({ ...intent, parameters: { ...parameters, ...change } }, wallet, [call])).toThrow("reviewed proposal");
  }
  expect(() => validateIntentPlan(intent, wallet, [{ ...call, to: recipient }])).toThrow();
  expect(() => validateIntentPlan(intent, wallet, [{ ...call, value: "1" }])).toThrow();
});

test("Role execution cannot change its role, target, ETH value or call mode", () => {
  const parameters = { safe, module: recipient, role: `0x${"01".repeat(32)}`, to: wallet, data: "0x12345678" };
  const intent = { family: "evm", action: "safe_role_execute", parameters } as const;
  const encode = (value = 0n, mode = 0, role = parameters.role, revert = true) => encodeFunctionData({ abi: rolesAbi, functionName: "execTransactionWithRole", args: [wallet, value, "0x12345678", mode, role as `0x${string}`, revert] });
  const call = { ...approveCall, to: recipient, data: encode() };
  expect(() => validateIntentPlan(intent, wallet, [call])).not.toThrow();
  for (const data of [encode(1n), encode(0n, 1), encode(0n, 0, `0x${"02".repeat(32)}`), encode(0n, 0, parameters.role, false)]) {
    expect(() => validateIntentPlan(intent, wallet, [{ ...call, data }])).toThrow();
  }
});

test("Safe batches decode identically across SDK and Pecu and refuse inner delegatecall", () => {
  const pack = (operation: `0x${string}` = "0x00") => encodeFunctionData({ abi: multiSendAbi, functionName: "multiSend", args: [concatHex([operation, recipient, padHex("0x01", { size: 32 }), padHex("0x", { size: 32 })])] });
  expect(decodeSafeBatch(pack())).toEqual([{ to: recipient, value: "1", data: "0x" }]);
  expect(decodeSafeBatch(pack())).toEqual(sdkDecodeSafeBatch(pack()));
  for (const decoder of [decodeSafeBatch, sdkDecodeSafeBatch]) {
    expect(() => decoder(pack("0x01"))).toThrow();
    expect(() => decoder(concatHex([pack(), "0x00"]))).toThrow();
    expect(() => decoder(encodeFunctionData({ abi: multiSendAbi, functionName: "multiSend", args: ["0x00"] }))).toThrow();
  }
});

test("Collected contract signatures bind exact bytes and reject duplicate owners", () => {
  const signatures = [{ owner: wallet, data: "0x123456", contract: true }];
  const intent = { family: "evm", action: "safe_execute_signatures", parameters: { transaction, signatures } } as const;
  const bytes = buildSignatureBytes([new EthSafeSignature(wallet, "0x123456", true)]) as `0x${string}`;
  const data = encodeFunctionData({ abi: safeAbi, functionName: "execTransaction", args: [transaction.to, 1n, "0x", 0, 0n, 0n, 0n, zeroAddress, zeroAddress, bytes] });
  const call = { ...approveCall, data };
  expect(() => validateIntentPlan(intent, wallet, [call])).not.toThrow();
  expect(() => validateIntentPlan({ ...intent, parameters: { transaction, signatures: [{ ...signatures[0], data: "0x123457" }] } }, wallet, [call])).toThrow();
  expect(() => validateIntentPlan({ ...intent, parameters: { transaction, signatures: [...signatures, ...signatures] } }, wallet, [call])).toThrow();
});

test("Role previews describe verified static contract calls without proposal JSON", async () => {
  const service = new EvmService(async (command) => command === "decode"
    ? { source: "etherscan", result: { functionName: "supply", args: [recipient, "1000000", safe, 0] } }
    : { plan: { chainId: 8453, account: wallet, to: recipient, value: "0", data: "0x12345678", fingerprint: transaction.hash, expiresAt: Date.now() + 60_000, simulationBlock: "100", gas: "90000", gasPrice: "1" }, state: { _tag: "prepared" } });
  const result = await service.propose(wallet, "safe_role_execute", { safe, module: recipient, role: `0x${"01".repeat(32)}`, to: recipient, data: "0x12345678" });
  expect(result.summary).toContain("call supply");
  expect(result.summary).toContain("argument 2: 1000000");
  expect(result.summary).not.toContain('"functionName"');
});
