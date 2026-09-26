import { expect, test } from "bun:test";
import { jsonFieldsSchema, type JsonFields } from "../../../src/json-contract";
import { balanceAmount } from "../src/lib/balance-amount";
import { exceedsBalance, reviewTransfer, transferAttempt, transferDraftSchema } from "../src/lib/wallet-transfer";

const pecu = `0x${"11".repeat(20)}`;
const linked = `0x${"22".repeat(20)}`;

test("balance displays round to six decimals without changing large integer values", () => {
  expect(["0.00419881134121144", "5.907128", "1.2300000", "9.9999999", "9007199254740993.1234567", "0", "0.00000001"].map(balanceAmount))
    .toEqual(["0.004199", "5.907128", "1.23", "10", "9007199254740993.123457", "0", "0"]);
});

test("transfer validation keeps full precision and rejects unsafe or ambiguous fields", () => {
  const draft = { from: pecu, to: linked, token: "WETH", amount: "0.000000000000000001" };
  expect(transferDraftSchema.parse(draft).amount).toBe(draft.amount);
  for (const amount of ["0", "0.000", "-1", "1e3", "1,000", "NaN", "1 ETH", "."]) expect(transferDraftSchema.safeParse({ ...draft, amount }).success).toBe(false);
  expect(transferDraftSchema.safeParse({ ...draft, to: pecu }).success).toBe(false);
  expect(transferDraftSchema.safeParse({ ...draft, token: "ETH /yolo on" }).success).toBe(false);
  expect(exceedsBalance("9007199254740993.000001", "9007199254740993.0000009")).toBe(true);
  expect(exceedsBalance("0.004199", "0.00419881134121144")).toBe(true);
  expect(exceedsBalance("0.1", "0.1000")).toBe(false);
});

test("review retries reuse IDs, bind the selected source and never submit confirmation", async () => {
  const original = globalThis.fetch;
  const calls: { path: string; body: JsonFields }[] = [];
  let fail = true;
  globalThis.fetch = Object.assign(async (input: string | URL | Request, init?: RequestInit) => {
    const path = String(input);
    const body = jsonFieldsSchema.parse(JSON.parse(String(init?.body)));
    calls.push({ path, body });
    if (path.endsWith("/wallet")) return Response.json({ kind: "wallets", wallets: [] });
    if (fail) { fail = false; throw new Error("Disconnected"); }
    return Response.json({ status: "complete" });
  }, { preconnect: original.preconnect });
  try {
    const attempt = transferAttempt(transferDraftSchema.parse({ from: linked, to: pecu, token: "USDC", amount: "1.25" }));
    await expect(reviewTransfer(attempt, pecu)).rejects.toThrow("Disconnected");
    expect(await reviewTransfer(attempt, pecu)).toBe(attempt.threadId);
    const turns = calls.filter((call) => call.path.endsWith("/turn"));
    expect(turns[0]?.body).toEqual(turns[1]?.body);
    expect(turns[0]?.body).toEqual({ threadId: attempt.threadId, requestId: attempt.requestId, reviewWallet: linked, text: `/send 1.25 USDC to ${pecu}` });
    expect(calls[0]?.body).toEqual({ op: "use", threadId: attempt.threadId, address: linked });
    const reverse = transferAttempt(transferDraftSchema.parse({ from: pecu, to: linked, token: "ETH", amount: "0.001" }));
    await reviewTransfer(reverse, pecu);
    expect(calls.at(-2)?.body).toEqual({ op: "use", threadId: reverse.threadId, address: null });
  } finally { globalThis.fetch = original; }
});
