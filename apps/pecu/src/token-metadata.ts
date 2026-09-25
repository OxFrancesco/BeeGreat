import { KNOWN_TOKENS } from "@beegreat/sugar";

const tokens = new Map(Object.values(KNOWN_TOKENS[8453])
  .filter((token) => token.tokenAddress !== "ETH")
  .map((token) => [token.tokenAddress.toLowerCase(), { symbol: token.symbol, decimals: token.decimals }]));

export function knownTokenMetadata(address: string) {
  return tokens.get(address.toLowerCase());
}
