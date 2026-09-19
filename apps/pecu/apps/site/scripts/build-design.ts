import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { transactionSpecimens } from "./transaction-specimens";

const site = resolve(import.meta.dir, "..");
const pecu = resolve(site, "../..");
const read = (path: string) => Bun.file(path).text();
const escape = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
const agentCss = await read(resolve(pecu, "apps/stocks/src/pecu.css"));
const tokens = (css: string, selector: string) => {
  const start = css.indexOf(selector);
  if (start < 0) throw new Error(`Missing theme selector: ${selector}`);
  const block = css.slice(start).split("}")[0]!;
  return [...block.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map(
    ([, name, value]) => ({ name: name!, value: value! }),
  );
};
const themeCss = await read(resolve(pecu, "theme/theme.css"));
const clayCss = await read(resolve(pecu, "theme/clay.css"));
const homeTokens = tokens(themeCss, ".pecu-theme");
const materialTokens = tokens(clayCss, ".pecu-theme");
const palette = (items: typeof homeTokens) =>
  `<div class="swatches">${items
    .filter((t) =>
      [
        "--background",
        "--foreground",
        "--primary",
        "--primary-foreground",
        "--muted",
        "--muted-foreground",
        "--accent",
        "--border",
      ].includes(t.name),
    )
    .map(
      (t) =>
        `<button class="swatch" data-copy="${escape(t.value)}" aria-label="Copy ${t.name}"><span style="background:${escape(t.value)}"></span><strong>${escape(t.name)}</strong><small>${escape(t.value)}</small></button>`,
    )
    .join("")}</div>`;
const tokenTable = (items: typeof homeTokens) =>
  `<details><summary>All CSS tokens</summary><div class="table-wrap"><table><thead><tr><th>Token</th><th>Value</th></tr></thead><tbody>${items.map((t) => `<tr><td><code>${t.name}</code></td><td><code>${escape(t.value)}</code></td></tr>`).join("")}</tbody></table></div></details>`;
const componentDir = resolve(pecu, "apps/stocks/src/components");
const files = Array.from(
  new Bun.Glob("**/*.tsx").scanSync(componentDir),
).sort();
const catalog = files
  .map(
    (file) =>
      `<tr data-search="${escape(file.replaceAll("-", " "))}"><td>${escape(
        file
          .replace(/\.tsx$/, "")
          .split("/")
          .at(-1)!
          .replaceAll("-", " "),
      )}</td><td><code>apps/stocks/src/components/${escape(file)}</code></td></tr>`,
  )
  .join("");
const guide = await read(resolve(pecu, "docs/design-system.md"));
const guideHtml = Bun.markdown
  .html(guide)
  .replace(/<h1>.*?<\/h1>/, "")
  .replace(/<h2>(.*?)<\/h2>/g, (_, title) => `<h3>${title}</h3>`);
const html = `<!doctype html><html lang="en" class="pecu-theme"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><meta name="darkreader-lock"><title>Design | Pecu</title><meta name="description" content="Pecu and Pecu Agent components, theme tokens, assets and design guidelines."><link rel="canonical" href="https://pecu.app/design"><link rel="icon" href="/pecu-assets/favicon.ico"><link rel="stylesheet" href="/pecu-assets/style.css"><link rel="stylesheet" href="/pecu-assets/design-agent.css"><link rel="stylesheet" href="/pecu-assets/design.css"><script defer src="/pecu-assets/design.js"></script></head><body class="design-page"><a class="skip-link" href="#content">Skip to content</a><header class="design-header"><a class="wordmark" href="/">pecu</a><nav aria-label="Product"><a href="/">Pecu</a><a href="/agent">Agent</a><a href="/design" aria-current="page">Design</a></nav></header><div class="design-layout"><aside><nav aria-label="Design sections">${["Overview", "Pecu", "Pecu Agent", "Typography", "Assets", "Components", "Guidelines"].map((s) => `<a href="#${s.toLowerCase().replaceAll(" ", "-")}">${s === "Pecu" ? "Shared theme" : s === "Pecu Agent" ? "Agent patterns" : s}</a>`).join("")}<a href="/pecu-assets/design-system.md" download>Download guide ↓</a></nav></aside><main id="content"><section id="overview"><h1>Design</h1><p class="intro">Amber-minimal colors and type. Pecu’s clay surfaces and original 3D snail.</p><div class="identity-specimen"><img src="/pecu-assets/mascot/idle.webp" alt="Pecu claymation snail"><div><h2>Pecu and Pecu Agent</h2><p>One shared theme, with soft edges, inset highlights and tactile controls.</p><div class="actions"><a class="button primary" href="#pecu-agent">Try the components</a><a class="button" href="#pecu">Explore the theme</a></div></div></div></section>
<section id="pecu"><h2>Shared theme</h2><p>The original amber-minimal tokens, consumed by both products. Select a swatch to copy its value.</p>${palette(homeTokens)}${tokenTable(homeTokens)}<h3>Actions and surfaces</h3><div class="specimen"><div class="actions"><button class="button primary" data-demo>Primary action</button><button class="button" data-demo>Secondary action</button><button class="button" disabled>Disabled</button><a class="text-link" href="#guidelines">Read the guide →</a></div><div class="surface-row"><div class="surface-example">Card<br><code>--card</code></div><div class="surface-example tint">Amber tint<br><code>--accent</code></div><div class="surface-example dark-example">Terminal<br><span class="mono">aero --help</span></div></div></div></section>
<section id="pecu-agent"><h2>Agent patterns</h2><p>The same theme and clay material applied to conversation, inputs and transaction previews. These samples only change local state.</p><div class="pecu agent-specimen">${tokenTable(materialTokens)}<h3>Buttons</h3><div class="actions"><button class="pecu-button pecu-button-primary" data-demo>Primary action</button><button class="pecu-button" data-demo>Secondary action</button><button class="pecu-button pecu-button-quiet" data-demo>Cancel</button><button class="pecu-button" disabled>Disabled</button></div><h3>Conversation and composer</h3><div class="sample-chat"><div class="pecu-bubble-user">What can I do with Pecu?</div><div class="pecu-assistant has-mascot"><img class="pecu-avatar" src="/pecu-assets/mascot/idle.webp" alt="Pecu snail"><div class="pecu-bubble-bot">Check balances, research tokens and review a transaction before confirming it.</div></div><form id="sample-composer" class="pecu-prompt clay"><label class="sr-only" for="sample-message">Sample message</label><textarea id="sample-message" placeholder="Ask Pecu…" rows="2" required></textarea><button class="pecu-button pecu-button-primary" type="submit">Send sample</button></form><p id="sample-reply" role="status"></p></div><h3>Transaction preview</h3><label for="preview-state">Preview state</label><select id="preview-state">${["pending", "executing", "succeeded", "failed", "cancelled", "expired"].map((s) => `<option value="${s}">${s}</option>`).join("")}</select>${transactionSpecimens}<p class="note">Fictional example. No wallet, quote or transaction is connected.</p><h3>Threads and recovery</h3><ul class="pecu-thread-list"><li class="pecu-thread is-active"><button class="pecu-thread-open" aria-pressed="true">Portfolio questions</button></li><li class="pecu-thread"><button class="pecu-thread-open" aria-pressed="false">Research a token</button></li></ul><div class="pecu-error"><span>Sample connection error. Try again.</span><button class="pecu-button pecu-button-quiet" data-demo>Retry</button></div></div></section>
<section id="typography"><h2>Typography and layout</h2><div class="type-row"><span>Heading</span><div style="font-size:36px;font-weight:750;letter-spacing:-.035em">Review your next move</div></div><div class="type-row"><span>Body · 16px / 1.7</span><p>Keep amounts readable and the next action clear.</p></div><div class="type-row"><span>Numbers · monospace</span><div class="mono">1,240.50 USDC</div></div><div class="table-wrap"><table><thead><tr><th>Rule</th><th>Pecu</th><th>Pecu Agent</th></tr></thead><tbody><tr><td>Font</td><td>Inter with system fallbacks</td><td>Inter with system fallbacks</td></tr><tr><td>Content width</td><td>1120px homepage</td><td>940px conversation</td></tr><tr><td>Corners</td><td>14px clay controls, 22px surfaces</td><td>14px buttons, 22–30px previews, 22px composer</td></tr><tr><td>Navigation</td><td>Inline links</td><td>272px desktop rail; mobile thread picker</td></tr><tr><td>Spacing</td><td>24px cards, 48px primary controls</td><td>18px message gap, 44px confirmation controls</td></tr></tbody></table></div></section>
<section id="assets"><h2>Assets</h2><p>Use the original transparent renders. Keep the snail off amber and butter backgrounds.</p><div class="asset-grid"><figure><img src="/pecu-assets/mascot/idle.webp" alt="Pecu's coral shell, butter body and gold coin"><figcaption><a href="/pecu-assets/mascot/idle.webp" download>Idle poster ↓</a></figcaption></figure><figure><img src="/pecu-assets/mascot/pecu-reveal.webp" alt="Pecu reveal poster"><figcaption><a href="/pecu-assets/mascot/pecu-reveal.webp" download>Reveal poster ↓</a></figcaption></figure><figure><img class="brand-icon" src="/pecu-assets/icon-192.png" alt="Pecu app icon"><figcaption><a href="/pecu-assets/icon-512.png" download>App icon ↓</a></figcaption></figure></div><p><a href="/pecu-assets/mascot/idle.webm" download>Idle WebM</a> · <a href="/pecu-assets/mascot/idle.hevc.mp4" download>Idle HEVC</a> · <a href="/pecu-assets/mascot/pecu-reveal.webm" download>Reveal WebM</a> · <a href="/pecu-assets/mascot/pecu-reveal.hevc.mp4" download>Reveal HEVC</a></p></section>
<section id="components"><h2>Component catalog</h2><p>All React component files in Pecu Agent, rebuilt from the source tree. Paths are relative to Pecu.</p><label for="component-search">Find a component</label><input id="component-search" type="search" placeholder="Button, message, chart…"><p id="empty-search" hidden>No components match. Try another name.</p><div class="table-wrap"><table><thead><tr><th>Component</th><th>Source</th></tr></thead><tbody id="component-rows">${catalog}</tbody></table></div></section><section id="guidelines"><h2>Guidelines</h2><article class="guide">${guideHtml}</article></section><footer><p>This is an independent project and is not affiliated with, endorsed by, sponsored by, or maintained by Aerodrome Finance, Velodrome Finance, Dromos Labs, or Mellow Protocol. References to their names and protocols describe compatibility or source attribution only. All trademarks belong to their respective owners. Third-party code remains subject to its applicable licenses.</p><a href="#overview">Back to top ↑</a></footer></main></div><div id="design-feedback" role="status" aria-live="polite"></div></body></html>`;
await mkdir(resolve(site, "public/design"), { recursive: true });
await Promise.all([
  Bun.write(resolve(site, "public/design/index.html"), html),
  Bun.write(resolve(site, "public/pecu-assets/design-agent.css"), agentCss),
  Bun.write(resolve(site, "public/pecu-assets/theme.css"), themeCss),
  Bun.write(resolve(site, "public/pecu-assets/clay.css"), clayCss),
  Bun.write(resolve(site, "public/pecu-assets/design-system.md"), guide),
]);
console.log(
  `Built Pecu design reference with ${files.length} component sources`,
);
