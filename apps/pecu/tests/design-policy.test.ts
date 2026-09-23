import { describe, expect, test } from "bun:test";
import { aeroPaletteDrift, designViolations } from "../scripts/check-design";

describe("Pecu theme policy", () => {
  test("rejects a local palette and an upstream token override", () => {
    expect(
      designViolations(".pecu { --primary: red; color: #f06a4c; }"),
    ).toHaveLength(2);
  });
  test("rejects raw function colors and hand-written shadows", () => {
    expect(
      designViolations(
        ".button { background: oklch(.7 .2 30); box-shadow: 2px 3px black; }",
      ),
    ).toHaveLength(2);
  });
  test("rejects named UI colors and a different font family", () => {
    expect(
      designViolations(".button { background: coral; font-family: Arial; }"),
    ).toHaveLength(2);
  });
  test("allows clay material references, including layered focus shadows", () => {
    expect(
      designViolations(
        ".button { background: var(--primary); box-shadow: var(--clay-shadow), var(--clay-focus); }",
      ),
    ).toEqual([]);
  });
  test("does not treat artwork masks or comments as UI colors", () => {
    expect(
      designViolations(
        "/* color: #fff; */ .snail { mask-image: linear-gradient(#000, transparent); }",
      ),
    ).toEqual([]);
  });
  test("keeps the Aero tile palette on the Aero TUI values", () => {
    const logo =
      "const COLORS = ['#5b6b9c', '#2f5ee6', '#7fb2ff', '#eef0f5', '#ef4a2f', '#b8352a']";
    const tui =
      "primary: '#4f8ef7',\n  text: '#e6e9f0',\n  background: '#0a0c10',";
    const css = `.pecu-theme { --aero-blue: #2f5ee6; --aero-background: #0a0c10; --aero-foreground: #e6e9f0; --aero-primary: #4f8ef7; ${[
      "#5b6b9c",
      "#2f5ee6",
      "#7fb2ff",
      "#eef0f5",
      "#ef4a2f",
      "#b8352a",
    ]
      .map((color, i) => `--aero-ribbon-${i + 1}: ${color};`)
      .join(" ")} }`;
    expect(aeroPaletteDrift(css, logo, tui)).toEqual([]);
    expect(
      aeroPaletteDrift(css.replace("#ef4a2f", "#ff0000"), logo, tui),
    ).toEqual(["--aero-ribbon-5 should be #ef4a2f to match the Aero TUI."]);
  });
});
