import { expect, test } from "bun:test";
import {
  confirmationLabel,
  previewPresentation,
  previewRows,
} from "../src/lib/preview";

test("a two-trade stock preview becomes two groups of pay/receive rows", () => {
  const groups = previewRows(
    "1 USDC → about 0.005 NVDAc\nMinimum received: 0.00495 NVDAc\n\n2 USDC → about 0.01 AAPLc\nMinimum received: 0.0099 AAPLc\nNetwork fee: not estimated yet.",
  );
  expect(groups).toEqual([
    [
      { label: "You pay", value: "1 USDC" },
      { label: "You receive", value: "about 0.005 NVDAc" },
      { label: "Minimum received", value: "0.00495 NVDAc" },
    ],
    [
      { label: "You pay", value: "2 USDC" },
      { label: "You receive", value: "about 0.01 AAPLc" },
      { label: "Minimum received", value: "0.0099 AAPLc" },
      { label: "Network fee", value: "not estimated yet" },
    ],
  ]);
});

test("a swap preview promotes exact amounts and preserves its minimum and fee", () => {
  const groups = previewRows(
    "Swap 0.001 ETH for about 3.9 USDC on Base.\nMinimum received: 3.8 USDC\nNetwork fee: not estimated yet.",
  );
  expect(groups).toEqual([
    [
      { label: "You pay", value: "0.001 ETH" },
      { label: "You receive", value: "about 3.9 USDC" },
      { label: "Network", value: "Base" },
      { label: "Minimum received", value: "3.8 USDC" },
      { label: "Network fee", value: "not estimated yet" },
    ],
  ]);
});

test("full transfer addresses and precise token amounts survive presentation", () => {
  const address = `0x${"a".repeat(40)}`;
  const result = previewPresentation(
    `Send 0.000000000000000001 ETH to ${address}\nNetwork fee: not estimated yet.`,
  );
  expect(result.groups[0]!.amounts[0]!.value).toBe("0.000000000000000001 ETH");
  expect(result.groups[0]!.details[0]!.value).toBe(address);
  expect(result.metadata).toEqual([
    { label: "Network fee", value: "not estimated yet" },
  ]);
});

test("basket minima stay attached to their trade; fee is shown once", () => {
  const result = previewPresentation(
    "1 USDC → about 0.005 NVDAc\nMinimum received: 0.00495 NVDAc\n\n2 USDC → about 0.01 AAPLc\nMinimum received: 0.0099 AAPLc\nNetwork fee: not estimated yet.",
  );
  expect(result.basket).toBe(true);
  expect(result.groups.map((group) => group.details[0]!.value)).toEqual([
    "0.00495 NVDAc",
    "0.0099 AAPLc",
  ]);
  expect(result.metadata).toHaveLength(1);
});

test("approval and revoke retain the exact spender and allowance", () => {
  const spender = `0x${"b".repeat(40)}`;
  expect(
    previewPresentation(`Approve ${spender} to spend 150 USDC`).groups[0],
  ).toEqual({
    amounts: [{ label: "Spending limit", value: "150 USDC" }],
    details: [{ label: "Spender", value: spender }],
  });
  expect(
    previewPresentation(`Revoke USDC allowance for ${spender}`).groups[0]!
      .amounts[0]!.value,
  ).toBe("0 USDC");
});

test("Aave approvals retain the continuation instruction and simulation warnings", () => {
  const text =
    "Aave token approval on Base. Amount: 150 USDC.\nWarning: Check your health factor.\nThis only approves token spending. After confirmation, ask me to continue the original Aave action.";
  const result = previewPresentation(text);
  expect(result.groups[0]!.amounts[0]!.value).toBe("150 USDC");
  expect(result.groups[0]!.details.map((r) => r.value).join(" ")).toContain(
    "After confirmation, ask me to continue",
  );
  expect(result.groups[0]!.details.some((r) => r.label === "Warning")).toBe(
    true,
  );
});

test("unknown contract and liquidity text is not discarded or misclassified", () => {
  const result = previewPresentation(
    "Stake position on Base\nPosition: 123\nCustom constraint without a colon\nMinimum liquidity: 400",
  );
  expect(result.groups[0]!.amounts).toEqual([]);
  expect(result.groups[0]!.details.map((r) => r.value)).toEqual([
    "Stake position on Base",
    "123",
    "Custom constraint without a colon",
    "400",
  ]);
  expect(confirmationLabel("Contract call")).toBe("Confirm transaction");
});

test("different per-group fees retain their association", () => {
  const result = previewPresentation(
    "1 USDC → about 1 AAA\nNetwork fee: 0.01 ETH\n\n2 USDC → about 2 BBB\nNetwork fee: 0.02 ETH",
  );
  expect(result.metadata).toEqual([]);
  expect(result.groups.map((group) => group.details[0]!.value)).toEqual([
    "0.01 ETH",
    "0.02 ETH",
  ]);
});
