# Aero landing page

Static homepage for https://aerocli.buddytools.org. No wallet connection. A native video player embeds the supplied walkthrough. The interactive Blender model and its transparent render are hosted with the page.

The landing page uses a light claymorphic palette, rounded surfaces, inset highlights, and soft shadows. This is the user's requested exception to the app's flat design system. A Dark Reader lock preserves the authored colors and prevents the illustration and shadows from being recolored. Body text remains selectable, links have visible keyboard focus, and motion respects reduced-motion preferences.

The capability descriptions follow the CLI command registry, TUI home and form definitions, and package README. Keep SDK-only governance APIs distinct from terminal actions. The ALM watcher and execution recovery are CLI workflows; analytics are TUI screens. No mobile, web chat, iMessage, provider, or backend behavior changes with this site.

See [ARTWORK.md](ARTWORK.md) for the editable Blender scene, render command, browser build command, and original reference image.

Deploy from the BeeGreat repository root:

```sh
bunx wrangler deploy --config packages/sugar/site/wrangler.jsonc
```

The configuration pins Francesco's personal Cloudflare account. The exact hostname route takes precedence over the zone's wildcard BuddyBox route. Keep both the custom domain and the exact route.

The homepage contains the Base ownership tag in its initial HTML head. After deployment, verify the public HTML and complete any pending verification in the Base dashboard.

This is an independent project and is not affiliated with, endorsed by, sponsored by, or maintained by Aerodrome Finance, Velodrome Finance, Dromos Labs, or Mellow Protocol. References to their names and protocols describe compatibility or source attribution only. All trademarks belong to their respective owners. Third-party code remains subject to its applicable licenses.

The capabilities use an animated responsive bento grid whose cards open popups on hover, tap, or keyboard activation. The 3D scene supports desktop drag and keyboard rotation, coin flips, chart height toggles, the existing Aero ribbon animation, and Reset. On mobile and devices with a coarse pointer, swipes scroll the page and object taps still trigger animations. It uses a transparent WebGL canvas and a transparent PNG fallback.

Coin animations check oriented collision bounds before rendering. See [landing page behavior](../../../docs/24-aero-landing-page.md) for the interaction contract and verification command.

Link previews use the browser screenshot in `public/page-preview.png`, referenced by Open Graph and X card metadata in the initial HTML. Recapture it after substantial landing-page changes.
