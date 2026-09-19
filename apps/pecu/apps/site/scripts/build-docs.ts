import { cp, mkdir } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dir, "../../..");
await cp(resolve(import.meta.dir, "../site"), resolve(import.meta.dir, "../public"), { recursive: true });
const analytics = await Bun.build({
  entrypoints: [resolve(import.meta.dir, "analytics.ts")],
  outdir: resolve(import.meta.dir, "../public/pecu-assets"),
  target: "browser",
  minify: true,
});
if (!analytics.success) throw new AggregateError(analytics.logs, "Analytics bundle failed");
const packageJson = await Bun.file(resolve(root, "package.json")).json();
const revision = packageJson.dependencies["@beegreat/sugar"].split("#")[1];
const source = await Bun.file(new URL("../README.md", import.meta.resolve("@beegreat/sugar"))).text();
const headings: { id: string; text: string }[] = [];
const escape = (text: string) => text.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
let content = Bun.markdown.html(source);
content = content.replace(/<h([23])>(.*?)<\/h\1>/g, (_, level, title) => {
  const text = title.replace(/<[^>]+>/g, "");
  const id = text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  if (level === "2") headings.push({ id, text });
  return `<h${level} id="${id}">${title}</h${level}>`;
}).replace(/href="\.\/([^"]+)"/g, (_, path) => `href="https://github.com/OxFrancesco/aerodrome-sdk-ts/blob/${revision}/${path}"`);
const output = resolve(import.meta.dir, "../public/aero/cli/docs");
await mkdir(output, { recursive: true });
await Bun.write(resolve(output, "index.html"), `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><meta name="darkreader-lock"><title>Aero CLI documentation</title><link rel="icon" href="/aero/cli/favicon.svg"><link rel="canonical" href="https://pecu.app/aero/cli/docs"><style>
*{box-sizing:border-box;scrollbar-width:none}*::-webkit-scrollbar{display:none}html{scroll-behavior:smooth;scroll-padding-top:30px}body{margin:0;color:#243047;background:#f6f8fc;font:16px/1.7 'DM Sans',sans-serif}a{color:#315bbb;text-underline-offset:4px}header{max-width:1280px;margin:auto;padding:24px;display:flex;gap:28px;align-items:center;border-bottom:1px solid #dbe1ec}.logo{font-size:30px;font-weight:750;letter-spacing:-1.5px;text-decoration:none}header a:not(.logo){font-size:15px}main{max-width:1280px;margin:auto;padding:42px 24px;display:grid;grid-template-columns:220px minmax(0,1fr);gap:48px}aside{position:sticky;top:24px;align-self:start;font-size:14px}aside a{display:block;padding:5px 0;text-decoration:none;color:#4c5a70}article{min-width:0}h1{font-size:30px;line-height:1.25;margin:0 0 28px}h2{font-size:25px;margin:44px 0 16px;line-height:1.3}h3{font-size:20px;margin:32px 0 12px}pre{overflow:auto;padding:20px;background:#17243a;color:#eef4ff;border-radius:9px;font-size:13px;line-height:1.65}code{font-family:'IBM Plex Mono',monospace;font-size:.9em}p code,li code{background:#e6ebf4;border-radius:3px;padding:2px 4px}blockquote{margin:20px 0;border-left:3px solid #e1964d;padding:1px 20px;background:#fff}table{display:block;overflow-x:auto;border-collapse:collapse;font-size:14px}td,th{padding:12px;min-width:160px;border:1px solid #dbe1ec;text-align:left;vertical-align:top}th{background:#eaf0f9}article>p{max-width:80ch}li{margin:5px 0}@media(max-width:760px){main{display:block;padding:24px 18px}aside{position:static;display:flex;gap:14px;overflow:auto;border-bottom:1px solid #dbe1ec;margin-bottom:30px;padding-bottom:16px}aside a{white-space:nowrap}header{gap:20px;padding:16px 18px}h1{font-size:26px}}@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}}
</style></head><body><header><a class="logo" href="/aero/cli">aero</a><a href="/aero/stocks">Stocks</a><a href="/aero/cli">CLI</a><a aria-current="page" href="/aero/cli/docs">Docs</a></header><main><aside aria-label="On this page">${headings.map(h => `<a href="#${h.id}">${escape(h.text)}</a>`).join("")}</aside><article>${content}</article></main></body></html>`);
console.log(`Built CLI docs from Aero SDK ${revision.slice(0, 8)}`);
