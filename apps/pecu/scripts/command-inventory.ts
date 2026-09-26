import { ACTION_SPECS } from "@beegreat/sugar";
import { SUGAR_ACTIONS, isSugarTxAction } from "@beegreat/sugar/contracts";
import { aeroTools } from "../src/cloudflare/aero-tools";
import { evmTools } from "../src/cloudflare/evm-tools";
import { EVM_TX_ACTIONS } from "../src/evm";
import { polymarketEndpointNames } from "../src/integrations/polymarket/catalog.generated";
import { nansenEndpointNames } from "../src/integrations/nansen";
import aaveTools from "../src/integrations/aave-tools.json";
import { aaveParameters } from "../src/integrations/aave";

const root = new URL("../", import.meta.url);
const domain = await Bun.file(new URL("src/domain.ts", root)).text();
const commands = new Set([...domain.matchAll(/\bverb === "([^"]+)"/g)].map(match => `/${match[1]}`));
const harness = await Bun.file(new URL("src/cloudflare/opencode.ts", root)).text();
const inlineTools = new Set([...harness.matchAll(/draft\.add\(\{\s*name: "([^"]+)"/g)].map(match => match[1]));

const writes = new Set<string>([
  ...EVM_TX_ACTIONS.map(action => action.startsWith("safe_") ? action : `evm_${action}`),
  ...aeroTools.filter(tool => isSugarTxAction(tool.action)).map(tool => tool.name),
  "aero_stock_trades", "aero_liquidity",
]);
const modelTools = [...new Set([
  ...inlineTools, ...aeroTools.map(tool => tool.name), ...evmTools.map(tool => tool.name),
  ...polymarketEndpointNames.map(name => `polymarket_${name}`), ...nansenEndpointNames.map(name => `nansen_${name}`),
])].sort();

console.log(JSON.stringify({
  scope: "Source inventory, not execution evidence. Every row still needs a recipe, prerequisites, channel/provider coverage and a recorded result.",
  commands: [...commands].sort(),
  prefixes: ["/", "b/", "bare except yolo"],
  parserSource: "src/domain.ts",
  subcommands: {
    deposit: ["default", "amount", "setup", "status"],
    yolo: ["status", "on", "off"],
    verbose: ["default", "page"],
    aero: ["help", "--help", "-h", ...SUGAR_ACTIONS.map(action => action.replaceAll("_", "-"))],
    polymarket: ["help", "status", "research", "question", ...polymarketEndpointNames.map(name => `read ${name}`)],
    nansen: ["help", "token", "flows", "portfolio", "wallet", "pnl", "markets"],
  },
  aeroActions: SUGAR_ACTIONS.map(action => ({ action, onchain: isSugarTxAction(action), parameters: ACTION_SPECS[action].allowed, required: ACTION_SPECS[action].required })),
  modelTools: modelTools.map(name => ({ name, onchain: writes.has(name), status: "not-run" })),
  aaveCalls: aaveTools.map(tool => ({ name: tool.name, parameters: tool.inputSchema, status: "not-run" })),
  aaveSigningActions: aaveParameters["shape"].action.options,
  manualAudit: [
    "Reconcile the listed subcommands and natural-language shortcuts against src/domain.ts after parser changes.",
    "aave_call.prepare_action dispatches to a separate signing flow. Test each supported signing action and approval continuation.",
    "onchain=false does not imply no side effects. Deposits, settings, proposals, research and catalog controls need their own expected outcomes.",
    "Test cancellation, expiry, duplicate delivery, repeated confirmation and interrupted execution in addition to successful command runs.",
  ],
}, null, 2));
