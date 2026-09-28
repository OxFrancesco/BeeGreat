import { z } from "zod";

const root = new URL("../skills/pecu/", import.meta.url);
const metadata = z.strictObject({
  name: z.string().regex(/^pecu-[a-z-]+$/),
  description: z.string().min(1).max(200),
  tools: z.array(z.string().regex(/^[a-z]+_(?:[a-z_]+|\*)$/)).min(1).optional(),
  triggers: z.string().refine(source => { try { new RegExp(source, "i"); return true; } catch { return false; } }, "Invalid trigger pattern").optional(),
});
let core: string | undefined;
const skills: Record<string, { description: string; tools: string[]; triggers: string; content: string }> = {};
for (const path of [...new Bun.Glob("*/SKILL.md").scanSync({ cwd: root.pathname })].sort()) {
  const source = await Bun.file(new URL(path, root)).text();
  const match = /^---\n([\s\S]*?)\n---\n([\s\S]+)$/.exec(source);
  if (!match) throw new Error(`Invalid skill: ${path}`);
  const { name, description, tools, triggers } = metadata.parse(Bun.YAML.parse(match[1]));
  if (name !== `pecu-${path.split("/")[0]}`) throw new Error(`Skill name mismatch: ${path}`);
  const content = match[2].trim();
  if (name === "pecu-core") { core = content; continue; }
  if (!tools || !triggers) throw new Error(`Task skill needs tools and triggers: ${path}`);
  skills[name.slice(5)] = { description, tools, triggers, content };
}
if (!core) throw new Error("Missing core skill");
const target = new URL("../src/agent-skills.generated.json", import.meta.url);
const output = `${JSON.stringify({ core, skills }, null, 2)}\n`;
if (process.argv.includes("--check")) {
  if (await Bun.file(target).text() !== output) throw new Error("Agent skills are stale. Run bun run skills:build.");
} else {
  await Bun.write(target, output);
}
