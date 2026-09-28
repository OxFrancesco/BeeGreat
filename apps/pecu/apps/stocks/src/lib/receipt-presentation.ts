export type ReceiptLink = Readonly<{ url: string; hash: string; label: string }>;
export type ReceiptBlock = Readonly<{ kind: "text"; text: string }> | Readonly<{ kind: "receipts"; links: readonly ReceiptLink[] }>;

const receiptUrl = /^https:\/\/basescan\.org\/tx\/(0x[\da-fA-F]{64})$/;

export function receiptLink(url: string, label = ""): ReceiptLink | undefined {
  const match = receiptUrl.exec(url);
  if (!match) return undefined;
  return { url, hash: match[1]!, label: !label || label === url || /^0x[\da-fA-F]{64}$/.test(label) ? "View transaction" : label };
}

function standalone(line: string): ReceiptLink | undefined {
  let text = line.trim().replace(/^(?:[-*+] |\d+[.)] )/, "");
  if ((text.startsWith("**") && text.endsWith("**")) || (text.startsWith("__") && text.endsWith("__"))) text = text.slice(2, -2);
  const named = /^\[([^\]\n]+)\]\(([^\s)]+)\)$/.exec(text);
  if (named) return receiptLink(named[2]!, named[1]!);
  if (text.startsWith("<") && text.endsWith(">")) text = text.slice(1, -1);
  return receiptLink(text);
}

function inlineReceipts(line: string): string {
  // Code and image tokens must remain literal. Unknown URLs keep their text.
  return line.replace(/(`+).*?\1|`+.*$|!?\[[^\]\n]*\]\([^\s)]+\)|https?:\/\/[^\s<>()]+/g, (token) => {
    if (token.startsWith("`") || token.startsWith("!")) return token;
    const named = /^\[([^\]\n]*)\]\(([^\s)]+)\)$/.exec(token);
    const url = named?.[2] ?? token.replace(/[.,;]+$/, "");
    const receipt = receiptLink(url, named?.[1]);
    if (!receipt) return token;
    if (named && receipt.label === named[1]) return token;
    return `[${receipt.label}](${receipt.url})${named ? "" : token.slice(url.length)}`;
  });
}

/** Presentation only: the saved reply and copy payload are never modified. */
export function receiptPresentation(text: string): ReceiptBlock[] {
  if (!text.includes("https://basescan.org/tx/")) return text ? [{ kind: "text", text }] : [];
  const blocks: ReceiptBlock[] = [];
  let lines: string[] = [];
  let links: ReceiptLink[] = [];
  let fence: string | undefined;
  const flushText = () => { if (lines.some((line) => line.trim())) blocks.push({ kind: "text", text: lines.join("\n") }); lines = []; };
  const flushLinks = () => { if (links.length) blocks.push({ kind: "receipts", links }); links = []; };
  for (const line of text.split("\n")) {
    const marker = /^ {0,3}(`{3,}|~{3,})/.exec(line)?.[1];
    const literal = fence !== undefined || marker !== undefined || /^( {4}|\t)/.test(line);
    if (marker && !fence) fence = marker;
    else if (marker && fence && marker[0] === fence[0] && marker.length >= fence.length && line.trim() === marker) fence = undefined;
    const receipt = literal ? undefined : standalone(line);
    if (receipt) {
      flushText();
      if (!links.some((link) => link.hash.toLowerCase() === receipt.hash.toLowerCase() && link.label === receipt.label)) links.push(receipt);
    } else if (!line.trim() && links.length) {
      continue;
    } else {
      flushLinks(); lines.push(literal ? line : inlineReceipts(line));
    }
  }
  flushLinks(); flushText();
  return blocks;
}
