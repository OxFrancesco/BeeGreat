# evmSDK landing page

The standalone site in `packages/evm/site` serves `evm.buddytools.org`. It is the evmSDK twin of the Aero CLI page described in [24-aero-landing-page.md](24-aero-landing-page.md) and shares that page's structure: topbar, hero, experimental warning, animated bento capability grid with hover and click popups, a dark example panel, the risk and non-affiliation notices, and a footer. The palette is sea-glass teal rather than Aero blue so the two products read as siblings without being mistaken for each other. The two footers link to each other.

The capability tiles mirror the command table in `packages/evm/README.md`. When a command is added, renamed or removed from the catalog, update the matching tile and popup. Claims that must stay accurate on the page: quantities cross JSON as decimal strings and native values are wei; `--yolo` skips only the toolkit approval prompt for one invocation and never bypasses simulation or chain checks; Crossmint and EIP-5792 batches reject EOA policy bounds; interactive wallets stay interactive under `--yolo`.

The Aero page's demo video section is replaced with a static JSON session showing `discover`, `prepare-call`, `execute` and `status`. Its ids, fingerprints and hashes are truncated placeholders. There is no video, no wallet connection and no third-party script; the content security policy allows only same-origin scripts, styles and images.

The hero is `public/evm-hero.svg`, a placeholder for a Blender render. Replace it with a square transparent PNG and update the `<img>` attributes, then recapture `public/page-preview.png` at 1200 by 860 for link previews.

Popups behave exactly as on the Aero page: hover opens on a fine pointer, click or keyboard pins, Escape or the close button dismisses, and popups stay inside the viewport. Tiles animate into view once; reduced motion disables the arrival, cursor blink and chart pulse.

This change applies only to the standalone landing page on desktop and mobile browsers. Bee's mobile app, web chat, CLI, iMessage, voice, providers and backend contracts are unaffected. The only deploy target is the `evm-sdk-site` Cloudflare worker on Francesco's personal account:

```sh
bunx wrangler deploy --config packages/evm/site/wrangler.jsonc
```
