import { concatHex, numberToHex, size, padHex, encodeAbiParameters, decodeFunctionData, encodeFunctionData, hashTypedData, parseAbi, zeroAddress } from "viem";
import type { PlannedCall } from "./domain";
import { safeParameterSchemas, safeTransactionSchema, safeCallDescription } from "./safe";
import type { EvmTxAction, EvmTxParameters } from "./evm";

const abi = parseAbi([
  "function deployModule(address masterCopy,bytes initializer,uint256 saltNonce) returns (address)",
  "function setUp(bytes initializeParams)",
  "function createSigner(uint256 x,uint256 y,uint176 verifiers) returns (address)",
  "function executeAllowanceTransfer(address safe,address token,address to,uint96 amount,address paymentToken,uint96 payment,address delegate,bytes signature)",
  "function execTransactionWithRole(address to,uint256 value,bytes data,uint8 operation,bytes32 roleKey,bool shouldRevert) returns (bool)",
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
  if (action === "safe_budget_spend") {
    const p = safeParameterSchemas.safe_budget_spend.parse(parameters);
    const expected = encodeFunctionData({ abi, functionName: "executeAllowanceTransfer", args: [p.safe, p.token, p.to, BigInt(p.amount), zeroAddress, 0n, call.from, "0x"] });
    if (!same(call.to, "0xAA46724893dedD72658219405185Fb0Fc91e091C") || !same(expected, call.data)) fail();
    return;
  }
  if (action === "safe_role_execute") {
    const p = safeParameterSchemas.safe_role_execute.parse(parameters);
    const expected = encodeFunctionData({ abi, functionName: "execTransactionWithRole", args: [p.to, 0n, p.data as `0x${string}`, 0, p.role as `0x${string}`, true] });
    if (!same(p.module, call.to) || !same(expected, call.data)) fail();
    return;
  }
  if (action === "safe_roles_deploy") {
    const p = safeParameterSchemas.safe_roles_deploy.parse(parameters);
    const initializer = encodeFunctionData({ abi, functionName: "setUp", args: [encodeAbiParameters([{ type: "address" }, { type: "address" }, { type: "address" }], [p.safe, p.safe, p.safe])] });
    const expected = encodeFunctionData({ abi, functionName: "deployModule", args: ["0xf2964ce6161ce0e75964fe7927ce114cb0b283d5", initializer, BigInt(p.saltNonce)] });
    if (!same(call.to, "0x000000000000aDdB49795b0f9bA5BC298cDda236") || !same(expected, call.data)) fail();
    return;
  }
  if (action === "safe_passkey_deploy") {
    const p = safeParameterSchemas.safe_passkey_deploy.parse(parameters);
    const expected = encodeFunctionData({ abi, functionName: "createSigner", args: [BigInt(p.passkey.x), BigInt(p.passkey.y), BigInt("0xc2b78104907F722DABAc4C69f826a522B2754De4")] });
    if (!same(call.to, "0x1d31F259eE307358a26dFb23EB365939E8641195") || !same(expected, call.data)) fail();
    return;
  }
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
  if (action !== "safe_approve" && action !== "safe_execute" && action !== "safe_execute_signatures") return;
  if (!("transaction" in parameters)) fail();
  const tx = safeTransactionSchema.parse("transaction" in parameters ? parameters.transaction : undefined);
  if (!same(call.to, tx.safe)) fail();
  safeCallDescription(tx);
  const fields = { to: tx.to, value: BigInt(tx.value), data: tx.data as `0x${string}`, operation: tx.operation ?? 0, safeTxGas: 0n, baseGas: 0n, gasPrice: 0n, gasToken: zeroAddress, refundReceiver: zeroAddress };
  const hash = hashTypedData({ domain: { chainId: 8453, verifyingContract: tx.safe }, types: transactionTypes, primaryType: "SafeTx", message: { ...fields, nonce: BigInt(tx.nonce) } });
  if (!same(hash, tx.hash)) fail();
  if (action === "safe_approve") {
    if (!same(call.data, encodeFunctionData({ abi, functionName: "approveHash", args: [hash] }))) fail();
    return;
  }
  const decoded = decodeFunctionData({ abi, data: call.data });
  if (decoded.functionName !== "execTransaction") return fail();
  const signatures = decoded.args[9];
  if (action === "safe_execute_signatures") {
    const p = safeParameterSchemas.safe_execute_signatures.parse(parameters);
    const sorted = [...p.signatures].sort((a, b) => a.owner.toLowerCase().localeCompare(b.owner.toLowerCase()));
    if (new Set(sorted.map(s => s.owner.toLowerCase())).size !== sorted.length) fail();
    let offset = sorted.length * 65;
    const tails: `0x${string}`[] = [];
    const heads = sorted.map(s => {
      const data = s.data as `0x${string}`;
      if (!s.contract) { if (size(data) !== 65) fail(); return data; }
      const head = concatHex([padHex(s.owner, { size: 32 }), numberToHex(offset, { size: 32 }), "0x00"]);
      const tail = concatHex([numberToHex(size(data), { size: 32 }), data]); tails.push(tail); offset += size(tail);
      return head;
    });
    if (!same(signatures, concatHex([...heads, ...tails]))) fail();
  } else if (!/^0x(?:[0-9a-fA-F]{64}0{64}01)+$/.test(signatures)) fail();
  const expected = encodeFunctionData({ abi, functionName: "execTransaction", args: [fields.to, fields.value, fields.data, fields.operation, 0n, 0n, 0n, zeroAddress, zeroAddress, signatures] });
  if (!same(call.data, expected)) fail();
}
