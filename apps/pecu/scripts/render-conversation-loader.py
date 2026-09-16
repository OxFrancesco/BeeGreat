"""Create Pecu's transparent 3D loader and its editable Blender scene.

blender -b --python apps/pecu/scripts/render-conversation-loader.py -- /tmp/pecu-loader
Encode frames at 24 fps. Frames 1-48 form a seamless two-second loop.
WebM: libvpx-vp9, yuva420p, crf 28, b:v 0, auto-alt-ref 0.
Safari: hevc_videotoolbox, bgra, alpha_quality 0.9, tag:v hvc1, b:v 500k.
Poster: cwebp -q 90 0001.png. No floor or shadow catcher is used.
"""
import argparse
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector

parser = argparse.ArgumentParser()
parser.add_argument("output", type=Path)
parser.add_argument("--preview", action="store_true")
args = parser.parse_args(sys.argv[sys.argv.index("--") + 1:])
args.output.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.engine = "CYCLES"
scene.cycles.samples = 24
scene.cycles.use_denoising = True
preferences = bpy.context.preferences.addons["cycles"].preferences
preferences.compute_device_type = "METAL"
preferences.get_devices()
for device in preferences.devices:
    device.use = device.type == "METAL"
scene.cycles.device = "GPU"
scene.render.resolution_x = scene.render.resolution_y = 320
scene.render.resolution_percentage = 100
scene.render.film_transparent = True
scene.render.image_settings.file_format = "PNG"
scene.render.image_settings.color_mode = "RGBA"
scene.render.fps = 24
scene.frame_start, scene.frame_end = 1, 48
scene.world = bpy.data.worlds.new("Transparent studio")
scene.world.use_nodes = True
scene.world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.8, 0.72, 0.6, 1)
scene.world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.35


def material(name, color, metallic):
    result = bpy.data.materials.new(name)
    result.diffuse_color = (*color, 1)
    result.use_nodes = True
    shader = result.node_tree.nodes["Principled BSDF"]
    shader.inputs["Base Color"].default_value = (*color, 1)
    shader.inputs["Metallic"].default_value = metallic
    shader.inputs["Roughness"].default_value = 0.28
    shader.inputs["Coat Weight"].default_value = 0.3
    return result


coral = material("Pecu coral ceramic", (0.88, 0.13, 0.065), 0.05)
gold = material("Pecu gold", (1.0, 0.61, 0.11), 0.55)
root = bpy.data.objects.new("Spinner rotation", None)
scene.collection.objects.link(root)
curve = bpy.data.curves.new("Rounded loading arc", "CURVE")
curve.dimensions = "3D"
curve.bevel_depth = 0.165
curve.bevel_resolution = 8
curve.use_fill_caps = True
path = curve.splines.new("POLY")
path.points.add(120)
angles = [math.radians(45 + 270 * i / 120) for i in range(121)]
for point, angle in zip(path.points, angles):
    point.co = (math.cos(angle), math.sin(angle), 0, 1)
arc = bpy.data.objects.new("Coral arc", curve)
scene.collection.objects.link(arc)
arc.data.materials.append(coral)
arc.parent = root
for index, angle in enumerate([angles[0], angles[-1]]):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=16, radius=0.165,
                                       location=(math.cos(angle), math.sin(angle), 0))
    cap = bpy.context.object
    cap.name = f"Rounded end {index}"
    cap.data.materials.append(coral)
    cap.parent = root
    for polygon in cap.data.polygons:
        polygon.use_smooth = True
bpy.ops.mesh.primitive_uv_sphere_add(segments=48, ring_count=24, radius=0.205, location=(1, 0, 0))
bead = bpy.context.object
bead.name = "Gold leading bead"
bead.data.materials.append(gold)
bead.parent = root
for polygon in bead.data.polygons:
    polygon.use_smooth = True
root.rotation_euler.z = 0
root.keyframe_insert(data_path="rotation_euler", frame=1)
root.rotation_euler.z = -2 * math.pi
root.keyframe_insert(data_path="rotation_euler", frame=49)
for layer in root.animation_data.action.layers:
    for strip in layer.strips:
        for channelbag in strip.channelbags:
            for fcurve in channelbag.fcurves:
                for key in fcurve.keyframe_points:
                    key.interpolation = "LINEAR"


def aim(obj, point=(0, 0, 0)):
    obj.rotation_euler = (Vector(point) - obj.location).to_track_quat("-Z", "Y").to_euler()


bpy.ops.object.camera_add(location=(0, -3.2, 7.5))
camera = bpy.context.object
camera.name = "Centered orthographic camera"
camera.data.type = "ORTHO"
camera.data.ortho_scale = 3.1
aim(camera)
scene.camera = camera
for name, position, energy, size in [
    ("Large soft key", (-3, -4, 6), 450, 4),
    ("Warm fill", (4, 0, 3), 260, 3),
    ("Rim", (0, 4, 5), 500, 3),
]:
    bpy.ops.object.light_add(type="AREA", location=position)
    light = bpy.context.object
    light.name = name
    light.data.energy, light.data.shape, light.data.size = energy, "DISK", size
    aim(light)
scene.frame_set(1)
bpy.ops.wm.save_as_mainfile(filepath=str(args.output / "conversation-loader.blend"))
for frame in ([1] if args.preview else range(1, 49)):
    scene.frame_set(frame)
    scene.render.filepath = str(args.output / f"{frame:04}.png")
    bpy.ops.render.render(write_still=True)
    print(f"LOADER_FRAME {frame}/48", flush=True)
