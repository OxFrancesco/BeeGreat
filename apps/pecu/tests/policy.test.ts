import { describe, expect, test } from "bun:test";
import { validateEvmPlan, validateIntentPlan, validatePlan } from "../src/policy";
import type { PlannedCall } from "../src/domain";

const wallet = "0x1111111111111111111111111111111111111111" as const;
const approval: PlannedCall = {
  role: "approval",
  from: wallet,
  to: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
  data: "0x095ea7b3",
  value: "0",
};
const action: PlannedCall = {
  role: "action",
  from: wallet,
  to: "0x2222222222222222222222222222222222222222",
  data: "0x12345678",
  value: "0",
};

describe("transaction policy", () => {
  test("accepts SDK-generated calls to dynamic pool and gauge contracts", () => {
    expect(() => validatePlan("deposit", wallet, [approval, action])).not.toThrow();
  });

  test("rejects a mismatched wallet", () => {
    expect(() => validatePlan("stake", wallet, [{ ...action, from: action.to }])).toThrow("wrong sender");
  });

  test("rejects zero-address and wallet targets", () => {
    expect(() => validatePlan("claim_fees", wallet, [{ ...action, to: "0x0000000000000000000000000000000000000000" }])).toThrow("invalid target");
    expect(() => validatePlan("claim_fees", wallet, [{ ...action, to: wallet }])).toThrow("invalid target");
  });

  test("allows native value only on the final action", () => {
    expect(() => validatePlan("deposit", wallet, [{ ...approval, value: "1" }, action])).toThrow("sends native value");
    expect(() => validatePlan("deposit", wallet, [{ ...action, value: "1" }])).not.toThrow();
  });

  test("rejects unknown approval functions and action ordering", () => {
    expect(() => validatePlan("create_venft", wallet, [{ ...approval, data: "0x12345678" }, action])).toThrow("unexpected function");
    expect(() => validatePlan("unstake", wallet, [action, approval])).toThrow();
  });
});

describe("generic EVM plan policy", () => {
  const recipient = "0x3333333333333333333333333333333333333333";
  const word = (value: bigint) => value.toString(16).padStart(64, "0");
  const erc20Transfer: PlannedCall = { role: "action", from: wallet, to: approval.to, data: `0xa9059cbb${word(BigInt(recipient))}${word(5_000_000n)}`, value: "0" };
  const erc20Approve: PlannedCall = { ...erc20Transfer, data: `0x095ea7b3${word(BigInt(recipient))}${word(5_000_000n)}` };
  const erc20Revoke: PlannedCall = { ...erc20Transfer, data: `0x095ea7b3${word(BigInt(recipient))}${word(0n)}` };
  const nativeTransfer: PlannedCall = { role: "action", from: wallet, to: recipient, data: "0x", value: "1000" };

  test("accepts exactly one well-formed call per action", () => {
    expect(() => validateEvmPlan("transfer", wallet, [erc20Transfer])).not.toThrow();
    expect(() => validateEvmPlan("transfer", wallet, [nativeTransfer])).not.toThrow();
    expect(() => validateEvmPlan("approve", wallet, [erc20Approve])).not.toThrow();
    expect(() => validateEvmPlan("revoke", wallet, [erc20Revoke])).not.toThrow();
    expect(() => validateEvmPlan("contract_call", wallet, [action])).not.toThrow();
  });

  test("rejects multi-step, approval-role, wrong-sender, and self-targeted plans", () => {
    expect(() => validateEvmPlan("transfer", wallet, [erc20Transfer, erc20Transfer])).toThrow("exactly one");
    expect(() => validateEvmPlan("transfer", wallet, [])).toThrow("exactly one");
    expect(() => validateEvmPlan("transfer", wallet, [{ ...erc20Transfer, role: "approval" }])).toThrow("single action");
    expect(() => validateEvmPlan("transfer", wallet, [{ ...erc20Transfer, from: recipient }])).toThrow("wrong sender");
    expect(() => validateEvmPlan("transfer", wallet, [{ ...nativeTransfer, to: wallet }])).toThrow("invalid target");
  });

  test("pins calldata shape to the declared action", () => {
    expect(() => validateEvmPlan("transfer", wallet, [{ ...nativeTransfer, value: "0" }])).toThrow("positive amount");
    expect(() => validateEvmPlan("transfer", wallet, [erc20Approve])).toThrow("not an ERC-20 transfer");
    expect(() => validateEvmPlan("transfer", wallet, [{ ...erc20Transfer, value: "1" }])).toThrow("not an ERC-20 transfer");
    expect(() => validateEvmPlan("approve", wallet, [erc20Transfer])).toThrow("not an ERC-20 approve");
    expect(() => validateEvmPlan("revoke", wallet, [erc20Approve])).toThrow("allowance to zero");
    expect(() => validateEvmPlan("contract_call", wallet, [{ ...action, data: "0x" }])).toThrow("invalid calldata");
  });

  test("dispatches by intent family", () => {
    expect(() => validateIntentPlan({ family: "aero", action: "stake", parameters: { chain: 8453 } }, wallet, [action])).not.toThrow();
    expect(() => validateIntentPlan({ family: "evm", action: "revoke", parameters: { token: "USDC", spender: recipient } }, wallet, [erc20Approve])).toThrow("allowance to zero");
  });
});
