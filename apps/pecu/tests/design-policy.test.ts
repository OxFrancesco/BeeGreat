import { describe, expect, test } from "bun:test";
import { designViolations } from "../scripts/check-design";

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
});
