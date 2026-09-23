import { codexModel, codexSmallModel } from "./codex-protocol";

// The pinned OpenCode snapshot predates GPT-6 Sol and Luna.
export function modelCatalog(provider: "openai" | "openrouter") {
  return Object.fromEntries([
    { id: codexModel, name: "GPT-6 Sol", effort: "medium", input: 2, output: 10, read: 0.2 },
    { id: codexSmallModel, name: "GPT-6 Luna", effort: "low", input: 0.1, output: 0.5, read: 0.01 },
  ].map(({ id, name, effort, input, output, read }) => {
    const modelID = provider === "openrouter" ? `openai/${id}` : id;
    const settings: Record<string, string | string[] | { effort: string }> = provider === "openrouter"
      ? { reasoning: { effort } }
      : { reasoningEffort: effort, reasoningSummary: "auto", include: ["reasoning.encrypted_content"] };
    return [modelID, {
      name,
      modelID,
      capabilities: { tools: true, input: ["text", "image"], output: ["text"] },
      limit: { context: 1_050_000, output: 128_000 },
      variants: [{ id: effort, settings }],
      cost: { input, output, cache: { read } },
    }];
  }));
}
