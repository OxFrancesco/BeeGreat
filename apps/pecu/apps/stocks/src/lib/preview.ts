export type PreviewRow = Readonly<{ label: string; value: string }>;

/** Split a preview's plain text into groups of label/value rows for the card layout. */
export function previewRows(text: string): PreviewRow[][] {
  const groups: PreviewRow[][] = [];
  for (const block of text.split(/\n\s*\n/)) {
    const rows: PreviewRow[] = [];
    for (const raw of block.split("\n")) {
      const line = raw.trim();
      if (!line) continue;
      const arrow = /^(.+?) → about (.+)$/.exec(line);
      if (arrow) {
        rows.push({ label: "You pay", value: arrow[1]! });
        rows.push({ label: "You receive", value: `about ${arrow[2]!}` });
        continue;
      }
      const labelled = /^([^:]{1,40}): (.+)$/.exec(line);
      if (labelled) {
        rows.push({ label: labelled[1]!, value: labelled[2]!.replace(/\.$/, "") });
        continue;
      }
      rows.push({ label: "", value: line });
    }
    if (rows.length) groups.push(rows);
  }
  return groups;
}
