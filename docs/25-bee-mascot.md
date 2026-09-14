# Bee mascot

Bee's mascot is the yellow voxel model in `assets/bee-3d/bee.blend` and `bee.glb`. The approved source and previews live in `assets/bee-3d/minecraft-yellow`.

Mobile and web use transparent 512px renders of seven four-second clips: idle, fly, happy, sad, thinking, fail, and succeed. `FloatingBee` and `BeeMascot` accept the shared `BeeAnimation` type. Fail and succeed play once. Other clips loop. Reduced motion uses a matching PNG. Completed chat avatars also use a PNG to avoid running an animation for every message.

Chat activity uses thinking. GolieBee celebrations use succeed. Health mood images and the doctor Bee use the same model. The docs homepage uses the new idle render. Voice keeps its microphone and audio controls. CLI and iMessage remain text channels; the iMessage linking page uses the web mascot. Both agent providers use these same client components. This change requires no backend, agent worker, or bridge migration.

Rebuild with Blender:

```sh
blender --background --factory-startup --python tools/bee-3d/build_minecraft_bee.py
blender --background --factory-startup --python tools/bee-3d/animate_minecraft_bee.py
blender --background --factory-startup --python tools/bee-3d/render_app_assets.py
```

The final command installs the animation and PNG assets into mobile, copies the docs assets, replaces the health variants, and promotes the Blender and GLB source. Intermediate frames stay in the temporary directory. The app icon and navigation symbols have separate roles and are unchanged.

The palette lives in `tools/bee-3d/bee_appearance.py`. Saturated yellow materials include a small emission contribution to keep shadowed faces yellow. Low specular reflections preserve the dark pixel outlines. Change the Blender palette and regenerate assets together.

Still files use the `-still.png` suffix because Android drawable resource names ignore file extensions. A clip and its still must have distinct basenames.
