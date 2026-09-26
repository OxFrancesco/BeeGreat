# Pecu explainer motion

A 30 second, 1920x1080 explainer: what Pecu is, a quick chat demo, the feature set
and the call to action.

- `explainer.html`, `explainer.css`, `explainer.js`: the piece. It imports
  `theme/theme.css`, `theme/clay.css` and the bundled fonts, and uses the mascot
  clips from `apps/site/site/pecu-assets/mascot`, so it stays on the shared theme.
- `render.ts`: seeks the timeline frame by frame in headless Chrome and pipes PNGs to ffmpeg.

Copy follows `apps/site/docs/pecu`. Addresses, amounts and codes on screen are fictional.

## Commands

Run from `apps/pecu/motion`. Needs Chrome (or set `CHROME_PATH`) and ffmpeg.

```sh
bun install
bun run render                          # dist/pecu-explainer.mp4
bun render.ts --stills 10,24,47         # dist/still-<t>.png for quick review
bun render.ts --fps 60 --out out.mp4
```

To watch it live, serve `apps/pecu` statically and open `/motion/explainer.html`.
Hover for the scrubber; Space pauses.
