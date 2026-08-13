# BeeGreat — first X/Twitter post

Four landscape images designed as one X post. X currently accepts up to four photos per post, so the set tells one compact story while keeping the real mobile app at the center.

## Post copy

Most productivity apps give you more to manage. BeeGreat gives you one clear next focus.

Talk to Bee. Shape a goal. Choose today’s Highlight. Watch your Hive fill as you make progress—and keep everything useful in Mind.

This is BeeGreat on mobile.

## Image order and alt text

1. `01-meet-beegreat.png` — BeeGreat cover with the mobile Bee conversation screen, the pixel Bee, and the headline “One clear next step.”
2. `02-from-intention-to-plan.png` — Two mobile screens show Bee turning a spoken or typed intention into a goal, project, tasks, and one Highlight.
3. `03-progress-you-can-feel.png` — The mobile Hive screen shows a honey vessel and current Highlight, alongside Honey, Honeycomb Score, and GolieBee progress.
4. `04-your-system-in-your-pocket.png` — Voice and Mind screens beside a feature list covering goals, Highlights, Hive, GolieBees, bookmarks, mood, water, journal, power-ups, and work connections.

## Files

- `carousel/` contains the final 1600 × 900 PNGs, ready to upload in filename order.
- `profile/beegreat-bee-profile.png` is a 1024 × 1024 Bee avatar with generous circular-crop safety for X/Twitter and Telegram.
- `profile/beegreat-bee-profile-monochrome.png` is the minimal Bee avatar on a single Warm Honey background.
- `banner/beegreat-x-banner.png` is a 1500 × 500 X/Twitter banner with the line “Be great every day”.
- `source/` contains editable SVG compositions, the render script, real product screenshots, Bee assets, and the generated cover texture.

To rebuild the PNGs from the repository root:

```sh
bun install --cwd Social
bun run --cwd Social render
bun run --cwd Social render:brand
```

## Design choices

- BeeGreat light palette: canvas `#F9F9F9`, Hive Brown `#644A40`, Warm Honey `#FFDFB5`, ink `#202020`.
- Rounded display type, quiet body type, hairline cards, continuous corners, and one leading honey accent per region.
- Real release-candidate mobile screenshots are used throughout; no UI was invented for the post.
- The cover’s subtle wax-paper texture was generated with the built-in image generator; all product framing and copy are deterministic SVG.

## Generated background prompt

Use case: `ads-marketing`. Create a wide, premium, extremely restrained warm-neutral paper-and-wax backdrop inspired by a calm beehive. Use a matte off-white canvas with subtle paper grain, a small cluster of softly embossed pointy-top honeycomb cells only in the far upper-right, and a localized warm honey glow. Keep the center and left side clean for typography and phone mockups. Use only BeeGreat neutrals, Warm Honey, Honey Strong, and very subtle Hive Brown. No text, logos, bees, devices, people, watermark, full-page pattern, strong shadow, glassmorphism, or saturated orange.
