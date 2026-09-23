import { resolve } from "node:path";
import theme from "../theme/amber-minimal.json";

const root = resolve(import.meta.dir, "..");
const protectedTokens = new Set(
  Object.keys({ ...theme.cssVars.theme, ...theme.cssVars.light }),
);
const styles = [
  "theme/clay.css",
  "apps/site/site/pecu-assets/style.css",
  "apps/site/site/pecu-assets/design.css",
  "apps/site/site/pecu-assets/docs.css",
  "apps/stocks/src/pecu.css",
  "apps/stocks/showcase/style.css",
  "apps/stocks/polymarket-showcase/style.css",
];

export function designViolations(css: string): string[] {
  const source = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const problems: string[] = [];
  for (const match of source.matchAll(/([\w-]+)\s*:\s*([^;{}]+)[;}]/g)) {
    const property = match[1]!;
    const value = match[2]!;
    if (property.startsWith("--") && protectedTokens.has(property.slice(2))) {
      problems.push(
        `${property} overrides amber-minimal. Edit the pinned theme instead.`,
      );
    }
    if (property === "mask-image" || property === "-webkit-mask-image")
      continue;
    if (/#(?:[\da-f]{3,8})\b|\b(?:oklch|oklab|rgba?|hsla?)\(/i.test(value)) {
      problems.push(
        `${property}: ${value} uses a literal color. Use a shared theme token.`,
      );
    }
    if (
      /^(color|background(?:-color)?|(?:border|outline)(?:-(?:top|right|bottom|left))?-color|fill|stroke)$/.test(
        property,
      ) &&
      /^[a-z]+$/i.test(value.trim()) &&
      ![
        "none",
        "transparent",
        "currentcolor",
        "inherit",
        "initial",
        "unset",
        "revert",
      ].includes(value.trim().toLowerCase())
    ) {
      problems.push(
        `${property}: ${value} uses a named color. Use a shared theme token.`,
      );
    }
    if (
      ["font", "font-family"].includes(property) &&
      value.trim() !== "inherit" &&
      !value.includes("var(--font-")
    ) {
      problems.push("Use the shared amber-minimal font tokens.");
    }
    if (
      property === "box-shadow" &&
      value.trim() !== "none" &&
      !value.includes("var(--")
    ) {
      problems.push("Use a shared clay or theme shadow token.");
    }
  }
  return problems;
}

export function aeroPaletteDrift(
  css: string,
  logo: string,
  tui: string,
): string[] {
  const tokens = new Map(
    [...css.matchAll(/--(aero-[\w-]+):\s*([^;]+);/g)].map(([, name, value]) => [
      name!,
      value!.trim().toLowerCase(),
    ]),
  );
  const ribbons = [
    ...(logo.match(/const COLORS = \[([^\]]+)\]/)?.[1] ?? "").matchAll(
      /#[\da-f]{6}/gi,
    ),
  ].map(([color]) => color.toLowerCase());
  const theme = Object.fromEntries(
    [...tui.matchAll(/(\w+): '(#[\da-f]{6})'/gi)].map(([, name, color]) => [
      name!,
      color!.toLowerCase(),
    ]),
  );
  const expected: Record<string, string | undefined> = {
    "aero-blue": ribbons[1],
    "aero-background": theme.background,
    "aero-foreground": theme.text,
    "aero-primary": theme.primary,
    ...Object.fromEntries(
      Array.from({ length: 6 }, (_, i) => [`aero-ribbon-${i + 1}`, ribbons[i]]),
    ),
  };
  return Object.entries(expected)
    .filter(([name, color]) => !color || tokens.get(name) !== color)
    .map(
      ([name, color]) =>
        `--${name} should be ${color ?? "defined in the Aero TUI"} to match the Aero TUI.`,
    );
}

if (import.meta.main) {
  const sync = Bun.spawn(
    ["bun", resolve(import.meta.dir, "sync-design-theme.ts"), "--check"],
    { stdout: "inherit", stderr: "inherit" },
  );
  if (await sync.exited) process.exit(1);
  const errors: string[] = [];
  for (const file of styles) {
    errors.push(
      ...designViolations(await Bun.file(resolve(root, file)).text()).map(
        (message) => `${file}: ${message}`,
      ),
    );
  }
  for (const [file, required] of [
    [
      "apps/site/site/pecu-assets/style.css",
      ['@import "./theme.css"', '@import "./clay.css"', '@import "./aero.css"'],
    ],
    [
      "apps/stocks/src/styles.css",
      [
        '@import "../../../theme/theme.css"',
        '@import "../../../theme/clay.css"',
      ],
    ],
    ["apps/site/site/index.html", ['class="pecu-theme"']],
    ["apps/stocks/showcase/index.html", ['class="pecu-theme"']],
    ["apps/stocks/polymarket-showcase/index.html", ['class="pecu-theme"']],
  ] as const) {
    const content = await Bun.file(resolve(root, file)).text();
    for (const value of required)
      if (!content.includes(value))
        errors.push(`${file}: missing shared theme reference ${value}`);
  }
  const sugar = import.meta.resolve("@beegreat/sugar");
  errors.push(
    ...aeroPaletteDrift(
      await Bun.file(resolve(root, "theme/aero.css")).text(),
      await Bun.file(new URL("./tui/logo.tsx", sugar)).text(),
      await Bun.file(new URL("./tui/theme.ts", sugar)).text(),
    ).map((message) => `theme/aero.css: ${message}`),
  );
  if (errors.length) throw new Error(errors.join("\n"));
  console.log(
    "Pecu site, Agent and reference use the shared amber and clay theme.",
  );
}
