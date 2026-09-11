# Bee 3D asset builder

> This is an independent project and is not affiliated with, endorsed by, sponsored by, or maintained by Aerodrome Finance, Velodrome Finance, Dromos Labs, or Mellow Protocol. References to their names and protocols describe compatibility or source attribution only. All trademarks belong to their respective owners. Third-party code remains subject to its applicable licenses.

The current mascot is the bright yellow voxel Bee. Its editable source lives in `assets/bee-3d/minecraft-yellow`.

```sh
blender --background --factory-startup --python tools/bee-3d/build_minecraft_bee.py
blender --background --factory-startup --python tools/bee-3d/animate_minecraft_bee.py
blender --background --factory-startup --python tools/bee-3d/render_app_assets.py
```

The animation source contains idle, fly, happy, sad, thinking, fail, and succeed. Each clip lasts four seconds. The renderer installs transparent 512px animated WebPs and matching stills in `apps/mobile/assets/images/bee`, updates health moods and doctor artwork, copies docs assets, and promotes the source to `assets/bee-3d/bee.blend` and `bee.glb`. Fail and succeed play once in the app. Other clips loop.

Face plates reset in every clip. Root motion preserves the cube proportions. Wings, antennae, and legs have separate tracks. The GLB contains the mascot and animations without the preview studio.

`build_bee.py` remains the original pixel-map geometry library used by the current builder. Its old direct-build output is historical. `build_cute_bee.py` is the rejected rounded study and is not the app mascot.

See `docs/25-bee-mascot.md` for client integration and reduced-motion behavior.

The palette lives in `tools/bee-3d/bee_appearance.py`. Saturated yellow materials include a small emission contribution to keep shadowed faces yellow. Low specular reflections preserve the dark pixel outlines. Change the Blender palette and regenerate assets together.
