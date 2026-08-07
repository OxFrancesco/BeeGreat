import { describe, expect, test } from "bun:test";
import { mkdtemp, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
  MAX_PROMPT_HISTORY,
  createPromptHistory,
  parsePromptHistory,
} from "./prompt-history";

describe("Bee prompt history", () => {
  test("ignores corrupt lines and keeps the latest 50 prompts", () => {
    const lines = Array.from(
      { length: MAX_PROMPT_HISTORY + 2 },
      (_, index) => JSON.stringify(`prompt ${index}`),
    );
    expect(parsePromptHistory(["not-json", ...lines].join("\n"))).toEqual(
      Array.from({ length: MAX_PROMPT_HISTORY }, (_, index) =>
        `prompt ${index + 2}`,
      ),
    );
  });

  test("persists prompts and removes consecutive duplicates", async () => {
    const directory = await mkdtemp(join(tmpdir(), "bee-history-"));
    const path = join(directory, "history.jsonl");
    const history = await createPromptHistory(path);
    await history.append("Plan my day");
    await history.append("Plan my day");

    expect(history.entries).toEqual(["Plan my day"]);
    expect(await readFile(path, "utf8")).toBe('"Plan my day"\n');
  });
});
