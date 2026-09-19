import { resolve } from "node:path";

const root = resolve(import.meta.dir, "..");
const theme = await Bun.file(resolve(root, "theme/amber-minimal.json")).json();
const declarations = (values: Record<string, string>) =>
  Object.entries(values)
    .map(([key, value]) => `  --${key}: ${value};`)
    .join("\n");
const light = { ...theme.cssVars.theme, ...theme.cssVars.light };
const dark = theme.cssVars.dark;
const css = `/* Generated from amber-minimal.json by scripts/sync-design-theme.ts. */
.pecu-theme, .pecu, html:has(.pecu-app) {
${declarations(light)}
  --radius-sm: calc(var(--radius) - 2px);
  --radius-lg: calc(var(--radius) + 4px);
  --radius-xl: calc(var(--radius) + 8px);
${Object.entries(dark)
  .filter(([key]) =>
    ["background", "card", "foreground", "muted-foreground", "border"].includes(
      key,
    ),
  )
  .map(
    ([key, value]) =>
      `  --${key === "background" ? "dark" : `dark-${key}`}: ${value};`,
  )
  .join("\n")}
  --ease-out: cubic-bezier(.23, 1, .32, 1);
  --ease-in-out: cubic-bezier(.77, 0, .175, 1);
  --fast: 160ms;
  --tile: 480ms;
  --stagger: 60ms;
  font-family: var(--font-sans);
  letter-spacing: var(--tracking-normal);
  color: var(--foreground);
  background: var(--background);
  -webkit-font-smoothing: antialiased;
}
.pecu-theme :is(button, input, textarea, select), .pecu :is(button, input, textarea, select) {
  font-family: var(--font-sans);
}
.pecu-theme.dark, .pecu.dark {
${declarations(dark)}
}
`;
const target = resolve(root, "theme/theme.css");
if (process.argv.includes("--check")) {
  if ((await Bun.file(target).text()) !== css)
    throw new Error("Theme drift. Run bun run design:sync in apps/pecu.");
  console.log("Amber-minimal tokens match the pinned registry theme.");
} else {
  await Bun.write(target, css);
}
