import { describe, expect, test } from "bun:test";
import type { EvmCommand } from "../src/cloudflare/evm-protocol";
import { EvmService, formatUnits, parseUnits, resolveToken, validateEvmRequest, type EvmExecutor } from "../src/evm";

const wallet = "0x1111111111111111111111111111111111111111";
const recipient = "0x3333333333333333333333333333333333333333";
const usdc = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

function operation(overrides: Partial<{ account: string; to: string; data: string; value: string }> = {}) {
  return {
    plan: {
      chainId: 8453, account: wallet, to: usdc, data: `0xa9059cbb${"0".repeat(128)}`, value: "0",
      id: "0x" + "aa".repeat(32), intentHash: "0x" + "bb".repeat(32), fingerprint: "0x" + "cc".repeat(32), key: "k",
      createdAt: 1, expiresAt: 2, simulationBlock: "100", gas: "60000", gasPrice: "1000000", feeType: "eip1559", maxPriorityFeePerGas: "1", l1FeeEstimate: "5",
      ...overrides,
    },
    state: { _tag: "prepared" },
  };
}

function executor(responses: Partial<Record<EvmCommand, unknown>>) {
  const calls: Array<{ command: EvmCommand; input: Record<string, unknown> }> = [];
  const run: EvmExecutor = async (command, input) => {
    calls.push({ command, input });
    if (!(command in responses)) throw new Error(`unexpected command ${command}`);
    return responses[command];
  };
  return { service: new EvmService(run), calls };
}

describe("unit conversion", () => {
  test("parses decimals into base units without floating point", () => {
    expect(parseUnits("1", 6)).toBe(1_000_000n);
    expect(parseUnits("0.000001", 6)).toBe(1n);
    expect(parseUnits("12.5", 18)).toBe(12_500_000_000_000_000_000n);
    expect(parseUnits("0", 18)).toBe(0n);
    expect(() => parseUnits("1.0000001", 6)).toThrow("decimal places");
    expect(() => parseUnits("1e3", 6)).toThrow("decimal number");
    expect(() => parseUnits("-1", 6)).toThrow("decimal number");
  });
  test("formats base units back to human strings", () => {
    expect(formatUnits("1000000", 6)).toBe("1");
    expect(formatUnits("1500000", 6)).toBe("1.5");
    expect(formatUnits("1", 18)).toBe("0.000000000000000001");
    expect(formatUnits("0", 18)).toBe("0");
  });
  test("resolves known symbols and raw addresses", () => {
    expect(resolveToken(undefined)).toEqual({ kind: "native", symbol: "ETH", decimals: 18 });
    expect(resolveToken("eth")).toEqual({ kind: "native", symbol: "ETH", decimals: 18 });
    expect(resolveToken("USDC")).toEqual({ kind: "erc20", address: usdc });
    expect(resolveToken(recipient)).toEqual({ kind: "erc20", address: recipient });
    expect(() => resolveToken("DOGE")).toThrow("Unknown token");
  });
});

describe("evm request validation", () => {
  test("rejects unknown fields and malformed values", () => {
    expect(() => validateEvmRequest("transfer", { to: recipient, amount: "1", extra: true })).toThrow();
    expect(() => validateEvmRequest("transfer", { to: "not-an-address", amount: "1" })).toThrow("to");
    expect(() => validateEvmRequest("contract_call", { address: usdc, signature: "transfer(address)" })).toThrow("signature");
    expect(validateEvmRequest("revoke", { token: "USDC", spender: recipient })).toEqual({ token: "USDC", spender: recipient });
  });
});

describe("EvmService", () => {
  test("known-token allowances do not start a second token lookup", async () => {
    const { service, calls } = executor({ allowance: { amount: "10000", block: "100" } });
    for (const reference of ["USDC", usdc.toLowerCase()]) {
      expect((await service.allowance(wallet, reference, recipient)).output).toMatchObject({ token: "USDC", amount: "0.01" });
    }
    expect(calls.map((call) => call.command)).toEqual(["allowance", "allowance"]);
  });
  test("reads any ERC-20 balance in human units", async () => {
    const { service, calls } = executor({ token: { chainId: 8453, address: wallet, token: usdc, block: "100", symbol: "USDC", decimals: 6, amount: "12500000" } });
    const result = await service.tokenBalance(wallet, "USDC");
    expect(result.output).toMatchObject({ token: "USDC", amount: "12.5", amount_base_units: "12500000", decimals: 6 });
    expect(calls).toEqual([{ command: "token", input: { address: wallet, token: usdc, chainId: 8453 } }]);
  });

  test("reads ETH through balance", async () => {
    const { service } = executor({ balance: { chainId: 8453, address: wallet, block: "100", balanceWei: "2500000000000000000" } });
    const result = await service.tokenBalance(wallet, "ETH");
    expect(result.output).toMatchObject({ token: "ETH", amount: "2.5" });
  });

  test("builds an ERC-20 transfer plan after checking decimals and balance", async () => {
    const { service, calls } = executor({
      token: { chainId: 8453, address: wallet, token: usdc, block: "100", symbol: "USDC", decimals: 6, amount: "10000000" },
      transfer: operation(),
    });
    const plan = await service.propose(wallet, "transfer", { to: recipient, amount: "5", token: "USDC" });
    expect(plan.calls).toEqual([{ role: "action", from: wallet, to: usdc, data: `0xa9059cbb${"0".repeat(128)}`, value: "0" }]);
    expect(plan.summary).toBe(`Send 5 USDC to ${recipient}`);
    expect(plan.context).toMatchObject({ token: "USDC", gas_limit: "60000", simulation_block: "100", l1_fee_estimate_wei: "5" });
    const transfer = calls.find((call) => call.command === "transfer");
    expect(transfer?.input).toMatchObject({ account: wallet, token: usdc, to: recipient, amount: "5000000", chainId: 8453 });
    expect(String(transfer?.input.key)).toMatch(/^pecu-[0-9a-f-]{36}$/);
  });

  test("refuses a transfer that exceeds the balance before the sandbox builds a plan", async () => {
    const { service, calls } = executor({
      token: { chainId: 8453, address: wallet, token: usdc, block: "100", symbol: "USDC", decimals: 6, amount: "1000000" },
      transfer: operation(),
    });
    await expect(service.propose(wallet, "transfer", { to: recipient, amount: "5", token: "USDC" })).rejects.toThrow("Insufficient USDC: balance 1, requested 5");
    expect(calls.map((call) => call.command)).toEqual(["token"]);
  });

  test("native transfers omit the token and move wei as value", async () => {
    const { service, calls } = executor({
      balance: { chainId: 8453, address: wallet, block: "100", balanceWei: "3000000000000000000" },
      transfer: operation({ to: recipient, data: "0x", value: "1000000000000000000" }),
    });
    const plan = await service.propose(wallet, "transfer", { to: recipient, amount: "1" });
    expect(plan.calls[0]).toMatchObject({ to: recipient, data: "0x", value: "1000000000000000000" });
    expect(calls.find((call) => call.command === "transfer")?.input).toMatchObject({ to: recipient, amount: "1000000000000000000" });
    expect(calls.find((call) => call.command === "transfer")?.input.token).toBeUndefined();
  });

  test("refuses to transfer to the sender's own wallet", async () => {
    const { service } = executor({});
    await expect(service.propose(wallet, "transfer", { to: wallet, amount: "1" })).rejects.toThrow("own wallet");
  });

  test("revoke never carries an amount and approve carries base units", async () => {
    const { service, calls } = executor({
      token: { chainId: 8453, address: wallet, token: usdc, block: "100", symbol: "USDC", decimals: 6, amount: "0" },
      approve: operation({ data: `0x095ea7b3${"0".repeat(128)}` }),
      revoke: operation({ data: `0x095ea7b3${"0".repeat(128)}` }),
    });
    await service.propose(wallet, "approve", { token: "USDC", spender: recipient, amount: "2.5" });
    await service.propose(wallet, "revoke", { token: "USDC", spender: recipient });
    expect(calls.find((call) => call.command === "approve")?.input).toMatchObject({ spender: recipient, amount: "2500000" });
    expect(calls.find((call) => call.command === "revoke")?.input.amount).toBeUndefined();
  });

  test("contract calls derive the function name from the signature", async () => {
    const { service, calls } = executor({ "prepare-call": operation({ to: recipient, data: "0xdeadbeef" }) });
    const plan = await service.propose(wallet, "contract_call", { address: recipient, signature: "function stake(uint256 amount)", args: ["1000"], value: "0.5" });
    expect(calls[0]?.input).toMatchObject({ address: recipient, signatures: ["function stake(uint256 amount)"], functionName: "stake", args: ["1000"], account: wallet, value: "500000000000000000" });
    expect(plan.summary).toContain('stake("1000")');
    expect(plan.summary).toContain("0.5 ETH");
  });

  test("rejects a plan the sandbox built for another account", async () => {
    const { service } = executor({
      balance: { chainId: 8453, address: wallet, block: "100", balanceWei: "3000000000000000000" },
      transfer: operation({ account: recipient, to: wallet, data: "0x", value: "1" }),
    });
    await expect(service.propose(wallet, "transfer", { to: recipient, amount: "1" })).rejects.toThrow("different account");
  });

  test("rejects a malformed sandbox response", async () => {
    const { service } = executor({ token: { symbol: "USDC" } });
    await expect(service.tokenBalance(wallet, "USDC")).rejects.toThrow("unexpected result");
  });
});
