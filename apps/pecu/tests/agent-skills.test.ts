import { expect, test } from "bun:test";
import { baseTools, coreInstructions, selectSkills, skillForTool, skillNames, skillsForText, taskInstructions, toolVisible, type AgentSkill } from "../src/agent-skills";
import { aeroTools } from "../src/cloudflare/aero-tools";
import { evmTools } from "../src/cloudflare/evm-tools";
import { polymarketEndpointNames } from "../src/integrations/polymarket/catalog.generated";
import { nansenEndpointNames } from "../src/integrations/nansen";

const taskTools = ["aave_skill", "aave_schema", "aave_call", "polymarket_research", "deposit_instructions", "deposit_setup", "deposit_status", "aero_liquidity", "aero_stock_trades",
  ...aeroTools.map(tool => tool.name), ...evmTools.map(tool => tool.name),
  ...polymarketEndpointNames.map(name => `polymarket_${name}`), ...nansenEndpointNames.map(name => `nansen_${name}`)];

test.each(taskTools)("%s belongs to a skill", name => {
  const skill = skillForTool(name);
  expect(skill).toBeDefined();
  expect(toolVisible(name, [])).toBe(false);
  expect(toolVisible(name, [skill!])).toBe(true);
});

test("every skill owns tools and the skill list marks which are loaded", () => {
  const owned = new Set(taskTools.map(skillForTool));
  const list = taskInstructions(["wallet"]);
  for (const name of skillNames) {
    expect(owned.has(name), name).toBe(true);
    expect(list).toContain(`- ${name}: ${name === "wallet" ? "loaded" : "not loaded"}. `);
  }
  for (const name of baseTools) expect(skillForTool(name)).toBeUndefined();
  expect(Buffer.byteLength(coreInstructions)).toBeLessThan(4_500);
  for (const rule of ["Never enable YOLO yourself", "Suggested parameters are not authorization", "same /confirm CODE", "load_skills"]) expect(coreInstructions).toContain(rule);
});

test("Polymarket odds tools stay separate from account and research tools", () => {
  for (const name of ["search", "midpoint", "book", "prices_history", "market_by_slug"]) expect(skillForTool(`polymarket_${name}`)).toBe("polymarket");
  for (const name of ["positions", "leaderboard", "user_pnl", "status", "research"]) expect(skillForTool(`polymarket_${name}`)).toBe("polymarket-data");
});

const cases: [string, AgentSkill[]][] = [
  ["Quote 0.001 ETH to USDC", ["aerodrome"]],
  ["Put half my ETH into ETH/USDC liquidity", ["aerodrome"]],
  ["Buy $1 of NVDAc and $1 of AAPLc", ["aerodrome"]],
  ["Stake position 123", ["aerodrome"]],
  ["Send 1 USDC to 0x1111111111111111111111111111111111111111", ["wallet"]],
  ["What is my USDC allowance for 0x1111111111111111111111111111111111111111?", ["wallet"]],
  ["Create a Safe with two signers", ["safe"]],
  ["Can you create a safe for me?", ["safe"]],
  ["Show my safes", ["safe"]],
  ["What Safes do I have?", ["safe"]],
  ["I want a shared wallet for my team", ["safe"]],
  ["Make a 2 of 3 wallet with my cofounders", ["safe"]],
  ["Is it safe to hold USDC?", []],
  ["Supply 5 USDC to Aave", ["aave"]],
  ["What are Polymarket's odds of a Fed cut in December?", ["polymarket"]],
  ["Show the Polymarket leaderboard", ["polymarket", "polymarket-data"]],
  ["Who is buying AERO? Show smart money flows", ["nansen"]],
  ["How do I add money with a bank transfer?", ["funding"]],
  ["Use this plan", []],
  ["hello", []],
];
test.each(cases)("%s selects %p", (text, expected) => {
  expect(skillsForText(text)).toEqual(expected);
});

test("selection prefers the user's words, then the classifier family, then the previous turn", () => {
  expect(selectSkills({ text: "Swap 1 USDC to ETH", family: "wallet", carried: ["nansen"] })).toEqual(["aerodrome"]);
  expect(selectSkills({ text: "Do the usual", family: "wallet", carried: ["nansen"] })).toEqual(["safe", "wallet"]);
  expect(selectSkills({ text: "Use this plan", family: "all", carried: ["aerodrome", "unknown"] })).toEqual(["aerodrome"]);
  expect(selectSkills({ text: "Use this plan" })).toEqual([]);
  expect(selectSkills({ text: "Polymarket odds", loaded: ["wallet", "bogus"] })).toEqual(["polymarket", "wallet"]);
});

test("task instructions are stable and contain only the active skills", () => {
  expect(taskInstructions(["wallet", "aerodrome"])).toBe(taskInstructions(["aerodrome", "wallet", "aerodrome"]));
  expect(taskInstructions(["polymarket"])).toContain("Polymarket odds");
  expect(taskInstructions(["polymarket"])).not.toContain("Organization wallets");
  expect(taskInstructions([])).not.toContain("prepare_action");
});
