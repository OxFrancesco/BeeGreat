# Pecu cards

Thirty editable clay card scenes using the canonical Pecu snail. The original concept art is packed for reference and is never applied as an image texture.

Requires Blender 5.x on macOS, the existing `output/blender/pecu-mascot-v2/idle.blend`, and the numbered concept PNGs and `prompts.json` in `output/imagegen/pecu-claim-cards-20260922/`.

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --python tools/pecu-cards/build.py -- --ids 01,02,03
```

Use comma-separated IDs through 30. Add `--preview` for a 600 × 800 draft without saving the scene. Final output is 1080 × 1440, 64 Cycles samples, denoised. Metal is selected when available.

- `clay.py`: editable geometry and procedural material helpers.
- `themes.py`: the 30 miniature settings.
- `build.py`: mascot, card frame, lighting, camera, and render pipeline.
- `verify.py`: reopen every file and check scene IDs, source geometry, packed assets, and geometry-only artwork.
- `assemble.py`: combine the 30 files into a single project using numbered scenes.
- `render_details.py`: side and rear renders for geometry inspection.
- `package.py`: individual downloads, five-card ZIPs, and static gallery.

Run `verify.py`, `assemble.py`, and `render_details.py` with Blender's `--background --python` options. Run `package.py` with Python 3 after verification; it uses ImageMagick for web thumbnails. Gallery publishing is separate.

Open `pecu-all-30.blend` and choose a numbered scene in Blender's scene selector. Numpad 0 opens its camera; F12 renders. Individual files are in `blends/`, PNGs in `renders/`, and validation results in `validation.json`.
