import { z } from "zod";

const root = new URL("../skills/pecu/", import.meta.url);
const metadata = z.strictObject({
  name: z.string().regex(/^pecu-[a-z-]+$/),
  description: z.string().min(1).max(200),
  tools: z.array(z.string().regex(/^[a-z]+_(?:[a-z_]+|\*)$/)).min(1).optional(),
  triggers: z.string().refine(source => { try { new RegExp(source, "i"); return true; } catch { return false; } }, "Invalid trigger pattern").optional(),
});
const frontmatter = (path: string, source: string) => {
  const match = /^---\n([\s\S]*?)\n---\n([\s\S]+)$/.exec(source);
  if (!match) throw new Error(`Invalid skill: ${path}`);
  return { data: Bun.YAML.parse(match[1]), content: match[2].trim() };
};
let core: string | undefined;
const skills: Record<string, { description: string; tools: string[]; triggers: string; content: string }> = {};
for (const path of [...new Bun.Glob("*/SKILL.md").scanSync({ cwd: root.pathname })].sort()) {
  const parsed = frontmatter(path, await Bun.file(new URL(path, root)).text());
  const { name, description, tools, triggers } = metadata.parse(parsed.data);
  if (name !== `pecu-${path.split("/")[0]}`) throw new Error(`Skill name mismatch: ${path}`);
  if (name === "pecu-core") { core = parsed.content; continue; }
  if (!tools || !triggers) throw new Error(`Task skill needs tools and triggers: ${path}`);
  skills[name.slice(5)] = { description, tools, triggers, content: parsed.content };
}
if (!core) throw new Error("Missing core skill");

// Research agents and chain profiles live in researches/: one shared core,
// one SKILL.md per specialist, one profile per chain.
const research = new URL("../researches/", import.meta.url);
const agentMetadata = z.strictObject({
  name: z.string().regex(/^research-[a-z]+$/),
  label: z.string().min(1).max(24),
  description: z.string().min(1).max(200),
  tools: z.array(z.string().regex(/^[a-z]+_(?:[a-z_]*\*|[a-z_]+)$/)).min(1),
  budget: z.number().int().min(1).max(80),
});
const chainMetadata = z.strictObject({
  id: z.string().regex(/^[a-z][a-z0-9-]{1,30}$/),
  name: z.string().min(1).max(40),
  aliases: z.array(z.string().min(1).max(40)).max(8).default([]),
  defillama: z.string().min(1).max(60),
  growthepie: z.string().regex(/^[a-z0-9_]+$/).optional(),
  nansen: z.string().regex(/^[a-z0-9]+$/).optional(),
  coins: z.array(z.string().regex(/^[a-z0-9-]+:[A-Za-z0-9.-]+$/)).min(1).max(4),
  accounts: z.array(z.string().regex(/^[A-Za-z0-9_]{1,15}$/)).max(8),
});
const researchCore = frontmatter("researches/core.md", await Bun.file(new URL("core.md", research)).text());
z.strictObject({ name: z.literal("research-core"), description: z.string().min(1).max(200) }).parse(researchCore.data);
const agents: Record<string, z.output<typeof agentMetadata> & { content: string }> = {};
for (const path of [...new Bun.Glob("agents/*/SKILL.md").scanSync({ cwd: research.pathname })].sort()) {
  const parsed = frontmatter(path, await Bun.file(new URL(path, research)).text());
  const entry = agentMetadata.parse(parsed.data);
  if (entry.name !== `research-${path.split("/")[1]}`) throw new Error(`Research agent name mismatch: ${path}`);
  agents[entry.name.slice("research-".length)] = { ...entry, content: parsed.content };
}
for (const role of ["capital", "activity", "flows", "social", "synthesis"]) if (!agents[role]) throw new Error(`Missing research agent ${role}`);
const chains: Record<string, z.output<typeof chainMetadata> & { notes: string }> = {};
for (const path of [...new Bun.Glob("chains/*.md").scanSync({ cwd: research.pathname })].sort()) {
  const parsed = frontmatter(path, await Bun.file(new URL(path, research)).text());
  const entry = chainMetadata.parse(parsed.data);
  if (`chains/${entry.id}.md` !== path) throw new Error(`Chain id mismatch: ${path}`);
  chains[entry.id] = { ...entry, notes: parsed.content };
}

const outputs = [
  [new URL("../src/agent-skills.generated.json", import.meta.url), `${JSON.stringify({ core, skills }, null, 2)}\n`],
  [new URL("../src/research-agents.generated.json", import.meta.url), `${JSON.stringify({ core: researchCore.content, agents, chains }, null, 2)}\n`],
] as const;
for (const [target, output] of outputs) {
  if (process.argv.includes("--check")) {
    if (await Bun.file(target).text().catch(() => "") !== output) throw new Error("Agent skills are stale. Run bun run skills:build.");
  } else {
    await Bun.write(target, output);
  }
}
