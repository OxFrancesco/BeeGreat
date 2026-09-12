import { strict as assert } from "node:assert";

// Run on Bee's empty conversation, once with the keyboard closed and once open.
const serial = process.argv[2];
assert(serial, "Usage: bun scripts/check-android-chat-layout.ts <adb-serial>");

async function adb(...args: string[]) {
  const child = Bun.spawn(["adb", "-s", serial!, ...args], {
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, code] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  assert.equal(code, 0, stderr || stdout);
  return stdout;
}

await adb("shell", "uiautomator", "dump", "/data/local/tmp/beegreat-layout.xml");
const xml = await adb("shell", "cat", "/data/local/tmp/beegreat-layout.xml");
const windows = await adb("shell", "dumpsys", "window");
const density = Number((await adb("shell", "wm", "density")).match(/\d+/g)?.at(-1)) / 160;
assert(density > 0, "Missing display density");
const nodes = [...xml.matchAll(/<node\s+([^>]+)>/g)].map((match) =>
  Object.fromEntries([...match[1]!.matchAll(/([\w-]+)="([^"]*)"/g)].map((attribute) => [attribute[1]!, attribute[2]!])),
);
function bounds(node: Record<string, string>) {
  const values = node.bounds?.match(/\d+/g)?.map(Number);
  assert(values?.length === 4, "Missing view bounds");
  const [left, top, right, bottom] = values as [number, number, number, number];
  return { left, top, right, bottom, width: right - left, height: bottom - top, centerX: (left + right) / 2 };
}

const appNodes = nodes.filter((node) => node.package === "com.beegreat.app");
assert(appNodes.length, "BeeGreat must be in the foreground");
const screen = bounds(appNodes[0]!);
const input = appNodes.find((node) => node.class === "android.widget.EditText");
assert(input, "Open Bee's chat before running this check");
const composer = bounds(input);
const ime = [...windows.matchAll(/type=ime frame=\[(\d+),(\d+)\]\[(\d+),(\d+)\][^\n]*visible=true/g)]
  .find((match) => Number(match[3]) - Number(match[1]) === screen.width);
const failures: string[] = [];
const check = (condition: boolean, message: string) => { if (!condition) failures.push(message); };
const suggestions = ["What should I focus on today?", "Show my goals", "What tasks are still open?"];
let visibleSuggestions = 0;
for (const suggestion of suggestions) {
  const node = appNodes.find((node) => node.text === suggestion);
  if (!node) {
    check(Boolean(ime), `Missing suggestion with keyboard closed: ${suggestion}`);
    continue;
  }
  const text = bounds(node);
  if (!text.width || !text.height) continue;
  visibleSuggestions++;
  check(text.width > 100, `Suggestion text is clipped to ${text.width}px: ${suggestion}`);
  check(Math.abs(text.centerX - screen.centerX) < 5, `Suggestion is off-center by ${Math.round(text.centerX - screen.centerX)}px: ${suggestion}`);
  check(text.bottom <= composer.top, `Suggestion overlaps the composer: ${suggestion}`);
}
check(visibleSuggestions > 0, "No readable suggestions in the empty conversation");
if (!ime || process.argv.includes("--all-suggestions")) {
  check(visibleSuggestions === suggestions.length, "All three suggestions must be visible");
}
const bee = appNodes.find((node) => node["content-desc"] === "Bee");
if (bee) check(Math.abs(bounds(bee).centerX - screen.centerX) < 5, "Bee is not centered");
if (ime) {
  const gap = Number(ime[2]) - composer.bottom;
  check(gap >= 0 && gap <= 24 * density, `Composer text is ${gap}px from the keyboard; expected at most 24dp`);
}
console.log(JSON.stringify({ keyboard: Boolean(ime), screenWidth: screen.width, visibleSuggestions, failures }, null, 2));
process.exitCode = failures.length ? 1 : 0;
