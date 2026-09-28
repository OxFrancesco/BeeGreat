import generated from "./agent-skills.generated.json";
import type { ToolFamily } from "./tool-families";

type SkillEntry = Readonly<{ description: string; tools: readonly string[]; triggers: string; content: string }>;
const skills: Readonly<Record<string, SkillEntry>> = generated.skills;
export type AgentSkill = keyof typeof generated.skills;
// SAFETY: the keys come from the generated skill map, which the build script requires to be non-empty.
const names = Object.keys(skills).sort() as [AgentSkill, ...AgentSkill[]];
export const skillNames = names;
export const skillMarker = "Pecu skills. ";
export const baseTools: ReadonlySet<string> = new Set(["ask_user", "load_skills", "wallet_address", "wallet_balances"]);

export const coreInstructions = generated.core;

const familySkills = {
  wallet: ["wallet", "safe"],
  defi: ["aerodrome", "aave", "wallet"],
  markets: ["polymarket"],
  analytics: ["nansen"],
  funding: ["funding"],
  all: [],
} as const satisfies Record<ToolFamily, readonly AgentSkill[]>;
const exactOwners = new Map(skillNames.flatMap(name => skills[name].tools.filter(tool => !tool.endsWith("*")).map(tool => [tool, name] as const)));
const prefixOwners = skillNames.flatMap(name => skills[name].tools.filter(tool => tool.endsWith("*")).map(tool => [tool.slice(0, -1), name] as const));
const triggers = skillNames.map(name => [name, new RegExp(skills[name].triggers, "i")] as const);

export function isAgentSkill(name: string): name is AgentSkill {
  return Object.hasOwn(skills, name);
}

export function skillForTool(name: string): AgentSkill | undefined {
  return exactOwners.get(name) ?? prefixOwners.find(([prefix]) => name.startsWith(prefix))?.[1];
}

export function skillsForText(text: string): AgentSkill[] {
  return triggers.flatMap(([name, pattern]) => pattern.test(text) ? [name] : []);
}

export function selectSkills(input: Readonly<{ text: string; family?: ToolFamily; carried?: readonly string[]; loaded?: readonly string[] }>): AgentSkill[] {
  const matched = skillsForText(input.text);
  const family: readonly AgentSkill[] = input.family ? familySkills[input.family] : [];
  const base = matched.length ? matched : family.length ? family : (input.carried ?? []).filter(isAgentSkill);
  const selected = new Set([...base, ...(input.loaded ?? []).filter(isAgentSkill)]);
  return skillNames.filter(name => selected.has(name));
}

export function toolVisible(name: string, active: readonly AgentSkill[]): boolean {
  if (baseTools.has(name)) return true;
  const owner = skillForTool(name);
  return owner !== undefined && active.includes(owner);
}

export function taskInstructions(active: readonly AgentSkill[]): string {
  const index = skillNames.map(name => `- ${name}: ${active.includes(name) ? "loaded" : "not loaded"}. ${skills[name].description}`).join("\n");
  const loaded = skillNames.filter(name => active.includes(name)).map(name => skills[name].content).join("\n\n");
  return `${skillMarker}Tools of loaded skills are already visible; never load them again. Call load_skills only for a skill marked not loaded.\n${index}${loaded ? `\n\n${loaded}` : ""}`;
}
