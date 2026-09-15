import type { SugarTxAction } from "@beegreat/sugar/contracts";
import type { PlannedCall } from "./domain";
import type { EvmTxAction } from "./evm";
import type { IntentAction } from "./state";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const APPROVAL_SELECTORS = new Set(["095ea7b3", "87517c45"]);
const ERC20_TRANSFER_SELECTOR = "a9059cbb";
const ERC20_APPROVE_SELECTOR = "095ea7b3";

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
    case "contract_call": {
      if (call.data.length < 10) throw new Error("Contract call has invalid calldata");
      return;
    }
    default: {
      const _exhaustive: never = action;
      throw new Error(`Unsupported EVM action: ${String(_exhaustive)}`);
    }
  }
}

export function validateIntentPlan(
  intent: IntentAction,
  wallet: `0x${string}`,
  calls: readonly PlannedCall[],
): void {
  if (intent.family === "aero") validatePlan(intent.action, wallet, calls);
  else if (intent.family === "aave") {
    if (intent.parameters.chainId !== 8453 || intent.parameters.sender.toLowerCase() !== wallet.toLowerCase()) throw new Error("Aave plan has the wrong wallet or chain");
    validatePlan("swap", wallet, calls);
  } else validateEvmPlan(intent.action, wallet, calls);
}

/**
 * Validate invariants on an unsigned plan emitted by the in-process Aero SDK.
 * Contract addresses stay dynamic because pools, gauges, reward contracts, and
 * token contracts are part of the full SDK surface. Users never provide a
 * target, value, or calldata directly.
 */
export function validatePlan(
  action: SugarTxAction,
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
