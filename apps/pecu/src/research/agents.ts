import generated from "../research-agents.generated.json";
import { slugify, type ChainDataService, type ChainSpec } from "../integrations/chain-data";
import { nansenChains } from "../integrations/nansen";
import type { ResearchRole } from "../research-contract";

type AgentEntry = Readonly<{ name: string; label: string; description: string; tools: readonly string[]; budget: number; content: string }>;
type ChainEntry = Readonly<{ id: string; name: string; aliases: readonly string[]; defillama: string; growthepie?: string; nansen?: string; coins: readonly string[]; accounts: readonly string[]; notes: string }>;

const agents: Readonly<Record<string, AgentEntry>> = generated.agents;
const chains: Readonly<Record<string, ChainEntry>> = generated.chains;

export const researchCore = generated.core;

export type ChainProfile = ChainSpec & Readonly<{ aliases: readonly string[]; accounts: readonly string[]; notes: string; curated: boolean }>;

export function researchAgent(role: ResearchRole): AgentEntry {
  const agent = agents[role];
  if (!agent) throw new Error(`Unknown research agent ${role}`);
  return agent;
}

export function roleLabel(role: ResearchRole): string {
  return researchAgent(role).label;
}

/** Whether a role may see a tool: exact names, or prefixes written as `prefix_*`. */
export function researchToolVisible(role: ResearchRole, tool: string): boolean {
  return researchAgent(role).tools.some((pattern) => pattern.endsWith("*") ? tool.startsWith(pattern.slice(0, -1)) : pattern === tool);
}

export const researchToolNames = ["research_findings", "research_report"] as const;

export function curatedChains(): ChainProfile[] {
  return Object.values(chains).map((chain) => ({ ...chain, curated: true }));
}

function normalized(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

/** A curated chain by id, name or alias. */
export function curatedChain(query: string): ChainProfile | undefined {
  const wanted = normalized(query);
  return curatedChains().find((chain) => chain.id === wanted || normalized(chain.name) === wanted || normalized(chain.defillama) === wanted || chain.aliases.some((alias) => normalized(alias) === wanted));
}

/** A curated chain profile, or a DefiLlama chain with a generic profile. Undefined when DefiLlama does not know it either. */
export async function resolveChainProfile(query: string, data: Pick<ChainDataService, "findChain">): Promise<ChainProfile | undefined> {
  const curated = curatedChain(query);
  if (curated) return curated;
  const found = await data.findChain(query).catch(() => undefined);
  if (!found) return undefined;
  const id = slugify(found.name);
  const nansen = nansenChains.find((chain) => chain === id || chain === found.name.toLowerCase());
  return {
    id, name: found.name, defillama: found.name, nansen,
    coins: [...(found.gasTokenGeckoId ? [`coingecko:${found.gasTokenGeckoId}`] : []), "coingecko:bitcoin"].slice(0, 2),
    aliases: [], accounts: [], notes: "", curated: false,
  };
}

/** The instructions a research session runs with: the shared core, the role and the chain profile. */
export function researchInstructions(role: ResearchRole, chain: ChainProfile): string {
  const agent = researchAgent(role);
  const accounts = chain.accounts.length ? chain.accounts.map((handle) => `@${handle}`).join(", ") : "none listed; find them with twitter_user_search";
  const coverage = [
    `DefiLlama chain name: ${chain.defillama}.`,
    chain.growthepie ? `growthepie covers it as ${chain.growthepie}.` : "growthepie does not cover it.",
    chain.nansen ? `Nansen chain id: ${chain.nansen}.` : "Nansen does not cover it.",
    `Official X accounts: ${accounts}.`,
  ].join(" ");
  return [researchCore, agent.content, `## Chain profile: ${chain.name}\n\n${coverage}${chain.notes ? `\n\n${chain.notes}` : ""}`].join("\n\n");
}
