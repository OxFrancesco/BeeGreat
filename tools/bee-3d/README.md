# Bee 3D asset builder

This builder reconstructs BeeGreat's canonical animated pixel Bee as an
editable 3D asset made entirely from geometry and palette materials.

## Build

From the repository root:

```sh
blender --background --factory-startup --python tools/bee-3d/build_bee.py
```

The build produces:

- `assets/bee-3d/bee.blend` — editable Blender source
- `assets/bee-3d/bee.glb` — runtime asset for web and native renderers
- `assets/bee-3d/previews/` — canonical, transparent, orthographic, and
  turntable renders

The GLB contains seven named animation clips, each exactly 8 seconds
(193 frames at 24 fps) and authored to loop seamlessly:

- `idle` — gentle hover with two blinks
- `listening` — leans in, antennae perked, curious face
- `working` — fast wing buzz with a determined focus face and sweat pixel
- `waiting` — slow sway, glancing left and right
- `success` — spinning jump and happy wiggle with arc eyes and open smile
- `failure` — drooped hover with sad brows, frown, and a tear pixel
- `sleeping` — settled low, closed eyes, slow breathing, floating pixel "Zz"

Expressions are thin voxel face plates (`Face_*` objects plus `Sleep_Zzz`)
parented to `Bee_Root`. They rest at scale 0 and every clip keys every plate
with constant-interpolated 0/1 scale tracks, so switching clips always resets
the face — no runtime-specific code needed. Per-expression stills are written
to `assets/bee-3d/previews/bee-face-*.png`.

Render matching MP4 previews from the editable source with:

```sh
blender assets/bee-3d/bee.blend --background \
  --python tools/bee-3d/render_animation_previews.py
```

The isolated frame sequences are written beneath
`assets/bee-3d/previews/animations/` and can be encoded at 24 fps.

## Source of truth

The visible three-quarter proportions and palette are matched against
`apps/mobile/assets/images/bee.webp`. The rear, opposite side, and underside
are new canonical definitions because those surfaces are not visible in the
existing animation.

The model is intentionally built from primitives rather than generated
textures. This keeps the pixel silhouette crisp, makes recoloring deterministic,
and allows future GolieBee variants to reuse the same hierarchy and clips.

## Fidelity notes

Version 2.x rebuilds Bee as a true voxel grid driven by ASCII pixel maps
(1 voxel = 1 pixel of the canonical art): the face, wrap-around stripes, top
plates, stepped wings with real openings, antenna knobs, and legs are all
authored as editable maps in `build_bee.py`. Box-edge voxels are ink, which
reproduces the 1px outline of the pixel art in 3D.

## Three.js

Load `bee.glb` with `GLTFLoader`, add `gltf.scene` to the scene, then create an
`AnimationMixer` for the root. The seven clip names above are stable runtime
states and require no Blender-specific code.
