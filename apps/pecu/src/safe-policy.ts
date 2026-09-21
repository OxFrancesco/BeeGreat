import { decodeFunctionData, encodeFunctionData, hashTypedData, parseAbi, zeroAddress } from "viem";
import type { PlannedCall } from "./domain";
import { safeParameterSchemas, safeTransactionSchema } from "./safe";
import type { EvmTxAction, EvmTxParameters } from "./evm";

const abi = parseAbi([
  "function createProxyWithNonce(address singleton,bytes initializer,uint256 saltNonce) returns (address proxy)",
  "function setup(address[] owners,uint256 threshold,address to,bytes data,address fallbackHandler,address paymentToken,uint256 payment,address paymentReceiver)",
  "function approveHash(bytes32 hash)",
  "function execTransaction(address to,uint256 value,bytes data,uint8 operation,uint256 safeTxGas,uint256 baseGas,uint256 gasPrice,address gasToken,address refundReceiver,bytes signatures) payable returns (bool success)",
]);
const transactionTypes = { SafeTx: [
  { name: "to", type: "address" }, { name: "value", type: "uint256" }, { name: "data", type: "bytes" }, { name: "operation", type: "uint8" },
  { name: "safeTxGas", type: "uint256" }, { name: "baseGas", type: "uint256" }, { name: "gasPrice", type: "uint256" },
  { name: "gasToken", type: "address" }, { name: "refundReceiver", type: "address" }, { name: "nonce", type: "uint256" },
] };
const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
const fail = () => { throw new Error("Safe calldata does not match the reviewed proposal"); };

export function validateSafePlan(action: EvmTxAction, parameters: EvmTxParameters, call: PlannedCall): void {
  if (action === "safe_create") {
    const input = safeParameterSchemas.safe_create.parse(parameters);
    if (!same(call.to, "0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67")) fail();
    const unique = new Set(input.owners.map(owner => owner.toLowerCase()));
    if (unique.size !== input.owners.length || unique.has(zeroAddress) || unique.has("0x0000000000000000000000000000000000000001") || input.threshold > input.owners.length) fail();
    const initializer = encodeFunctionData({ abi, functionName: "setup", args: [input.owners, BigInt(input.threshold), zeroAddress, "0x", zeroAddress, zeroAddress, 0n, zeroAddress] });
    const expected = encodeFunctionData({ abi, functionName: "createProxyWithNonce", args: ["0x29fcB43b46531BcA003ddC8FCB67FFE91900C762", initializer, BigInt(input.saltNonce)] });
    if (!same(expected, call.data)) fail();
    return;
  }
  if (action !== "safe_approve" && action !== "safe_execute") return;
  if (!("transaction" in parameters)) fail();
  const tx = safeTransactionSchema.parse("transaction" in parameters ? parameters.transaction : undefined);
  if (!same(call.to, tx.safe)) fail();
  const fields = { to: tx.to, value: BigInt(tx.value), data: tx.data as `0x${string}`, operation: 0, safeTxGas: 0n, baseGas: 0n, gasPrice: 0n, gasToken: zeroAddress, refundReceiver: zeroAddress };
  const hash = hashTypedData({ domain: { chainId: 8453, verifyingContract: tx.safe }, types: transactionTypes, primaryType: "SafeTx", message: { ...fields, nonce: BigInt(tx.nonce) } });
  if (!same(hash, tx.hash)) fail();
  if (action === "safe_approve") {
    if (!same(call.data, encodeFunctionData({ abi, functionName: "approveHash", args: [hash] }))) fail();
    return;
  }
  const decoded = decodeFunctionData({ abi, data: call.data });
  if (decoded.functionName !== "execTransaction") return fail();
  const signatures = decoded.args[9];
  if (!/^0x(?:[0-9a-fA-F]{64}0{64}01)+$/.test(signatures)) fail();
  const expected = encodeFunctionData({ abi, functionName: "execTransaction", args: [fields.to, fields.value, fields.data, 0, 0n, 0n, 0n, zeroAddress, zeroAddress, signatures] });
  if (!same(call.data, expected)) fail();
}
