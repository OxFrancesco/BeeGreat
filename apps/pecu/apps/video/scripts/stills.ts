/** Renders frames at the given seconds into out/stills for a quick visual check: bun scripts/stills.ts 1.5 6 12.9 */
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { FPS } from "../src/timeline";

const root = path.join(import.meta.dir, "..");
const seconds = process.argv.slice(2).map(Number);
if (seconds.length === 0 || seconds.some(Number.isNaN)) throw new Error("Pass one or more times in seconds.");

const serveUrl = await bundle({ entryPoint: path.join(root, "src/index.ts"), publicDir: path.join(root, "public") });
const composition = await selectComposition({ serveUrl, id: "PecuExplainer" });
await mkdir(path.join(root, "out/stills"), { recursive: true });

for (const time of seconds) {
  const output = path.join(root, `out/stills/${time.toFixed(2)}s.png`);
  await renderStill({
    serveUrl,
    composition,
    frame: Math.min(composition.durationInFrames - 1, Math.round(time * FPS)),
    output,
    chromiumOptions: { gl: "angle" },
  });
  console.log(output);
}
