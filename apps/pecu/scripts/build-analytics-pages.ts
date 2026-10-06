import { readdir } from "node:fs/promises";

const docs = new URL("../apps/site/docs/", import.meta.url);
const pages = ["/docs"];
for (const product of ["pecu", "aero", "evm"]) {
  for (const file of await readdir(new URL(`${product}/`, docs))) {
    if (!/^\d{2}-[a-z0-9-]+\.md$/.test(file)) continue;
    const slug = file.slice(3, -3);
    pages.push(slug === "overview" ? `/docs/${product}` : `/docs/${product}/${slug}`);
  }
}
const output = Bun.file(new URL("../src/analytics-pages.generated.json", import.meta.url));
const content = `${JSON.stringify(pages.sort(), null, 2)}\n`;
if (process.argv.includes("--check")) {
  if (!await output.exists() || await output.text() !== content) {
    throw new Error("Analytics page list is stale. Run bun scripts/build-analytics-pages.ts from apps/pecu.");
  }
} else {
  await Bun.write(output, content);
}
