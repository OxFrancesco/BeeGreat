import { cp, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { buildDocsSite } from "./build-docs-site";

const root = resolve(import.meta.dir, "../../..");
await rm(resolve(import.meta.dir, "../public"), { recursive: true, force: true });
await cp(resolve(import.meta.dir, "../site"), resolve(import.meta.dir, "../public"), { recursive: true });
await cp(resolve(root, "theme/fonts"), resolve(import.meta.dir, "../public/pecu-assets/fonts"), { recursive: true });
await cp(resolve(root, "theme/fonts.css"), resolve(import.meta.dir, "../public/pecu-assets/fonts.css"));
const analytics = await Bun.build({
  entrypoints: [resolve(import.meta.dir, "analytics.ts")],
  outdir: resolve(import.meta.dir, "../public/pecu-assets"),
  target: "browser",
  minify: true,
});
if (!analytics.success) throw new AggregateError(analytics.logs, "Analytics bundle failed");
await buildDocsSite();
await import("./build-design");
const showcase = Bun.spawn(["bun", "run", "--cwd", resolve(root, "apps/stocks"), "build:showcase"], { stdout: "inherit", stderr: "inherit" });
if (await showcase.exited) throw new Error("Nansen showcase build failed");
const polymarketShowcase = Bun.spawn(["bun", "run", "--cwd", resolve(root, "apps/stocks"), "build:polymarket-showcase"], { stdout: "inherit", stderr: "inherit" });
if (await polymarketShowcase.exited) throw new Error("Polymarket showcase build failed");
