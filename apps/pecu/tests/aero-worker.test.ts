import { expect, test } from "bun:test";
import { AerodromeService } from "../src/aerodrome";
import { aeroWorkerExecutor } from "../src/cloudflare/aero-client";
import worker from "../src/cloudflare/aero-worker";

const wallet = "0x1111111111111111111111111111111111111111" as const;

test("Aero Worker rejects a foreign chain before contacting RPC", async () => {
  const response = await worker.fetch(new Request("https://aero.internal/", {
    method: "POST", body: JSON.stringify({ action: "pools", parameters: { chain: 10 } }),
  }), { ALCHEMY_RPC_URL: "https://invalid.example" });
  expect(response.status).toBe(400);
});

test("a stock_basket request on a foreign chain is rejected before any RPC", async () => {
  const response = await worker.fetch(new Request("https://aero.internal/", {
    method: "POST",
    body: JSON.stringify({
      action: "stock_basket", chain: 10, wallet,
      trades: [{ side: "buy", stock: "NVDAc", amount: "1" }], slippage: 0.01,
    }),
  }), { ALCHEMY_RPC_URL: "https://invalid.example" });
  expect(response.status).toBe(400);
});

test("a stock_basket request with malformed trades is rejected before any RPC", async () => {
  for (const trades of [
    [],
    [{ side: "hold", stock: "NVDAc", amount: "1" }],
    [{ side: "buy", stock: "NVDAc", amount: "one" }],
    [{ side: "buy", stock: "NVDAc", amount: "1", extra: true }],
  ]) {
    const response = await worker.fetch(new Request("https://aero.internal/", {
      method: "POST",
      body: JSON.stringify({ action: "stock_basket", chain: 8453, wallet, trades, slippage: 0.01 }),
    }), { ALCHEMY_RPC_URL: "https://invalid.example" });
    expect(response.status).toBe(400);
  }
});

test("Aero service propagates remote failures and accepts the next request", async () => {
  let calls = 0;
  const execute = aeroWorkerExecutor({ fetch: async () => ++calls === 1
    ? Response.json({ error: "RPC unavailable" }, { status: 502 })
    : Response.json([]) });
  const service = new AerodromeService({ baseRpcUrl: "https://invalid.example", maxSlippageBps: 100 }, execute);
  await expect(service.run(wallet, "pools", { limit: 1 })).rejects.toThrow("RPC unavailable");
  expect((await service.run(wallet, "pools", { limit: 1 })).kind).toBe("read");
});

test("remote transaction plans still pass the bot's call validation", async () => {
  const service = new AerodromeService({ baseRpcUrl: "https://invalid.example", maxSlippageBps: 100 }, async () => ({
    transaction_steps: [{ role: "swap", transaction: { to: "invalid", data: "0x", value: "0" } }],
  }));
  await expect(service.run(wallet, "swap", {
    from_token: "ETH", to_token: "USDC", amount: "0.001", use_decimals: true,
  })).rejects.toThrow();
});
