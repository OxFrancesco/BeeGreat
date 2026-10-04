# Pecu search indexing

Pecu's homepage and docs ship complete HTML. The Nansen and Polymarket showcases
also render at build time and hydrate the same React components in the browser.
The agent and Stocks use their existing TanStack server rendering. The gateway
adds their canonical URLs and the Stocks description.

The site build generates `/sitemap.xml` from the public pages and the four product
entry points. It excludes private profile and research pages, API routes, assets,
query strings and missing pages. `/robots.txt` allows public crawling and advertises
the sitemap. Google Search Console uses a URL-prefix property for `https://pecu.app/`.
The public verification tag must stay in the homepage.

Public pages have a title, description, canonical URL and one H1. The build rejects
missing metadata, unexpected noindex directives and missing or duplicate H1s.
Docs links and heading anchors also pass the existing build validation. Missing
pages keep their 404 status. The docs 404 does not claim the docs root as canonical.
Legacy paths, trailing slashes and index-file aliases redirect directly to their
clean destination. Queries and 308 method semantics are preserved.

Docs, showcases, design, SDK landing pages and the author page have breadcrumbs.
The homepage's FAQ schema comes from its visible questions and answers. FAQ markup
does not promise a Google rich result. The author page links Francesco's portfolio
and source repositories; it does not invent credentials or endorsements.

The homepage shows its WebP poster before starting the mascot video after load.
The Aero scene module also waits for load. Content stays visible before arrival
animations. Reserved media dimensions and optional WOFF2 font loading avoid late
font swaps. The build combines the homepage's small CSS imports. The gateway also rewrites
the app stylesheet to use the same WOFF2 files, with a versioned stylesheet URL
so browsers do not reuse the old fonts. Aero controls reserve their height before
the 3D scene loads. Raster Aero
artwork and its video poster use WebP on pecu.app; SVGs and social previews keep
their appropriate formats. Decorative images keep empty alt text.

This change applies to Pecu's public website and web presentation. Mobile, native
Android, CLI and iMessage conversations, provider routing, agent contracts and
transaction behavior do not change. The site Worker is the only deployment target.
Existing MCP routes and docs are preserved from the deployed base `826391b6`.

Relevant GitHub repository homepage fields link to `/un-aerosdk` and `/evmsdk`.
These are owned project links, not independent editorial coverage. External
publishers decide whether to link; no paid links or unsolicited outreach is sent.
