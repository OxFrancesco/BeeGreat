/** Native ETH and its canonical Base wrapper are chain identities, not a token whitelist. */
export function canonicalToken(reference: string): string {
  if (reference.toUpperCase() === "ETH") return "ETH";
  if (reference.toUpperCase() === "WETH") return "0x4200000000000000000000000000000000000006";
  return reference;
}
