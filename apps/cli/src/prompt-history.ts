import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import { isJsonString, type JsonValue } from "./json";

export const MAX_PROMPT_HISTORY = 50;

export type PromptHistory = {
  entries: string[];
  append(prompt: string): Promise<void>;
};

export function parsePromptHistory(text: string) {
  return text
    .split("\n")
    .filter(Boolean)
    .flatMap((line) => {
      try {
        const value: JsonValue = JSON.parse(line);
        return isJsonString(value) && value.trim() ? [value] : [];
      } catch {
        return [];
      }
    })
    .slice(-MAX_PROMPT_HISTORY);
}

export async function createPromptHistory(path: string): Promise<PromptHistory> {
  const entries = parsePromptHistory(
    await readFile(path, "utf8").catch(() => ""),
  );

  async function persist() {
    await mkdir(dirname(path), { recursive: true, mode: 0o700 });
    await writeFile(
      path,
      entries.map((entry) => JSON.stringify(entry)).join("\n") +
        (entries.length ? "\n" : ""),
      { mode: 0o600 },
    );
  }

  return {
    entries,
    async append(prompt) {
      const value = prompt.trim();
      if (!value || entries.at(-1) === value) return;
      entries.push(value);
      if (entries.length > MAX_PROMPT_HISTORY) {
        entries.splice(0, entries.length - MAX_PROMPT_HISTORY);
      }
      await persist();
    },
  };
}
