# Clay terminal illustration

Generated with the built-in image tool on September 9, 2026. Saved unchanged at `public/aero-clay.png`, 1254 by 1254 pixels. The original remains in the Codex generated-images directory.

Prompt:

> Use case: stylized-concept. Asset type: one original hero illustration for the Aero CLI landing page. Create a polished claymorphism 3D still life: a small rounded charcoal terminal screen with a simple cream >_ prompt, on a chunky soft periwinkle clay base, accompanied by two rounded clay coin discs and a small three-bar chart made from pale peach clay. This is a terminal tool for decentralized exchange trading; keep the scene restrained and tactile, no real protocol logos, no people, no extra lettering, no watermark. Matte hand-molded polymer clay with soft bevels, gentle surface imperfections, broad studio lighting, deep soft contact shadows. Three-quarter front view, balanced square composition, objects occupy central 75% with generous breathing room. Seamless solid pale cool lilac background #e9e7f2, matching a light claymorphic website. One cohesive illustration, not a website mockup, no UI cards around it.

## Blender scene, September 9 update

The live page now loads `public/aero-scene.glb`, exported from `artwork/aero.blend`. `artwork/render.py` constructs the editable scene. `public/aero-blender.png` is its transparent Cycles render and the fallback when WebGL is unavailable. There is no backdrop or floor mesh.

The model follows the original terminal, two coins, three chart columns, and rounded plinth composition. The palette uses Aero blue, pale blue, ivory and midnight, sourced from https://aerodrome.finance/brand and the current site's CSS and SVG. Colors were adapted for physically lit clay materials. The browser uses real-time lighting; it is not pixel-identical to the Cycles still.

Rebuild the model and fallback:

```sh
blender --background --python packages/sugar/site/artwork/render.py
```

The browser uses Three.js 0.180.0 under the MIT license, shipped in `public/THREE-LICENSE.txt`. Install that pinned version into an isolated directory, then build with:

```sh
AERO_THREE_ROOT=/absolute/path/to/node_modules/three bun packages/sugar/site/build.ts
```

The terminal animation ports the six-ribbon geometry, colors, 40 ms frame timing, stagger, cubic easing and sweep from `packages/sugar/src/tui/logo.tsx`. It runs once per click. Reduced motion shows the completed mark. Scene rendering stops while idle, hidden, or outside the viewport.
