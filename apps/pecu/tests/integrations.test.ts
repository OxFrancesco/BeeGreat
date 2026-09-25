import { expect, test } from "bun:test";
import { encodeFunctionData, decodeFunctionData, erc20Abi, maxUint256 } from "viem";
import { AaveService, aaveSkill, aaveSchema } from "../src/integrations/aave";
import { PolymarketService, type ResearchStore } from "../src/integrations/polymarket";

const wallet = "0x1111111111111111111111111111111111111111";
const market = "0x2222222222222222222222222222222222222222";
const token = "0x3333333333333333333333333333333333333333";
const tx = { __typename: "TransactionRequest", from: wallet, to: market, value: "1000000000000", data: "0x12345678", chainId: 8453 };
const params = { action: "supply", amount: "0.000001", native: true, market, token };
function aaveFixture(options: { warning?: string; transaction?: unknown; inspect?: (name: string) => Promise<void> } = {}) {
  const calls: Array<{ name: string; arguments: Record<string, unknown> }> = [];
  const request: typeof fetch = Object.assign(async function (this: unknown, _input: RequestInfo | URL, init?: RequestInit) {
    expect(this).toBe(globalThis);
    const { params } = JSON.parse(String(init?.body)); calls.push(params);
    if (params.name === "get_user_summary" || params.name === "get_reserve_details") await options.inspect?.(params.name);
    const data = params.name === "get_markets" ? { v3: { markets: [{ market, chainId: 8453, reserves: [{ underlyingToken: token, symbol: "WETH" }] }] } }
      : params.name === "preview_action" ? { healthFactorAfter: "1.8" }
      : params.name === "prepare_action" ? options.transaction ?? tx : {};
    return Response.json({ result: { structuredContent: { data, ...(params.name === "preview_action" && options.warning ? { warnings: [{ level: options.warning, message: "Position warning" }] } : {}) } } });
  }, { preconnect() {} });
  return { service: new AaveService(request), calls };
}
test("Aave discovers, inspects, simulates, and builds for the verified Base wallet", async () => {
  const { service, calls } = aaveFixture({ warning: "warning" });
  const plan = await service.propose({ ...params, sender: token }, wallet);
  expect(calls.map((item) => item.name)).toEqual(["get_markets", "get_user_summary", "get_reserve_details", "preview_action", "prepare_action"]);
  expect(calls[3]?.arguments).toEqual(calls[4]?.arguments);
  expect(calls[3]?.arguments.sender).toBe(wallet);
  expect(plan.parameters.stage).toBe("action");
  expect(plan.preview).toContain("0.000001 ETH");
  expect(plan.preview).toContain("Health factor after: 1.8");
  expect(plan.preview).toContain("Position warning");
});
test("Aave inspects account and reserve together, then waits for both before simulation", async () => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const { service, calls } = aaveFixture({ inspect: async () => gate });
  const pending = service.propose(params, wallet);
  try {
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(calls.map((call) => call.name)).toEqual(["get_markets", "get_user_summary", "get_reserve_details"]);
  } finally { release(); }
  await pending;
  expect(calls.at(-1)?.name).toBe("prepare_action");
});
test("Aave rejects mismatched approval recipients and amounts", async () => {
  const approval = { ...tx, to: token, value: "0", data: encodeFunctionData({ abi: erc20Abi, functionName: "approve", args: [market, maxUint256] }) };
  const plan = { __typename: "ApprovalRequired", approval, requiredAmount: { raw: "1000000000000", decimals: 18 } };
  await expect(aaveFixture({ transaction: { ...plan, approval: { ...approval, to: wallet } } }).service.propose(params, wallet)).rejects.toThrow("different token or spender");
  await expect(aaveFixture({ transaction: { ...plan, approval: { ...approval, data: encodeFunctionData({ abi: erc20Abi, functionName: "approve", args: [wallet, maxUint256] }) } } }).service.propose(params, wallet)).rejects.toThrow("different token or spender");
  await expect(aaveFixture({ transaction: { ...plan, requiredAmount: { raw: "2000000000000", decimals: 18 } } }).service.propose(params, wallet)).rejects.toThrow("does not match");
  const legacy = await aaveFixture({ transaction: { ...plan, __typename: "Erc20ApprovalRequired", approval: undefined, byTransaction: approval } }).service.propose(params, wallet);
  expect(legacy.parameters.stage).toBe("approval");
});
test("Aave blocks error warnings before building and rejects wrong-chain transactions", async () => {
  const { service, calls } = aaveFixture({ warning: "error" });
  await expect(service.propose(params, wallet)).rejects.toThrow("cannot proceed");
  expect(calls.some((item) => item.name === "prepare_action")).toBe(false);
  await expect(aaveFixture({ transaction: { ...tx, chainId: 1 } }).service.propose(params, wallet)).rejects.toThrow();
  await expect(service.propose({ ...params, chainId: 1 }, wallet)).rejects.toThrow("Base v3");
  await expect(service.call("submit_signed_order", {}, wallet)).rejects.toThrow("not supported");
});
test("Aave approval-only results are identified separately from the eventual supply", async () => {
  const approval = { ...tx, to: token, value: "0", data: encodeFunctionData({ abi: erc20Abi, functionName: "approve", args: [market, maxUint256] }) };
  const { service } = aaveFixture({ transaction: { __typename: "ApprovalRequired", approval, originalTransaction: tx, requiredAmount: { raw: "1000000000000", decimals: 18 }, warnings: [{ level: "info", message: "Approval is required first" }] } });
  const plan = await service.propose(params, wallet);
  expect(plan.parameters.stage).toBe("approval");
  expect(plan.calls).toHaveLength(1);
  expect(decodeFunctionData({ abi: erc20Abi, data: plan.calls[0]!.data })).toMatchObject({ functionName: "approve", args: [market, 1000000000000n] });
  expect(plan.preview).toContain("Spending limit: 0.000001 WETH");
  expect(plan.preview).toContain("Approval is required first");
  expect(plan.preview).toContain("only approves token spending");
});
test("official skills and supported schema tools are available", () => {
  for (const name of ["safe-transactions", "yield-analysis", "deleverage", "account-activity", "tx-confirmation"] as const) expect(aaveSkill(name)).toContain("https://mcp.aave.com");
  expect(aaveSchema("get_markets")).toMatchObject({ name: "get_markets" });
  expect(() => aaveSchema("cancel_order")).toThrow();
});
function researchFixture() {
  const data = new Map<string, unknown>();
  const store: ResearchStore = { async get<T>(key: string) { return data.get(key) as T | undefined; }, async put<T>(key: string, value: T) { data.set(key, value); } };
  const calls: Array<{ path: string; init?: RequestInit }> = [];
  let done = false;
  const request: typeof fetch = Object.assign(async function (this: unknown, url: RequestInfo | URL, init?: RequestInit) {
    expect(this).toBe(globalThis);
    calls.push({ path: String(url), init });
    return Response.json({ id: "agent_run_example", status: done ? "completed" : "running", output: { text: done ? "Market-implied odds: 42%. https://polymarket.com/event/example" : "" } });
  }, { preconnect() {} });
  return { service: new PolymarketService("test-not-a-real-key", store, request, async () => {}), calls, finish: () => { done = true; } };
}
test("Polymarket status and duplicate events reuse the saved paid run", async () => {
  const { service, calls, finish } = researchFixture();
  expect((await service.research("owner:chat", "event", "Fed odds")).text).toContain("/polymarket status");
  await service.research("owner:chat", "event", "Fed odds");
  expect(calls.filter((item) => item.init?.method === "POST")).toHaveLength(1);
  const body = JSON.parse(String(calls[0]?.init?.body));
  expect(body).toMatchObject({ effort: "minimal", dataSources: [{ provider: "polymarket" }] });
  expect((await service.research("other:chat", "other-event")).text).toContain("No Polymarket research");
  finish();
  expect((await service.research("owner:chat", "status-event")).text).toContain("42%");
  expect(calls.filter((item) => item.init?.method === "POST")).toHaveLength(1);
});
