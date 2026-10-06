import { readdir } from "node:fs/promises";
import { resolve, relative } from "node:path";
import { author, breadcrumbs, breadcrumbSchema, jsonLd, origin } from "../seo";

const site = resolve(import.meta.dir, "..");
const output = resolve(site, "public");
const stocks = resolve(site, "../stocks");

for (const [directory, path] of [["showcase", "/nansen-showcase"], ["polymarket-showcase", "/polymarket-showcase"]]) {
  const ssr = resolve(site, ".output", directory!);
  const build = Bun.spawn(["bun", "x", "vite", "build", "--config", `${directory}/vite.config.ts`, "--ssr", resolve(stocks, directory!, "render.tsx"), "--outDir", ssr], { cwd: stocks, stdout: "inherit", stderr: "inherit" });
  if (await build.exited) throw new Error(`${directory} server rendering failed`);
  const { render } = await import(resolve(ssr, "render.js"));
  const file = resolve(output, path!.slice(1), "index.html");
  const html = (await Bun.file(file).text()).replace('<div id="root"></div>', `<div id="root">${render()}</div>`);
  await Bun.write(file, html);
}

// The showcases import the app stylesheet, which also declares the TTF fonts.
// Replace those declarations in their built CSS with the site's WOFF2 files.
for (const directory of ["nansen-showcase", "polymarket-showcase"]) {
  const assets = resolve(output, directory, "assets");
  for (const file of await readdir(assets)) {
    if (!file.endsWith(".css")) continue;
    const target = resolve(assets, file);
    let stylesheet = await Bun.file(target).text();
    stylesheet = stylesheet.replace(/url\([^)]*inter-[^)]*\.ttf\)format\([^)]+\)/g, 'url("/pecu-assets/fonts/inter.woff2")format("woff2")')
      .replace(/url\([^)]*jetbrains-mono-[^)]*\.ttf\)format\([^)]+\)/g, 'url("/pecu-assets/fonts/jetbrains-mono.woff2")format("woff2")')
      .replaceAll("font-display:swap", "font-display:optional");
    await Bun.write(target, stylesheet);
  }
}

await Bun.write(resolve(output, "pecu-assets/fonts.css"), `@font-face{font-family:Inter;font-style:normal;font-weight:100 900;font-display:optional;src:url("/pecu-assets/fonts/inter.woff2") format("woff2")}\n@font-face{font-family:"JetBrains Mono";font-style:normal;font-weight:100 800;font-display:optional;src:url("/pecu-assets/fonts/jetbrains-mono.woff2") format("woff2")}\n`);

// Resolve the small CSS imports at build time so first paint needs one request.
const style = resolve(output, "pecu-assets/style.css");
let css = await Bun.file(style).text();
for (const [, dependency] of css.matchAll(/@import\s+["']([^"']+)["'];/g)) {
  css = css.replace(`@import "${dependency}";`, await Bun.file(resolve(output, "pecu-assets", dependency!)).text());
}
await Bun.write(style, css);

const pages = new Map<string, string>();
async function collect(directory: string) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = resolve(directory, entry.name);
    if (entry.isDirectory()) await collect(file);
    else if (entry.name === "index.html") {
      const part = relative(output, file).replace(/\/index\.html$/, "");
      pages.set(part === "index.html" ? "/" : `/${part}`, file);
    }
  }
}
await collect(output);
for (const [path, file] of pages) {
  let html = await Bun.file(file).text();
  const canonical = `${origin}${path}`;
  const title = html.match(/<title>([^<]+)<\/title>/)?.[1];
  const description = html.match(/<meta name="description" content="([^"]+)"/)?.[1];
  if (!title || !description) throw new Error(`${path}: missing title or description`);
  if ((html.match(/<h1(?:\s|>)/g) ?? []).length !== 1) throw new Error(`${path}: needs one rendered H1`);
  if (/noindex/i.test(html)) throw new Error(`${path}: unexpected noindex`);
  if (!html.includes('src="/pecu-assets/analytics.js"')) {
    html = html.replace("</head>", '<script type="module" src="/pecu-assets/analytics.js"></script></head>');
  }
  html = html.replace(/<link rel="canonical"[^>]*>/g, "");
  let metadata = `<link rel="canonical" href="${canonical}">`;
  if (!html.includes('name="author"')) metadata += '<meta name="author" content="Francesco Oddo">';
  if (path === "/") {
    const questions = [...html.matchAll(/<details id="faq-[^"]+"><summary>(.*?)<\/summary><p>(.*?)<\/p><\/details>/g)];
    metadata += jsonLd({ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: questions.map(([, question, answer]) => ({ "@type": "Question", name: question, acceptedAnswer: { "@type": "Answer", text: answer } })) });
    metadata += jsonLd({ "@context": "https://schema.org", "@type": "WebSite", name: "Pecu", url: origin, creator: author });
  } else if (!path.startsWith("/docs/")) {
    const name = title.split(" | ")[0]!;
    const crumbs = [{ name: "Pecu", path: "/" }, { name, path }];
    metadata += jsonLd(breadcrumbSchema(crumbs));
    if (["/design", "/about"].includes(path)) html = html.replace(/<h1>/, `${breadcrumbs(crumbs)}<h1>`);
    if (path === "/about") metadata += jsonLd({ "@context": "https://schema.org", "@type": "ProfilePage", url: canonical, mainEntity: author });
  }
  if (["/", "/about"].includes(path) || path.startsWith("/docs")) metadata += '<link rel="preload" href="/pecu-assets/fonts/inter.woff2" as="font" type="font/woff2" crossorigin><link rel="preload" href="/pecu-assets/fonts/jetbrains-mono.woff2" as="font" type="font/woff2" crossorigin>';
  html = html.replace("</head>", metadata + "</head>");
  if (path === "/design") {
    html = html.replaceAll('src="/pecu-assets/icon-192.png"', 'src="/pecu-assets/icon-192.webp"');
    html = html.replace(/<img\b[^>]*>/g, (image) => {
      if (/\bwidth=/.test(image) && /\bheight=/.test(image)) return image;
      const size = image.includes("mascot/idle.webp") ? [960, 720] : image.includes("mascot/pecu-reveal.webp") ? [1280, 720] : image.includes("icon-192.webp") ? [192, 192] : null;
      return size ? image.replace("<img", `<img width="${size[0]}" height="${size[1]}"`) : image;
    });
  }
  await Bun.write(file, html);
}

for (const path of ["/un-aerosdk", "/evmsdk", "/agent", "/stocks"]) pages.set(path, "");
await Bun.write(resolve(output, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${[...pages.keys()].sort().map(path => `  <url><loc>${origin}${path}</loc></url>`).join("\n")}\n</urlset>\n`);
await Bun.write(resolve(output, "robots.txt"), `User-agent: *\nAllow: /\nDisallow: /stocks/api/\nDisallow: /agent/api/\nDisallow: /profile\nDisallow: /researches\n\nSitemap: ${origin}/sitemap.xml\n`);
console.log(`SEO checked ${pages.size} canonical URLs; generated sitemap.xml and robots.txt`);
