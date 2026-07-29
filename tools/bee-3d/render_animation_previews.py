"""Render one isolated preview sequence for each Bee animation clip.

Run from the repository root after building the asset:

    blender assets/bee-3d/bee.blend --background \
      --python tools/bee-3d/render_animation_previews.py

Each NLA track is rendered independently so the preview exactly matches the
named clips exported in bee.glb.
"""

from __future__ import annotations

from pathlib import Path

import bpy


REPO_ROOT = Path(__file__).resolve().parents[2]
OUTPUT_ROOT = REPO_ROOT / "assets" / "bee-3d" / "previews" / "animations"
CLIPS = (
    "idle",
    "listening",
    "working",
    "waiting",
    "success",
    "failure",
    "sleeping",
)


def all_tracks() -> list[bpy.types.NlaTrack]:
    tracks: list[bpy.types.NlaTrack] = []
    for obj in bpy.data.objects:
        animation_data = obj.animation_data
        if not animation_data:
            continue
        tracks.extend(animation_data.nla_tracks)
    return tracks


def select_clip(clip_name: str) -> tuple[int, int]:
    matching_strips: list[bpy.types.NlaStrip] = []
    for track in all_tracks():
        track.mute = track.name != clip_name
        if track.name == clip_name:
            matching_strips.extend(track.strips)

    if not matching_strips:
        raise RuntimeError(f"No NLA strips found for clip: {clip_name}")

    start = min(round(strip.frame_start) for strip in matching_strips)
    end = max(round(strip.frame_end) for strip in matching_strips)
    return start, end


def render_clip(clip_name: str) -> None:
    scene = bpy.context.scene
    start, end = select_clip(clip_name)
    clip_dir = OUTPUT_ROOT / clip_name
    clip_dir.mkdir(parents=True, exist_ok=True)

    scene.frame_start = start
    scene.frame_end = end
    scene.render.filepath = str(clip_dir / "bee-")
    scene.frame_set(start)
    bpy.context.view_layer.update()
    bpy.ops.render.render(animation=True)
    print(f"Rendered {clip_name}: frames {start}-{end} -> {clip_dir}")


def main() -> None:
    OUTPUT_ROOT.mkdir(parents=True, exist_ok=True)
    scene = bpy.context.scene
    for engine in ("BLENDER_EEVEE_NEXT", "BLENDER_EEVEE", "CYCLES"):
        try:
            scene.render.engine = engine
            break
        except TypeError:
            continue
    scene.render.resolution_x = 512
    scene.render.resolution_y = 512
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGB"
    scene.render.image_settings.color_depth = "8"
    scene.render.fps = 24
    scene.render.film_transparent = False
    scene.render.use_file_extension = True
    scene.render.filepath = ""

    for clip_name in CLIPS:
        render_clip(clip_name)

    for track in all_tracks():
        track.mute = False
    scene.frame_set(0)


if __name__ == "__main__":
    main()
