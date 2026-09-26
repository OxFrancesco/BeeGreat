import { validateSafePlan } from "./safe-policy";
import type { SugarTxAction } from "@beegreat/sugar/contracts";
import { BASE_USDC_ADDRESS, type PlannedCall } from "./domain";
import type { EvmTxAction } from "./evm";
import type { DepositRelayParameters, IntentAction } from "./state";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const APPROVAL_SELECTORS = new Set(["095ea7b3", "87517c45"]);
const ERC20_TRANSFER_SELECTOR = "a9059cbb";
const ERC20_APPROVE_SELECTOR = "095ea7b3";
/**
 * Token-moving or allowance-granting functions a generic contract call must
 * not smuggle past the per-action validators: ERC-20 transfer, approve,
 * transferFrom, increaseAllowance, permit; ERC-721 setApprovalForAll and both
 * safeTransferFrom forms; ERC-1155 safeTransferFrom and safeBatchTransferFrom;
 * Aave approveDelegation.
 */
const TOKEN_MOVING_SELECTORS = new Set([
  ERC20_TRANSFER_SELECTOR, ERC20_APPROVE_SELECTOR, "23b872dd", "39509351", "d505accf",
  "a22cb465", "42842e0e", "b88d4fde",
  "f242432a", "2eb2c2d6",
  "87517c45",
]);

/** Plans whose calldata is model-authored rather than SDK-built always wait for a human, even with YOLO on. */
export function requiresExplicitConfirmation(intent: IntentAction): boolean {
  return intent.family === "evm" && intent.action === "contract_call";
}

function selector(call: PlannedCall): string {
  return call.data.slice(2, 10).toLowerCase();
}

/**
 * Validate the single unsigned call the evm sandbox produced for a generic
 * EVM action. Each action has one exact calldata shape; anything else is
 * rejected before it can be persisted or confirmed.
 */
export function validateEvmPlan(
  action: EvmTxAction,
  wallet: `0x${string}`,
  calls: readonly PlannedCall[],
): void {
  const [call] = calls;
  if (!call || calls.length !== 1) throw new Error(`${action} plan must contain exactly one transaction`);
  const target = call.to.toLowerCase();
  if (call.from.toLowerCase() !== wallet.toLowerCase()) throw new Error("Transaction has the wrong sender");
  if (target === ZERO_ADDRESS || target === wallet.toLowerCase()) throw new Error("Transaction has an invalid target");
  if (call.role !== "action") throw new Error(`${action} plan must be a single action`);
  const value = BigInt(call.value);

  switch (action) {
    case "transfer": {
      const native = call.data === "0x";
      if (native && value === 0n) throw new Error("Native transfer must move a positive amount");
      if (!native && (value !== 0n || selector(call) !== ERC20_TRANSFER_SELECTOR || call.data.length !== 138)) {
        throw new Error("Token transfer calldata is not an ERC-20 transfer");
      }
      return;
    }
    case "approve":
    case "revoke": {
      if (value !== 0n || selector(call) !== ERC20_APPROVE_SELECTOR || call.data.length !== 138) {
        throw new Error(`${action} calldata is not an ERC-20 approve`);
      }
      if (action === "revoke" && BigInt(`0x${call.data.slice(74)}`) !== 0n) throw new Error("Revoke must set the allowance to zero");
      return;
    }
    case "safe_create":
      if (value !== 0n || selector(call) !== "1688f0b9") throw new Error("Safe deployment must call createProxyWithNonce with zero value");
      return;
    case "safe_approve":
      if (value !== 0n || selector(call) !== "d4d9bdcd" || call.data.length !== 74) throw new Error("Safe approval must call approveHash with zero value");
      return;
    case "safe_execute_signatures":
    case "safe_execute":
      if (value !== 0n || selector(call) !== "6a761202") throw new Error("Safe execution must call execTransaction with zero outer value");
      return;
    case "safe_budget_spend":
    case "safe_role_execute":
    case "safe_roles_deploy":
    case "safe_passkey_deploy":
      if (value !== 0n || call.data.length < 10) throw new Error("Safe extension calls must have zero outer value");
      return;
    case "contract_call": {
      if (call.data.length < 10) throw new Error("Contract call has invalid calldata");
      if (TOKEN_MOVING_SELECTORS.has(selector(call))) {
        throw new Error("A contract call cannot transfer or approve tokens directly. Use send, approve, or revoke for that.");
      }
      return;
    }
    default: {
      const _exhaustive: never = action;
      throw new Error(`Unsupported EVM action: ${String(_exhaustive)}`);
    }
  }
}

/**
 * Validate the treasury's USDC relay for a confirmed Whop deposit: exactly one
 * ERC-20 transfer of Base USDC to the deposit owner's wallet, nothing else.
 */
export function validateDepositPlan(
  parameters: DepositRelayParameters,
  wallet: `0x${string}`,
  calls: readonly PlannedCall[],
): void {
  const [call] = calls;
  if (!call || calls.length !== 1) throw new Error("Deposit relay plan must contain exactly one transaction");
  if (call.role !== "action") throw new Error("Deposit relay plan must be a single action");
  if (call.from.toLowerCase() !== wallet.toLowerCase()) throw new Error("Deposit relay has the wrong sender");
  if (call.to.toLowerCase() !== BASE_USDC_ADDRESS.toLowerCase()) throw new Error("Deposit relay must send Base USDC");
  if (call.value !== "0") throw new Error("Deposit relay must not send native value");
  if (selector(call) !== ERC20_TRANSFER_SELECTOR || call.data.length !== 138) {
    throw new Error("Deposit relay calldata is not an ERC-20 transfer");
  }
  const recipient = `0x${call.data.slice(34, 74)}`;
  if (recipient.toLowerCase() !== parameters.recipient.toLowerCase()) throw new Error("Deposit relay sends to a different wallet");
  if (BigInt(`0x${call.data.slice(74)}`) !== BigInt(parameters.usdcUnits)) throw new Error("Deposit relay sends a different amount");
}

export function validateIntentPlan(
  intent: IntentAction,
  wallet: `0x${string}`,
  calls: readonly PlannedCall[],
): void {
  if (intent.family === "liquidity") {
    if (calls.length > 16 || intent.parameters.groups.reduce((sum, group) => sum + group.count, 0) !== calls.length) throw new Error("Invalid liquidity batch partition");
    let start = 0;
    for (const group of intent.parameters.groups) {
      validatePlan(group.action, wallet, calls.slice(start, start + group.count));
      start += group.count;
    }
  } else if (intent.family === "aero") validatePlan(intent.action, wallet, calls);
  else if (intent.family === "stocks") validatePlan(intent.action, wallet, calls);
  else if (intent.family === "aave") {
    if (intent.parameters.chainId !== 8453 || intent.parameters.sender.toLowerCase() !== wallet.toLowerCase()) throw new Error("Aave plan has the wrong wallet or chain");
    validatePlan("swap", wallet, calls);
  } else if (intent.family === "deposit") validateDepositPlan(intent.parameters, wallet, calls);
  else {
    validateEvmPlan(intent.action, wallet, calls);
    const call = calls[0];
    if (call) validateSafePlan(intent.action, intent.parameters, call);
  }
}

/**
 * Validate invariants on an unsigned plan emitted by the in-process Aero SDK.
 * Contract addresses stay dynamic because pools, gauges, reward contracts, and
 * token contracts are part of the full SDK surface. Users never provide a
 * target, value, or calldata directly.
 */
export function validatePlan(
  action: SugarTxAction | "stock_basket",
  wallet: `0x${string}`,
  calls: readonly PlannedCall[],
): void {
  if (calls.length < 1 || calls.length > 16) {
    throw new Error(`${action} plan has an unexpected number of transactions`);
  }

  let actionCount = 0;
  for (const [index, call] of calls.entries()) {
    const target = call.to.toLowerCase();
    if (call.from.toLowerCase() !== wallet.toLowerCase()) {
      throw new Error(`Transaction ${index + 1} has the wrong sender`);
    }
    if (target === ZERO_ADDRESS || target === wallet.toLowerCase()) {
      throw new Error(`Transaction ${index + 1} has an invalid target`);
    }
    if (call.data.length < 10) throw new Error(`Transaction ${index + 1} has invalid calldata`);
    const value = BigInt(call.value);
    if (value < 0n) throw new Error(`Transaction ${index + 1} has a negative value`);

    if (call.role === "approval") {
      if (actionCount > 0 || index === calls.length - 1 || value !== 0n) {
        throw new Error("Approval transaction is out of order or sends native value");
      }
      if (!APPROVAL_SELECTORS.has(call.data.slice(2, 10).toLowerCase())) {
        throw new Error("Approval transaction uses an unexpected function");
      }
      continue;
    }

    actionCount += 1;
    if (index !== calls.length - 1 || actionCount !== 1) {
      throw new Error("The Aerodrome action must be the final transaction");
    }
  }

  if (actionCount !== 1) throw new Error(`${action} plan does not contain one final action`);
}
