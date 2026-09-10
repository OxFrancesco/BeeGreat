import { describe, expect, test } from "bun:test";

import fixtures from "../fixtures/beeui.json";
import { deriveBeeUiFollowUps, extractBeeUi, getToolCopy, scrubIdentifiers } from "./index";

// The fixtures are shared with the Android port. If this test fails, either
// regenerate them (bun packages/tool-presentation/fixtures/generate.ts) and
// update the Kotlin side, or the change was unintended.
describe("shared beeui fixtures", () => {
  test("extractBeeUi and deriveBeeUiFollowUps", () => {
    for (const entry of fixtures.extract) {
      const result = extractBeeUi(entry.input);
      expect(result.spoken).toBe(entry.spoken);
      expect(result.components).toEqual(entry.components);
      expect(deriveBeeUiFollowUps(result.components)).toEqual(entry.followUps);
    }
  });

  test("scrubIdentifiers", () => {
    for (const entry of fixtures.scrub) {
      expect(scrubIdentifiers(entry.input)).toBe(entry.output);
      expect(scrubIdentifiers(entry.input, true)).toBe(entry.preserved);
    }
  });

  test("getToolCopy", () => {
    for (const entry of fixtures.toolCopy) {
      expect(getToolCopy(entry.name, entry.state as "running" | "done" | "error", entry.input)).toEqual(entry.output);
    }
  });
});
