"""Build the editable voxel honey vessel and its runtime GLB in Blender.

blender --background --factory-startup --python tools/bee-3d/build_hive.py
"""

from pathlib import Path
import json
import math

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "assets/hive-3d"
OUT.mkdir(parents=True, exist_ok=True)
UNIT = 0.14
PALETTE = {
    "Ink": "#24100E",
    "Edge": "#3F1E19",
    "Brown": "#67342B",
    "Wood": "#B95416",
    "Amber": "#E8892B",
    "Orange": "#FB9E3E",
    "Light": "#FFB24D",
    "Wax": "#FFD277",
    "Honey": "#EAA014",
    "HoneyTop": "#FFC33D",
    "HoneyGlint": "#FFE28C",
}

bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)
materials = {}
for name, color in PALETTE.items():
    rgb = [int(color[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    linear = [v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4 for v in rgb]
    material = bpy.data.materials.new(name)
    material.diffuse_color = (*linear, 1)
    material.use_nodes = True
    bsdf = material.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*linear, 1)
    bsdf.inputs["Roughness"].default_value = 0.72
    materials[name] = material

shell = []


def box(name, low, high, color, collect=True):
    low, high = Vector(low) * UNIT, Vector(high) * UNIT
    bpy.ops.mesh.primitive_cube_add(size=1, location=(low + high) / 2)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = high - low
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(materials[color])
    if collect:
        shell.append(obj)
    return obj


def voxel(name, x, y, z, color):
    return box(name, (x, y, z), (x + 1, y + 1, z + 1), color)


# A stepped footprint, four feet, and a deep open chamber. Every detail sits
# on Bee's voxel grid; the dark border is physical geometry on every side.
for x in (-9, 6):
    for y in (-8, 5):
        box("Foot", (x, y, 0), (x + 3, y + 3, 1), "Ink")
        box("FootCap", (x, y, 1), (x + 3, y + 3, 2), "Brown")
box("BaseEdge", (-10, -9, 2), (10, 9, 4), "Ink")
box("BasePlinth", (-11, -8, 3), (11, 8, 4), "Edge")
box("BasePlinth", (-9, -10, 3), (9, 10, 4), "Edge")
box("Base", (-9, -8, 4), (9, 8, 5), "Amber")
box("ChamberFloor", (-7, -7, 4), (7, 7, 5.03), "Wood")

# Back and side plank walls, ink seams and staggered pixel grain.
for row in range(4):
    bottom = 5 + row * 4
    box("BackSeam", (-9, 7, bottom), (9, 9, bottom + 1), "Ink")
    box("BackPlank", (-9, 7, bottom + 1), (9, 9, bottom + 4), "Amber" if row % 2 else "Orange")
    for side in (-1, 1):
        left = -10 if side < 0 else 8
        box("SideSeam", (left, -6, bottom), (left + 2, 9, bottom + 1), "Ink")
        box("SidePlank", (left, -6, bottom + 1), (left + 2, 9, bottom + 4), "Orange" if row % 2 else "Amber")
        for index in range(6):
            y = -7 + index * 2.5
            z = bottom + 1 + ((index + row) % 2)
            outer = -10.06 if side < 0 else 9.96
            box("SideGrain", (outer, y, z), (outer + .1, y + 1.5, z + .5), "Light" if index % 3 else "Wood")
    for index in range(7):
        x = -8 + index * 2.4
        box("BackGrain", (x, 8.98, bottom + 2), (x + 1.5, 9.06, bottom + 2.6), "Light" if index % 3 else "Wood")

# Front window frame. The empty opening exposes the actual honey mesh.
for x in (-10, 7):
    box("WindowPostEdge", (x, -9, 4), (x + 3, -6, 22), "Ink")
    box("WindowPost", (x + .65, -9.12, 5), (x + 2.35, -8.95, 21), "Orange")
    for z in (6, 11, 16):
        box("PostHighlight", (x + .65, -9.15, z), (x + 1.25, -9.1, z + 3), "Light")
box("WindowSillEdge", (-9, -10, 4), (9, -6, 6), "Ink")
box("WindowSill", (-8, -10.1, 5), (8, -8, 6.04), "Light")
box("WindowHeaderEdge", (-10, -9, 20), (10, -6, 23), "Ink")
box("WindowHeader", (-8, -9.1, 20.7), (8, -8.95, 22.25), "Orange")

# Squared open rim with stepped outer corners and a visible interior lip.
for low, high in [((-10, -9, 22), (10, -6, 24)), ((-10, 6, 22), (10, 9, 24)),
                  ((-10, -6, 22), (-7, 6, 24)), ((7, -6, 22), (10, 6, 24))]:
    box("RimOutline", low, high, "Ink")
for low, high in [((-9, -9.15, 24.03), (9, -6.3, 24.35)), ((-9, 6.3, 24.03), (9, 8.7, 24.35)),
                  ((-9.7, -6, 24.03), (-7.3, 6, 24.35)), ((7.3, -6, 24.03), (9.7, 6, 24.35))]:
    box("RimWax", low, high, "Light")
for x in range(-8, 9, 3):
    box("RimPixel", (x, -9.2, 23), (x + 1, -6.3, 24.38), "Wax")

# Honey drips are small stepped meshes, not a texture painted on the box.
for x, length in [(-5, 2), (-4, 3), (5, 1)]:
    box("HoneyDrip", (x, -9.3, 23 - length), (x + 1, -9.08, 23.3), "HoneyTop")

# Pixel honeycomb medallions on both side walls.
hex_map = ["..####..", ".##oo##.", "##oooo##", "#oo##oo#", "#oo##oo#", "##oooo##", ".##oo##.", "..####.."]
for side in (-1, 1):
    for row, pixels in enumerate(hex_map):
        for col, pixel in enumerate(pixels):
            if pixel == ".":
                continue
            x = -10.55 if side < 0 else 10
            box("CombMedallion", (x, col - 3.5, 16 - row), (x + .55, col - 2.5, 17 - row), "Edge" if pixel == "#" else "Wax")

# A tiny bee entrance and landing ledge on the rear make the rotated model
# a complete beehive, rather than the back of a flat illustration.
box("BeeEntrance", (-3, 9.03, 7), (3, 9.12, 9), "Ink")
box("LandingBoard", (-4, 9, 6), (4, 11, 6.8), "Brown")
box("LandingBoardTop", (-4, 9, 6.8), (4, 11, 7), "Light")

bpy.ops.object.select_all(action="DESELECT")
for obj in shell:
    obj.select_set(True)
bpy.context.view_layer.objects.active = shell[0]
bpy.ops.object.join()
structure = bpy.context.object
structure.name = "Hive_Shell"

honey = box("Honey_Fill", (-6.9, -6.8, 5), (6.9, 6.8, 20), "Honey", collect=False)
bpy.context.scene.cursor.location = (0, 0, 5 * UNIT)
bpy.context.view_layer.objects.active = honey
bpy.ops.object.origin_set(type="ORIGIN_CURSOR")
honey["capacity"] = 100
honey["fillHeight"] = 15 * UNIT
honey["baseHeight"] = 5 * UNIT
honey["description"] = "Scale local Z from 0 to 1 for the live honey balance. glTF converts Z to Y."
surface = box("Honey_Surface", (-6.9, -6.8, 19.92), (6.9, 6.8, 20.03), "HoneyTop", collect=False)
glints = []
for x, y, width in [(-5, -5, 3), (2, 1, 2), (-2, 4, 1)]:
    glints.append(box("HoneyPixel", (x, y, 20.04), (x + width, y + 1, 20.08), "HoneyGlint", collect=False))
bpy.ops.object.select_all(action="DESELECT")
surface.select_set(True)
for obj in glints:
    obj.select_set(True)
bpy.context.view_layer.objects.active = surface
bpy.ops.object.join()
surface.name = "Honey_Surface"
bpy.context.scene.cursor.location = (0, 0, 20 * UNIT)
bpy.ops.object.origin_set(type="ORIGIN_CURSOR")

root = bpy.data.objects.new("Hive_Root", None)
bpy.context.collection.objects.link(root)
for obj in (structure, honey, surface):
    obj.parent = root

bpy.ops.object.select_all(action="DESELECT")
for obj in (root, structure, honey, surface):
    obj.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(OUT / "hive.glb"), export_format="GLB", use_selection=True, export_extras=True, export_yup=True)

scene = bpy.context.scene
scene.render.engine = "CYCLES"
scene.cycles.samples = 32
scene.cycles.use_denoising = True
scene.render.resolution_x = 960
scene.render.resolution_y = 960
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
scene.render.image_settings.color_mode = "RGBA"
scene.render.film_transparent = True
scene.view_settings.view_transform = "Standard"
scene.world.use_nodes = True
scene.world.node_tree.nodes.get("Background").inputs["Strength"].default_value = .55

def point_at(obj, target):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat("-Z", "Y").to_euler()

bpy.ops.object.camera_add(location=(5.5, -9, 6.5))
camera = bpy.context.object
camera.name = "Preview_Camera"
camera.data.type = "ORTHO"
camera.data.ortho_scale = 5.0
point_at(camera, (0, 0, 1.7))
scene.camera = camera
for name, location, power, size in [("Key", (-4, -6, 8), 700, 5), ("Fill", (5, -1, 5), 450, 4), ("Rim", (0, 5, 7), 550, 3)]:
    bpy.ops.object.light_add(type="AREA", location=location)
    lamp = bpy.context.object
    lamp.name = name
    lamp.data.energy = power
    lamp.data.shape = "DISK"
    lamp.data.size = size
    point_at(lamp, (0, 0, 1.7))

def fill(ratio):
    honey.scale.z = max(.001, ratio)
    surface.location.z = (5 + 15 * ratio) * UNIT
    honey.hide_render = surface.hide_render = ratio <= 0

fill(.45)
bpy.ops.wm.save_as_mainfile(filepath=str(OUT / "hive.blend"))
for name, ratio in [("hive-empty", 0), ("hive-preview", .45), ("hive-full", 1)]:
    fill(ratio)
    scene.render.filepath = str(OUT / f"{name}.png")
    bpy.ops.render.render(write_still=True)
scene.render.resolution_x = scene.render.resolution_y = 320
fill(0)
scene.render.filepath = str(OUT / "hive-fallback.png")
bpy.ops.render.render(write_still=True)
scene.render.resolution_x = scene.render.resolution_y = 960
fill(.45)
camera.location = (-5.5, 9, 6.5)
point_at(camera, (0, 0, 1.7))
scene.render.filepath = str(OUT / "hive-rear.png")
bpy.ops.render.render(write_still=True)
summary = {"palette": PALETTE, "voxelSize": UNIT, "capacity": 100, "fillBase": 5 * UNIT, "fillHeight": 15 * UNIT, "meshObjects": 3, "vertices": sum(len(obj.data.vertices) for obj in (structure, honey, surface))}
(OUT / "manifest.json").write_text(json.dumps(summary, indent=2) + "\n")
print(json.dumps(summary))
