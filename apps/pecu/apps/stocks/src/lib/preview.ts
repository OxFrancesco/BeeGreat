export type PreviewRow = Readonly<{ label: string; value: string }>;

/** Split a preview's plain text into groups of label/value rows for the card layout. */
export function previewRows(text: string): PreviewRow[][] {
  const groups: PreviewRow[][] = [];
  for (const block of text.split(/\n\s*\n/)) {
    const rows: PreviewRow[] = [];
    for (const raw of block.split("\n")) {
      const line = raw.trim();
      if (!line) continue;
      const swap = /^Swap (.+?) for about (.+?) on Base\.$/.exec(line);
      if (swap) {
        rows.push(
          { label: "You pay", value: swap[1]! },
          { label: "You receive", value: `about ${swap[2]!}` },
          { label: "Network", value: "Base" },
        );
        continue;
      }
      const transfer = /^Send (.+?) to (0x[\da-fA-F….]+)\.?$/.exec(line);
      if (transfer) {
        rows.push(
          { label: "Amount", value: transfer[1]! },
          { label: "To", value: transfer[2]!.replace(/\.$/, "") },
        );
        continue;
      }
      const approval = /^Approve (0x[\da-fA-F]+) to spend (.+)$/.exec(line);
      if (approval) {
        rows.push(
          { label: "Spending limit", value: approval[2]! },
          { label: "Spender", value: approval[1]! },
        );
        continue;
      }
      const revoke = /^Revoke (.+?) allowance for (0x[\da-fA-F]+)$/.exec(line);
      if (revoke) {
        rows.push(
          { label: "Spending limit", value: `0 ${revoke[1]!}` },
          { label: "Spender", value: revoke[2]! },
        );
        continue;
      }
      const aave = /^Aave (.+?) on Base\. Amount: (.+)\.$/.exec(line);
      if (aave) {
        rows.push(
          { label: "Action", value: `Aave ${aave[1]!}` },
          { label: "Amount", value: aave[2]! },
          { label: "Network", value: "Base" },
        );
        continue;
      }
      const arrow = /^(.+?) → about (.+)$/.exec(line);
      if (arrow) {
        rows.push({ label: "You pay", value: arrow[1]! });
        rows.push({ label: "You receive", value: `about ${arrow[2]!}` });
        continue;
      }
      const labelled = /^([^:]{1,40}): (.+)$/.exec(line);
      if (labelled) {
        rows.push({
          label: labelled[1]!,
          value: labelled[2]!.replace(/\.$/, ""),
        });
        continue;
      }
      rows.push({ label: "", value: line });
    }
    if (rows.length) groups.push(rows);
  }
  return groups;
}

const prominent = new Set([
  "You pay",
  "You receive",
  "Amount",
  "Spending limit",
  "Send",
]);
const shared = new Set(["Network", "Network fee"]);

/** Only promote known fields; unrecognised summaries and warnings remain visible. */
export function previewPresentation(text: string) {
  const parsed = previewRows(text);
  const conflicting = new Set(
    [...shared].filter(
      (label) =>
        new Set(
          parsed
            .flat()
            .filter((row) => row.label === label)
            .map((row) => row.value),
        ).size > 1,
    ),
  );
  const metadata: PreviewRow[] = [];
  const groups = parsed
    .map((rows) => {
      const amounts: PreviewRow[] = [];
      const details: PreviewRow[] = [];
      for (const row of rows) {
        if (shared.has(row.label) && !conflicting.has(row.label))
          metadata.push(row);
        else if (prominent.has(row.label)) amounts.push(row);
        else details.push(row);
      }
      return { amounts, details };
    })
    .filter((group) => group.amounts.length || group.details.length);
  return {
    groups,
    metadata: metadata.filter(
      (row, index) =>
        metadata.findIndex(
          (other) => other.label === row.label && other.value === row.value,
        ) === index,
    ),
    basket:
      groups.filter((group) =>
        group.amounts.some((row) => row.label === "You pay"),
      ).length > 1,
  };
}

export function confirmationLabel(title = "") {
  if (/^Create Safe\b/i.test(title)) return "Confirm creation";
  if (/^Execute Safe\b/i.test(title)) return "Confirm execution";
  if (/^Spend from Safe\b/i.test(title)) return "Confirm payment";
  if (/approval|^Approve\b/i.test(title)) return "Confirm approval";
  if (/^Revoke\b/i.test(title)) return "Confirm revoke";
  if (/^Send\b/i.test(title)) return "Confirm send";
  if (/^Swap\b/i.test(title)) return "Confirm swap";
  if (/^Buy\b|^Sell\b|^Rebalance\b/i.test(title))
    return title.includes(" · ")
      ? "Confirm basket"
      : /^Sell\b/i.test(title)
        ? "Confirm sell"
        : /^Buy\b/i.test(title)
          ? "Confirm buy"
          : "Confirm rebalance";
  if (/^Add liquidity/i.test(title)) return "Confirm deposit";
  if (/^Remove liquidity/i.test(title)) return "Confirm withdrawal";
  if (/^Stake position/i.test(title)) return "Confirm stake";
  if (/^Unstake position/i.test(title)) return "Confirm unstake";
  if (/^Claim (fees|emissions)/i.test(title)) return "Confirm claim";
  if (/^Lock AERO/i.test(title)) return "Confirm lock";
  const aave = /^Aave (supply|borrow|withdraw|repay)$/i.exec(title);
  if (aave) return `Confirm ${aave[1]!.toLowerCase()}`;
  return "Confirm transaction";
}
