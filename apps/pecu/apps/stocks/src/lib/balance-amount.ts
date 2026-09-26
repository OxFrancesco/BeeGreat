/** Round display amounts without losing precision in the integer part. */
export function balanceAmount(value: string): string {
  const match = /^(\d+)(?:\.(\d+))?$/.exec(value);
  if (!match) return "Unavailable";
  const fraction = match[2] ?? "";
  const units = BigInt(match[1]!) * 1_000_000n
    + BigInt(fraction.padEnd(6, "0").slice(0, 6))
    + (Number(fraction[6] ?? "0") >= 5 ? 1n : 0n);
  const decimals = (units % 1_000_000n).toString().padStart(6, "0").replace(/0+$/, "");
  return `${units / 1_000_000n}${decimals ? `.${decimals}` : ""}`;
}
