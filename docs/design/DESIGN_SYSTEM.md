# BeeGreat design assets

The canonical visual rules and tokens live in [`DESIGN.md`](../../DESIGN.md). Mobile is the interaction reference; web adapts the same hierarchy to a wider canvas.

## Source of truth

- Colors, spacing, width, and fonts: `apps/mobile/src/constants/theme.ts`
- Motion: `apps/mobile/src/constants/motion.ts`
- Web tokens: `apps/web/src/styles/app.css`
- Product guardrails: [`PRODUCT.md`](../../PRODUCT.md)

Keep content centered at a maximum width of 800px. Use flat surfaces, hairline borders, 12–16px radii, fixed type sizes, and honey only for progress, voice, or selection.

## Reusable assets

Use files from `apps/mobile/assets/` directly instead of redrawing them:

- `images/bee.webp` for Bee and GolieBee
- `images/honeypot.svg` for sign-in
- `images/hive-vessel.png` for Hive progress
- `icons/bee.svg`, `honeycomb.svg`, `hive.svg`, and `mic-honey.svg` for navigation
- `images/icon.png`, `favicon.png`, and `logo.png` for app branding

The files in this directory are references:

- [`Initial-Page.svg`](Initial-Page.svg) is the original sign-in composition.
- [`Logo.png`](Logo.png) and [`Icons.png`](Icons.png) are source sheets, not runtime sprites.

## Review checklist

- Match the mobile information hierarchy before adapting for desktop.
- Preserve keyboard, screen-reader, text-input, and reduced-motion paths.
- Avoid gradients, glass effects, resting shadows, oversized headings, nested card grids, and implementation copy.
