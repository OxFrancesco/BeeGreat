# Pecu design reference

`/design` collects the shared amber-minimal theme, clay material, component
specimens, mascot assets and design rules for Pecu and Pecu Agent. The homepage
footer links to it. `/design/` and `/design/index.html` redirect to `/design`.

`apps/pecu/theme/amber-minimal.json` pins the supplied registry theme.
`theme/theme.css` is generated from it. Both the homepage and Agent import that
file and `theme/clay.css`. Inter and JetBrains Mono are bundled locally with their
OFL licenses; the site CSP permits same-origin fonts. UI colors and fonts now match; the original mascot,
rounded controls, inset highlights and soft shadows remain. The design page
reads the same files during its build instead of maintaining a second palette.

Run `bun run --cwd apps/pecu design:check`. It checks theme drift, shared imports,
literal CSS colors, local upstream-token overrides and shadow recipes, then runs
`@shadcn/lint` 0.1.1 with Oxlint on React source. Rules reject raw Tailwind colors,
arbitrary colors and inline color, font and shadow changes. Data-driven chart
styles have explicit exceptions. Both frontend builds and Pecu's check command
include design checks. No linter can replace visual review.

Sample interactions at `/design` only change local state. Agent browser fixtures
exercise actual React components with fictional conversations, wallets and sign-in
responses. No real quote, transaction preparation, funds movement or OAuth was used.

Validation includes both frontend builds and typechecks, policy unit tests,
negative lint probes, responsive screenshots and Agent fixture interaction checks.
The report contains screenshots and a recording of command completion and the
simulated connection panel.

Scope: Pecu homepage, desktop/mobile Agent, `/design`, shared theme and design
checks. Standalone Aero Stocks retains its own workspace theme. Bee native apps,
CLI, iMessage, providers and backend contracts are unchanged. Product deployment
is pending; the report preview is deployed independently. The source is reviewed in the release PR stack.
