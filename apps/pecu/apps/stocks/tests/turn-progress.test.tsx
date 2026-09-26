import { afterEach, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { TurnProgress } from "../src/components/turn-progress";
import type { TurnStage } from "../../../src/progress";

const previousMode = process.env.MODE;
afterEach(() => {
  if (previousMode === undefined) delete process.env.MODE;
  else process.env.MODE = previousMode;
});
const stages: TurnStage[] = [{ id: "model", label: "Generating answer", status: "complete", startedAt: 1000, endedAt: 2500 }];
for (const mode of ["production", "unknown"]) {
  test(`${mode} hides debug details during and after a turn`, () => {
    process.env.MODE = mode;
    for (const pending of [true, false]) {
      expect(renderToStaticMarkup(<TurnProgress stages={stages} pending={pending} />)).toBe("");
      expect(renderToStaticMarkup(<TurnProgress stages={[]} pending={pending} />)).toBe("");
    }
  });
}
for (const mode of ["development", "preview", "test"]) {
  test(`${mode} retains stage timings`, () => {
    process.env.MODE = mode;
    const html = renderToStaticMarkup(<TurnProgress stages={stages} pending={false} />);
    expect(html).toContain("Timing");
    expect(html).toContain("Generating answer");
    expect(html).toContain("1.5s");
  });
}
