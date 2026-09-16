"""Render the existing Pecu 3D scenes without the studio floor.

blender -b --python apps/pecu/scripts/render-mascot-alpha.py -- thinking /tmp/pecu-alpha
The editable source stays under output/blender/pecu-mascot-v2.
"""
import argparse
import sys
from pathlib import Path
import bpy

parser = argparse.ArgumentParser()
parser.add_argument("state", choices=["idle", "thinking"])
parser.add_argument("output", type=Path)
parser.add_argument("--preview", action="store_true")
args = parser.parse_args(sys.argv[sys.argv.index("--") + 1:])
source = Path(__file__).resolve().parents[3] / "output/blender/pecu-mascot-v2" / f"{args.state}.blend"
bpy.ops.wm.open_mainfile(filepath=str(source))
scene = bpy.context.scene
floor = bpy.data.objects.get("Studio · seamless ivory")
assert floor is not None, "Expected studio floor was not found"
floor.hide_render = True
scene.render.film_transparent = True
scene.render.image_settings.file_format = "PNG"
scene.render.image_settings.color_mode = "RGBA"
scene.render.resolution_x = 640
scene.render.resolution_y = 480
scene.render.resolution_percentage = 100
scene.cycles.samples = 32
preferences = bpy.context.preferences.addons["cycles"].preferences
preferences.compute_device_type = "METAL"
preferences.get_devices()
for device in preferences.devices:
    device.use = device.type == "METAL"
scene.cycles.device = "GPU"
folder = args.output / args.state
folder.mkdir(parents=True, exist_ok=True)
for frame in ([1] if args.preview else range(scene.frame_start, scene.frame_end + 1)):
    path = folder / f"{frame:04}.png"
    if path.exists():
        continue
    scene.frame_set(frame)
    scene.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)
    print(f"ALPHA_FRAME {args.state} {frame}/{scene.frame_end}", flush=True)
