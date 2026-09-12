# Interactive Hive vessel

The Hive tab uses an original Blender model with voxel geometry and Bee's orange,
brown, and wax palette. Drag horizontally to rotate through 360 degrees. Vertical
swipes scroll the screen. Arrow keys rotate on the web, and Home or a double click
restores the initial angle. The model does not spin or animate on its own.

The honey chamber displays the live balance up to 100 Honey. Empty balances hide
the honey meshes. Overflow stays in the balance and accessibility description.
Changing the view never changes account data.

## Assets and build

- `assets/hive-3d/hive.blend` is the editable Blender scene with lights and camera.
- `assets/hive-3d/hive.glb` contains the shell, honey volume, and honey surface.
- `tools/bee-3d/build_hive.py` rebuilds the model and transparent previews.
- `packages/hive-3d` bundles Three.js, the GLB, and a fallback render into one
  offline HTML document. Its Three.js MIT notice ships with both runtime outputs.

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python tools/bee-3d/build_hive.py
bun run --cwd packages/hive-3d build
bun run --cwd packages/hive-3d test
```

Regenerate the viewer after editing the model or viewer source. Commit both
`src/generated.ts` and Android's `assets/hive3d/index.html` with the sources.
The exporter puts the honey origin at its bottom. Runtime code scales local Y in
glTF and moves the separate surface using the exported base and height metadata.

The viewer caps device pixel ratio at 2 and redraws only after input, resize,
balance changes, or visibility changes. The retained
drawing buffer keeps the last frame visible in Android WebView between updates. It disposes GPU
resources when removed. The draw callback sizes the host and canvas from the actual viewport. This avoids
Android WebView resolving the initial CSS height to zero inside a scrolling
Compose layout.
The fallback render is 320 pixels so inline HTML stays below Android's data URL
size limit. Kotlin loads the same document directly from packaged assets.

## Client coverage

Android embeds the viewer in a Compose AndroidView with a built-in WebView. Expo
uses react-native-webview 13.16.1, which requires rebuilding existing development
clients. Web embeds it in a sandboxed iframe. All three load the same embedded GLB
without a CDN or network request. Kotlin blocks network and arbitrary file access;
the viewer's Content Security Policy blocks connections on every client.

CLI and iMessage retain the text balance. Voice, tool output, providers, backend
contracts, and reverse actions are unaffected. No service deployment is required
for this visual asset change.

## Verification

The GLB tests verify named meshes, the bottom anchor, full height, and an embedded
buffer without external textures. Balance tests cover empty, 45, 100, overflow,
negative values, and non-finite values. Web and Expo TypeScript checks pass. The
web production build passes. Android build and lint pass.

Browser checks cover empty, partial, full, overflow, keyboard rotation, and reset.
On the physical Fold 8, a horizontal drag rotates to the rear entrance, a vertical
swipe scrolls to the achievements, and switching tabs reloads the viewer cleanly.
The chat geometry checks also pass with the keyboard closed and open. Device
screenshots and the recording are included in the task report. Expo's native
wrapper is typechecked; an iOS device build has not been exercised in this task.
