// Renders explainer.html frame by frame into an MP4 with ffmpeg.
//   bun run render                      -> dist/pecu-explainer.mp4
//   bun run render --stills 3,12,45     -> dist/still-<t>.png only
import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { join, normalize, resolve } from "node:path";
import { chromium } from "playwright-core";

declare global {
  interface Window {
    __ready: Promise<unknown>;
    __duration: number;
    __seek(t: number): Promise<void>;
  }
}

const args = process.argv.slice(2);
const flag = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? undefined : args[i + 1];
};
const fps = Number(flag("fps") ?? 30);
const stills = flag("stills")?.split(",").map(Number);
const here = import.meta.dir;
const root = resolve(here, "..");
const dist = join(here, "dist");
const out = resolve(flag("out") ?? join(dist, "pecu-explainer.mp4"));
const chrome = process.env.CHROME_PATH ?? Bun.which("google-chrome") ?? Bun.which("chromium") ?? "google-chrome";

await mkdir(dist, { recursive: true });

const server = Bun.serve({
  port: 0,
  async fetch(req) {
    const path = normalize(decodeURIComponent(new URL(req.url).pathname));
    const file = Bun.file(join(root, path));
    return (await file.exists()) ? new Response(file) : new Response("Not found", { status: 404 });
  },
});

const browser = await chromium.launch({
  executablePath: chrome,
  args: ["--autoplay-policy=no-user-gesture-required", "--hide-scrollbars", "--force-color-profile=srgb"],
});
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
await page.goto(`${server.url}motion/explainer.html?render`);
await page.evaluate(() => window.__ready);
const duration = await page.evaluate(() => window.__duration);
const seek = (t: number) => page.evaluate((time) => window.__seek(time), t);
const stage = page.locator("#stage");

if (stills) {
  for (const t of stills) {
    await seek(t);
    await stage.screenshot({ path: join(dist, `still-${t}.png`) });
  }
} else {
  const ffmpeg = spawn("ffmpeg", [
    "-y", "-v", "error", "-f", "image2pipe", "-framerate", String(fps), "-c:v", "png", "-i", "-",
    "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-pix_fmt", "yuv420p", "-movflags", "+faststart", out,
  ], { stdio: ["pipe", "inherit", "inherit"] });
  const done = new Promise<void>((ok, fail) => ffmpeg.on("close", (code) => (code === 0 ? ok() : fail(new Error(`ffmpeg exited ${code}`)))));
  const frames = Math.round(duration * fps);
  for (let i = 0; i < frames; i++) {
    await seek(i / fps);
    const png = await stage.screenshot({ type: "png" });
    if (!ffmpeg.stdin.write(png)) await new Promise((r) => ffmpeg.stdin.once("drain", r));
    if (i % fps === 0) process.stdout.write(`\r${(i / fps).toFixed(0)}s / ${duration}s`);
  }
  ffmpeg.stdin.end();
  await done;
  console.log(`\n${out}`);
}

await browser.close();
server.stop();
