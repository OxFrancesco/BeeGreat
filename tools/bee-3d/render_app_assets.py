"""Render app-ready Bee assets from the built bee.blend.

Run from the repository root after building the asset:

    blender assets/bee-3d/bee.blend --background \
      --python tools/bee-3d/render_app_assets.py

Outputs:

- /tmp/bee-app-idle/frame_####.png — transparent idle-loop frames (512px)
  for encoding apps/mobile/assets/images/bee.webp with img2webp
- /tmp/bee-app-moods/bee-<mood>.png — transparent 600px mood stills for
  apps/mobile/assets/images/moods/
"""

from __future__ import annotations

import math
from pathlib import Path

import bpy


IDLE_DIR = Path("/tmp/bee-app-idle")
MOOD_DIR = Path("/tmp/bee-app-moods")

# mood -> (expression plate object or None, root pose)
MOODS = {
    "awful": ("Face_sad", {"z": -0.5, "rx": 8, "rz": -6}),
    "bad": ("Face_sleepy", {"z": -0.25, "rx": 4, "rz": 3}),
    "okay": (None, {"z": 0.0, "rx": 0, "rz": 0}),
    "good": ("Face_blink", {"z": 0.1, "rx": 0, "rz": 3}),
    "great": ("Face_happy", {"z": 0.25, "rx": -4, "rz": -5}),
}


def mute_tracks(active: str | None) -> None:
    for obj in bpy.data.objects:
        if obj.animation_data:
            for track in obj.animation_data.nla_tracks:
                track.mute = track.name != active


def setup_transparent_render(size: int) -> None:
    scene = bpy.context.scene
    for engine in ("BLENDER_EEVEE_NEXT", "BLENDER_EEVEE", "CYCLES"):
        try:
            scene.render.engine = engine
            break
        except TypeError:
            continue
    scene.render.resolution_x = size
    scene.render.resolution_y = size
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.image_settings.color_depth = "8"
    scene.render.film_transparent = True
    scene.render.fps = 24
    floor = bpy.data.objects.get("Preview_Floor")
    if floor:
        floor.hide_render = True


def render_idle_frames() -> None:
    IDLE_DIR.mkdir(parents=True, exist_ok=True)
    scene = bpy.context.scene
    setup_transparent_render(512)
    mute_tracks("idle")
    # Frame 193 duplicates frame 1, so stop at 192 for a seamless loop.
    for frame in range(1, 193):
        scene.frame_set(frame)
        scene.render.filepath = str(IDLE_DIR / f"frame_{frame:04d}.png")
        bpy.ops.render.render(write_still=True)
    print(f"Idle frames: {IDLE_DIR}")


def render_moods() -> None:
    MOOD_DIR.mkdir(parents=True, exist_ok=True)
    scene = bpy.context.scene
    setup_transparent_render(600)
    mute_tracks(None)
    scene.frame_set(0)

    root = bpy.data.objects["Bee_Root"]
    for mood, (plate_name, pose) in MOODS.items():
        plate = bpy.data.objects.get(plate_name) if plate_name else None
        if plate:
            plate.scale = (1.0, 1.0, 1.0)
        root.location = (0, 0, pose["z"])
        root.rotation_euler = (
            math.radians(pose["rx"]),
            0,
            math.radians(pose["rz"]),
        )
        scene.render.filepath = str(MOOD_DIR / f"bee-{mood}.png")
        bpy.ops.render.render(write_still=True)
        if plate:
            plate.scale = (0.0, 0.0, 0.0)

    root.location = (0, 0, 0)
    root.rotation_euler = (0, 0, 0)
    print(f"Mood stills: {MOOD_DIR}")


def main() -> None:
    render_idle_frames()
    render_moods()


if __name__ == "__main__":
    main()
