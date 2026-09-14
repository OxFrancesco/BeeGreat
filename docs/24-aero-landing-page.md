# Aero landing page

The standalone site in `packages/sugar/site` serves `aerocli.buddytools.org`.

The Blender scene keeps its transparent canvas. Coins use oriented bounding boxes that include their rims. Before each rendered animation frame, a separating-axis collision check moves coins forward only as far as needed to clear the other coin, terminal, plinth and current chart columns. Both-coin and single-coin flips use the same check. Reset restores collision-safe starting positions. This prevents animation overlaps; objects do not have free dragging or gravity.

Desktop dragging rotates the view. Mobile swipes scroll the page. Object taps, keyboard rotation, the animation buttons and reduced-motion behavior still work.

Hovering a capability card opens its popup without changing the grid height. Clicking, tapping, Enter or Space also opens it. Escape, the close button and outside clicks dismiss it. Popups stay inside the viewport and scroll when needed. There is no visible "Explore capabilities" label.

The walkthrough uses a native video player with controls and inline mobile playback. The supplied walkthrough is encoded as 720p H.264 at 30 fps with AAC audio and fast-start metadata, then hosted with the site. A poster appears before playback and preload is disabled so loading the page does not download the video. It does not autoplay. The tweet, widget script and X-specific content-security-policy entries were removed.

This change applies only to the standalone landing page on desktop and mobile browsers. Bee's mobile app, web chat, CLI, iMessage, voice, providers and backend contracts are unaffected. The only application deploy target is the `aero-cli-site` Cloudflare worker on Francesco's personal account. The report has its own path-scoped worker.

Build and check the actual Blender model with Three.js 0.180.0 installed in an isolated directory:

```sh
AERO_THREE_ROOT=/absolute/path/to/node_modules/three bun packages/sugar/site/build.ts
AERO_THREE_ROOT=/absolute/path/to/node_modules/three bun packages/sugar/site/build.ts --test
```

The collision tests sample both-coin and individual flips while raising and lowering the chart, repeat flips, and check reduced-motion endpoints and Reset stability. They check conservative bounding volumes, not triangle-level contacts.
