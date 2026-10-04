export const origin = "https://pecu.app";
export const author = {
  "@type": "Person",
  "@id": `${origin}/about#francesco-oddo`,
  name: "Francesco Oddo",
  url: `${origin}/about`,
  sameAs: ["https://oddofrancesco.com/", "https://github.com/OxFrancesco"],
};

export type Crumb = { name: string; path: string };
const escape = (value: string) => value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
export const jsonLd = (value: unknown) => `<script type="application/ld+json">${JSON.stringify(value).replaceAll("<", "\\u003c")}</script>`;
export const breadcrumbSchema = (crumbs: Crumb[]) => ({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: crumbs.map((crumb, index) => ({
    "@type": "ListItem", position: index + 1, name: crumb.name, item: origin + crumb.path,
  })),
});
export function breadcrumbs(crumbs: Crumb[]) {
  return `<nav class="breadcrumbs" aria-label="Breadcrumb"><ol>${crumbs.map((crumb, index) => `<li>${index === crumbs.length - 1 ? `<span aria-current="page">${escape(crumb.name)}</span>` : `<a href="${escape(crumb.path)}">${escape(crumb.name)}</a>`}</li>`).join("")}</ol></nav>`;
}

export function canonicalPath(path: string) {
  let clean = path.replace(/\/index\.html$/, "").replace(/\/+$/, "") || "/";
  if (clean === "/index.html") clean = "/";
  if (clean === "/aero/cli" || clean.startsWith("/aero/cli/")) clean = "/un-aerosdk" + clean.slice("/aero/cli".length);
  if (clean === "/un-aerosdk/docs" || clean.startsWith("/un-aerosdk/docs/")) clean = "/docs/aero";
  if (clean === "/chat" || clean.startsWith("/chat/")) clean = "/agent" + clean.slice("/chat".length);
  if (clean === "/aero/stocks" || clean.startsWith("/aero/stocks/")) clean = clean.slice("/aero".length);
  return clean;
}
