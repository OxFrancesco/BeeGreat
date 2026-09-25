import { z } from "zod";
import { decodeFunctionData, erc20Abi, formatEther, parseAbi, sliceHex, size, encodeFunctionData, zeroAddress } from "viem";

const address = z.templateLiteral(["0x", z.string().regex(/^[0-9a-fA-F]{40}$/)]);
const uint = z.string().regex(/^(0|[1-9]\d*)$/).max(78).refine((value) => BigInt(value) < 2n ** 256n, "Value exceeds uint256");
const hex = z.templateLiteral(["0x", z.string().regex(/^(?:[0-9a-fA-F]{2})*$/)]);
const hash = z.string().regex(/^0x[0-9a-fA-F]{64}$/);
export const safeTransactionSchema = z.strictObject({ chainId: z.literal(8453), safe: address, to: address, value: uint, data: hex, nonce: uint, hash, operation: z.union([z.literal(0), z.literal(1)]).optional() });
export const safeOwnerChangeSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("add"), owner: address, threshold: z.number().int().min(1).max(32) }),
  z.strictObject({ kind: z.literal("remove"), owner: address, threshold: z.number().int().min(1).max(32) }),
  z.strictObject({ kind: z.literal("replace"), owner: address, replacement: address }),
  z.strictObject({ kind: z.literal("threshold"), threshold: z.number().int().min(1).max(32) }),
]);
export const safeSignatureSchema = z.strictObject({ owner: address, data: hex, contract: z.boolean() });
const passkey = z.strictObject({ x: uint, y: uint });
const safeCall = z.strictObject({ to: address, value: uint, data: hex });
const budgetTarget = { safe: address, delegate: address, token: address };
const roleTarget = { safe: address, module: address, role: hash, member: address };
const roleCall = { safe: address, module: address, role: hash, to: address, data: hex };
export const safeParameterSchemas = {
  safe_budget_spend: z.strictObject({ safe: address, token: address, to: address, amount: uint }),
  safe_role_execute: z.strictObject(roleCall),
  safe_roles_deploy: z.strictObject({ safe: address, saltNonce: uint }),
  safe_passkey_deploy: z.strictObject({ safe: address, passkey }),
  safe_execute_signatures: z.strictObject({ transaction: safeTransactionSchema, signatures: z.array(safeSignatureSchema).min(1).max(32) }),
  safe_create: z.strictObject({ owners: z.array(address).min(1).max(32), threshold: z.number().int().min(1).max(32), saltNonce: uint }),
  safe_approve: z.strictObject({ transaction: safeTransactionSchema }),
  safe_execute: z.strictObject({ transaction: safeTransactionSchema }),
};
export const safeReadSchemas = {
  "safe-batch-propose": z.strictObject({ safe: address, calls: z.array(safeCall).min(1).max(64) }),
  "safe-module-info": z.strictObject({ safe: address, module: address }),
  "safe-module-propose": z.strictObject({ safe: address, module: address, enabled: z.boolean() }),
  "safe-budget": z.strictObject(budgetTarget),
  "safe-budget-propose": z.strictObject({ ...budgetTarget, amount: uint, resetMinutes: z.number().int().min(0).max(65535) }),
  "safe-budget-revoke-propose": z.strictObject(budgetTarget),
  "safe-role-grant-propose": z.strictObject({ ...roleTarget, permissions: z.array(z.strictObject({ to: address, selector: z.templateLiteral(["0x", z.string().regex(/^[0-9a-fA-F]{8}$/)]), parameters: z.array(z.discriminatedUnion("kind", [z.strictObject({ kind: z.literal("equal"), value: hash }), z.strictObject({ kind: z.literal("max"), value: uint })])).max(32) })).min(1).max(16) }),
  "safe-role-revoke-propose": z.strictObject(roleTarget),
  "safe-role-check": z.strictObject({ ...roleCall, account: address }),
  "safe-passkey-address": z.strictObject({ safe: address, passkey }),
  "safe-passkey-owner-propose": z.strictObject({ safe: address, passkey, threshold: z.number().int().min(1).max(32) }),
  "safe-sponsored-enable-propose": z.strictObject({ safe: address }),
  "safe-info": z.strictObject({ safe: address }),
  "safe-propose": z.strictObject({ safe: address, to: address, value: uint, data: hex }),
  "safe-approvals": z.strictObject({ transaction: safeTransactionSchema }),
  "safe-cancel-propose": z.strictObject({ safe: address }),
  "safe-owner-propose": z.strictObject({ safe: address, change: safeOwnerChangeSchema }),
};
export type SafeReadCommand = keyof typeof safeReadSchemas;

export const safeExtensionAbi = parseAbi([
  "function enableModule(address module)",
  "function disableModule(address previousModule,address module)",
  "function setFallbackHandler(address handler)",
  "function swapOwner(address previousOwner,address oldOwner,address newOwner)",
  "function addDelegate(address delegate)",
  "function setAllowance(address delegate,address token,uint96 amount,uint16 resetTimeMin,uint32 resetBaseMin)",
  "function deleteAllowance(address delegate,address token)",
  "function scopeTarget(bytes32 roleKey,address targetAddress)",
  "function scopeFunction(bytes32 roleKey,address targetAddress,bytes4 selector,(uint8 parent,uint8 paramType,uint8 operator,bytes compValue)[] conditions,uint8 options)",
  "function assignRoles(address member,bytes32[] roleKeys,bool[] memberOf)",
  "function addOwnerWithThreshold(address owner,uint256 threshold)",
  "function removeOwner(address previousOwner,address owner,uint256 threshold)",
  "function changeThreshold(uint256 threshold)",
]);

export function safeCallDescription(transaction: z.infer<typeof safeTransactionSchema>) {
  if (transaction.operation === 1) {
    if (transaction.to.toLowerCase() !== "0x9641d764fc13c8b624c04430c7356c1c7c8102e2" || transaction.value !== "0") throw new Error("Unsupported Safe batch target");
    const calls = decodeSafeBatch(hex.parse(transaction.data));
    return { kind: "batch", calls } as const;
  }
  if (transaction.data === "0x") return { kind: "plain", text: transaction.to.toLowerCase() === transaction.safe.toLowerCase() && transaction.value === "0"
    ? "cancel other transactions at the current wallet nonce"
    : `send ${formatEther(BigInt(transaction.value))} ETH to ${transaction.to}` } as const;
  const data = hex.parse(transaction.data);
  if (transaction.to.toLowerCase() === transaction.safe.toLowerCase()) {
    if (transaction.value !== "0") throw new Error("Owner changes must not send ETH");
    const call = decodeFunctionData({ abi: safeExtensionAbi, data });
    switch (call.functionName) {
      case "swapOwner": return { kind: "plain", text: `replace owner ${call.args[1]} with ${call.args[2]}, keeping the approval threshold` } as const;
      case "enableModule": return { kind: "plain", text: `enable module ${call.args[0]}, which can execute under its own permissions without per-transaction owner approval` } as const;
      case "disableModule": return { kind: "plain", text: `disable module ${call.args[1]}` } as const;
      case "setFallbackHandler": return { kind: "plain", text: `set the account-abstraction handler to ${call.args[0]}` } as const;
      case "addOwnerWithThreshold": return { kind: "plain", text: `add owner ${call.args[0]} and require ${call.args[1]} approvals` } as const;
      case "removeOwner": return { kind: "plain", text: `remove owner ${call.args[1]} and require ${call.args[2]} approvals` } as const;
      case "changeThreshold": return { kind: "plain", text: `change the required approvals to ${call.args[0]}` } as const;
    }
  }
  try {
    const call = decodeFunctionData({ abi: safeExtensionAbi, data });
    switch (call.functionName) {
      case "addDelegate": return { kind: "plain", text: `register spending delegate ${call.args[0]}` } as const;
      case "setAllowance": return { kind: "budget", delegate: call.args[0], token: call.args[1], amount: call.args[2], resetMinutes: call.args[3] } as const;
      case "deleteAllowance": return { kind: "plain", text: `revoke the budget for ${call.args[0]} on token ${call.args[1]}` } as const;
      case "scopeTarget": return { kind: "plain", text: `restrict this role to selected functions on ${call.args[1]}` } as const;
      case "scopeFunction": return { kind: "plain", text: `permit function ${call.args[2]} on ${call.args[1]} with ${call.args[3].slice(1).map((c, i) => `argument ${i + 1} ${c.operator === 16 ? "equal to" : c.operator === 18 ? "less than" : "using condition " + c.operator} ${c.compValue === "0x" ? "empty" : BigInt(c.compValue).toString()}`).join(", ")}; ${call.args[4] === 0 ? "no ETH transfer or delegatecall" : "execution permissions " + call.args[4]}` } as const;
      case "assignRoles": return { kind: "plain", text: `${call.args[2].every(Boolean) ? "grant" : "update or revoke"} the selected roles for ${call.args[0]}, membership ${call.args[2].join(", ")}` } as const;
    }
  } catch { /* Ordinary token calls use the token ABI below. */ }
  const call = decodeFunctionData({ abi: erc20Abi, data });
  if (call.functionName === "transfer" || call.functionName === "approve") {
    if (transaction.value !== "0") throw new Error("Token calls must not send ETH");
    return { kind: "token", action: call.functionName, recipient: call.args[0], amount: call.args[1] } as const;
  }
  throw new Error("Pecu currently reviews Safe native transfers, token transfers, token allowances, cancellation and owner changes. Use evmSDK for other Safe contract calls.");
}

export function safeTransactionSummary(verb: string, transaction: z.infer<typeof safeTransactionSchema>, action: string): string {
  return `${verb} organization wallet ${transaction.safe} to ${action}.`;
}

export const multiSendAbi = parseAbi(["function multiSend(bytes transactions) payable"]);
export function decodeSafeBatch(data: `0x${string}`) {
  const decoded = decodeFunctionData({ abi: multiSendAbi, data });
  if (encodeFunctionData({ abi: multiSendAbi, functionName: "multiSend", args: decoded.args }).toLowerCase() !== data.toLowerCase()) throw new Error("Noncanonical Safe batch");
  const bytes = decoded.args[0];
  const calls: { to: `0x${string}`; value: string; data: `0x${string}` }[] = [];
  let offset = 0;
  while (offset < size(bytes)) {
    if (calls.length >= 64 || size(bytes) - offset < 85 || sliceHex(bytes, offset, offset + 1) !== "0x00") throw new Error("Invalid CALL-only Safe batch");
    const to = sliceHex(bytes, offset + 1, offset + 21);
    const value = BigInt(sliceHex(bytes, offset + 21, offset + 53)).toString();
    const length = BigInt(sliceHex(bytes, offset + 53, offset + 85));
    if (length > BigInt(size(bytes) - offset - 85) || to === zeroAddress) throw new Error("Invalid batch call");
    const end = offset + 85 + Number(length);
    calls.push({ to, value, data: length === 0n ? '0x' : sliceHex(bytes, offset + 85, end) }); offset = end;
  }
  if (!calls.length) throw new Error("Empty batch");
  return calls;
}

export function isSafeModuleConfiguration(data: `0x${string}`): boolean {
  try { return ["addDelegate", "setAllowance", "deleteAllowance", "scopeTarget", "scopeFunction", "assignRoles"].includes(decodeFunctionData({ abi: safeExtensionAbi, data }).functionName); }
  catch { return false; }
}
