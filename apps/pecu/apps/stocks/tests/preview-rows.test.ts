import { expect, test } from "bun:test";
import { previewRows } from "../src/lib/preview";

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

test("a swap preview keeps its first line as a plain row", () => {
  const groups = previewRows(
    "Swap 0.001 ETH for about 3.9 USDC on Base.\nMinimum received: 3.8 USDC\nNetwork fee: not estimated yet.",
  );
  expect(groups).toEqual([
    [
      { label: "", value: "Swap 0.001 ETH for about 3.9 USDC on Base." },
      { label: "Minimum received", value: "3.8 USDC" },
      { label: "Network fee", value: "not estimated yet" },
    ],
  ]);
});
