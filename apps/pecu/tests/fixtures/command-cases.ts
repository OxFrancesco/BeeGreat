import { SUGAR_ACTIONS, type SugarAction } from "@beegreat/sugar/contracts";
import { polymarketEndpoints } from "../../src/integrations/polymarket/catalog.generated";
import type { Command } from "../../src/domain";
import type { JsonFields } from "../../src/json-contract";

const address = "0x1111111111111111111111111111111111111111";
const condition = `0x${"11".repeat(32)}`;
const examples = {
  stocks: "", positions: `--owner ${address}`, pools: "--token0 USDC --token1 AERO --pool-type cl --limit 3 --full",
  epochs: `--lp ${address} --limit 3 --offset 0`, epochs_latest: "--pool-type cl",
  quote: "--from-token ETH --to-token USDC --amount 0.001 --use-decimals",
  swap: "--from-token ETH --to-token USDC --amount 0.001 --use-decimals --slippage 0.005",
  deposit: `--pool ${address} --amount0 1 --amount1 1 --use-decimals`,
  withdraw: "--position 123 --fraction 0.5 --collect", stake: "--position 123", unstake: "--position 123",
  claim_emissions: "--position 123", claim_fees: "--position 123",
  create_venft: "--amount 1 --lock-duration-seconds 31536000 --use-decimals",
  stock_buy: "--stock NVDAc --amount 1", stock_sell: "--stock NVDAc --amount 0.001", index_rebalance: "--allocations NVDAc=50,AAPLc=50 --cash 1",
} satisfies Record<SugarAction, string>;
const basic: { command: string; type: Command["type"] }[] = [
  ...["help", "start"].map(command => ({ command, type: "help" as const })),
  { command: "wallet", type: "wallet" }, { command: "balance", type: "balance" }, { command: "stocks", type: "aero" },
  { command: "token USDC", type: "token" }, { command: `allowance USDC for ${address}`, type: "allowance" },
  ...[`send 1 USDC to ${address}`, `approve 1 USDC for ${address}`, `revoke USDC for ${address}`].map(command => ({ command, type: "evm" as const })),
  ...["quote 0.001 ETH to USDC", "swap 0.001 ETH to USDC"].map(command => ({ command, type: "aero" as const })),
  { command: "confirm ABC123", type: "confirm" }, { command: "cancel ABC123", type: "cancel" },
  ...["yolo", "yolo on", "yolo off"].map(command => ({ command, type: "yolo" as const })),
  ...["verbose", "verbose 2"].map(command => ({ command, type: "verbose" as const })),
  ...["deposit", "deposit 50"].map(command => ({ command, type: "deposit" as const })),
  { command: "deposit setup test@example.com", type: "deposit-setup" }, { command: "deposit status", type: "deposit-status" },
  ...["aero", "aero help", "aero --help", "aero -h"].map(command => ({ command, type: "aero-help" as const })),
  ...["aave", "aave help"].map(command => ({ command, type: "aave-help" as const })),
  ...["nansen", "nansen help"].map(command => ({ command, type: "nansen-help" as const })),
  ...[`nansen token ${address} base 7d`, `nansen flows ${address} base 7d`, "nansen portfolio", `nansen portfolio ${address}`, "nansen wallet", `nansen wallet ${address} ethereum`, "nansen pnl", `nansen pnl ${address} base`, "nansen markets fed"].map(command => ({ command, type: "nansen" as const })),
  ...["polymarket", "polymarket help"].map(command => ({ command, type: "polymarket-help" as const })),
  ...["polymarket status", "polymarket research Compare Fed markets"].map(command => ({ command, type: "polymarket" as const })),
  { command: "polymarket Fed rates", type: "polymarket-read" },
];
const requiredValues: JsonFields = { user: address, address, condition, id: "1", slug: "test-market", condition_id: condition, token_id: "123", side: "BUY", q: "Fed", event_id: "1" };
const polymarket = Object.values(polymarketEndpoints).map(endpoint => {
  const input: JsonFields = {};
  for (const [name, field] of Object.entries(endpoint.input["shape"])) {
    if (field.isOptional()) continue;
    if (!(name in requiredValues)) throw new Error(`Missing command fixture for ${endpoint.name}.${name}`);
    input[name] = requiredValues[name];
  }
  if (["positions", "holders", "oi", "resolutions", "trades"].includes(endpoint.name)) input.condition = condition;
  if (endpoint.name === "prices_history") input.interval = "1d";
  return { command: `polymarket read ${endpoint.name} ${JSON.stringify(input)}`, type: "polymarket-read" as const, endpoint: endpoint.name };
});
export const commandCases = [
  ...basic,
  ...SUGAR_ACTIONS.map(action => {
    if (!(action in examples)) throw new Error(`Missing Aero command fixture: ${action}`);
    return { command: `aero ${action.replaceAll("_", "-")} ${examples[action]}`.trim(), type: "aero" as const, action };
  }),
  ...polymarket,
].flatMap(row => (row.type === "yolo" ? ["/", "b/"] : ["/", "b/", ""]).map(prefix => ({ ...row, command: prefix + row.command })));
