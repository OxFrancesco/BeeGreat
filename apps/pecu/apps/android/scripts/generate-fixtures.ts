import { webStateSchema } from "../../../src/web-contract";
import { webTurnEventSchema } from "../../../src/web-stream";

const state = webStateSchema.parse({
  wallet: "0x0000000000000000000000000000000000000001", yolo: false, senderKind: "web", signer: null,
  threadId: "native-contract", stocks: null, stocksAt: null, basket: null,
  olderCursor: { at: 100, row: 1 }, newerCursor: null,
  messages: [
    { id: "question", text: "Inspect my wallet", createdAt: 100, canRetry: false, reply: { text: "Which token?", preview: null, question: { question: "Which token?", options: ["ETH", "USDC"] } } },
    { id: "preview", text: "Preview a transfer", createdAt: 101, reply: { text: "Review the transfer.", preview: {
      code: "ABC234", title: "Send USDC", text: "Send 1 USDC to 0x0000000000000000000000000000000000000002", state: "pending", expiresAt: 200,
      plan: { steps: [{ kind: "transfer", title: "Send 1 USDC", contract: "0x0000000000000000000000000000000000000003", status: "waiting" }] },
    } } },
    { id: "analytics", text: "Show token flows", createdAt: 102, reply: { text: "Token flows", preview: null, analyticsOnly: true, analytics: [{ text: "Whales: $12 net", snapshot: { key: "flows", kind: "flows", observedAt: 102, subject: "USDC", chain: "base", period: "24h", partial: false, rows: [{ label: "Whales", netUsd: 12, wallets: 3 }] } }] } },
  ],
});
const events = [
  { type: "stage", stage: { id: "first", label: "Reading balances", startedAt: 100, status: "running" } },
  { type: "paragraph", text: "Your balance", replace: true },
  { type: "complete", status: "complete" },
].map((event) => webTurnEventSchema.parse(event));
const folder = new URL("../app/src/test/resources/", import.meta.url);
await Bun.write(new URL("state.json", folder), JSON.stringify(state, null, 2) + "\n");
await Bun.write(new URL("events.json", folder), JSON.stringify(events, null, 2) + "\n");

const { readPositionSnapshot, compactPositionAmount } = await import("../../../src/position-contract");
const pool = "0xb2cc224c1c9feE385f8ad6a55b4d94E92359DC59";
const rows = [
  ["77018794", "641062895327367", "2004739"],
  ["77024465", "320770072925988", "1003115"],
  ["77027019", "160465799691927", "501810"],
].map(([id, weth, usdc]) => ({ id, chain_name: "Base", pool: { symbol: "CL100-WETH/USDC", lp: pool, token0: { symbol: "WETH", decimals: 18 }, token1: { symbol: "USDC", decimals: 6 } }, amount_token0: weth, amount_token1: usdc, staked_token0: "0", staked_token1: "0" }));
const snapshot = readPositionSnapshot(rows, 123)!;
const legacy = snapshot.positions.map(row => `${row.label} · Position ${row.id} · ${row.chain}\nPool: ${row.pool}\nUnstaked: ${row.token0.unstaked} ${row.token0.symbol} + ${row.token1.unstaked} ${row.token1.symbol}\nStaked: ${row.token0.staked} ${row.token0.symbol} + ${row.token1.staked} ${row.token1.symbol}`).join("\n\n");
const amounts = ["0", "0.00000001", "0.000641062895327367", "2.004739", "100.200000", "123456789.12345", "0.00100000"].map(exact => ({ exact, compact: compactPositionAmount(exact) }));
await Bun.write(new URL("positions.json", folder), JSON.stringify({ snapshot, legacy, amounts }, null, 2) + "\n");
