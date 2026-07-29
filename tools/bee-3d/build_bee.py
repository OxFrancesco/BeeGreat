"""Build BeeGreat's canonical voxel Bee as an animated Blender/GLB asset.

Run from the repository root:

    blender --background --factory-startup --python tools/bee-3d/build_bee.py

The script constructs Bee from a true voxel grid driven by ASCII pixel maps,
so every surface (face, stripes, wings) reproduces the canonical pixel art at
1 voxel = 1 pixel fidelity. Materials stay palette-based: no generated
textures, fully deterministic, and editable.
"""

from __future__ import annotations

import math
import os
import sys
from pathlib import Path

import bpy
from mathutils import Vector


REPO_ROOT = Path(__file__).resolve().parents[2]
ASSET_DIR = REPO_ROOT / "assets" / "bee-3d"
PREVIEW_DIR = ASSET_DIR / "previews"
FRAME_DIR = PREVIEW_DIR / "turntable-frames"
BLEND_PATH = ASSET_DIR / "bee.blend"
GLB_PATH = ASSET_DIR / "bee.glb"

FPS = 24

PALETTE = {
    "Ink": "#07090E",
    "InkSoft": "#161824",
    "InkHighlight": "#313142",
    "Orange": "#FB9E3E",
    "OrangeLight": "#FFB24D",
    "OrangeShadow": "#E8892B",
    "OrangeDeep": "#B95416",
    "Stripe": "#24100E",
    "Brown": "#3F1E19",
    "BrownLight": "#67342B",
    "White": "#F8FCFF",
    "WingGrey": "#D5DEE7",
    "WingShadow": "#96A5B4",
    "WingTan": "#C9A87A",
    "Blush": "#FF806C",
    "Backdrop": "#F2E9DC",
    "Floor": "#E4D5C2",
}

ROOT_NAME = "Bee_Root"

# One voxel = one pixel of the canonical art.
VOXEL = 0.32

# Body grid: 16 wide (x), 18 deep (y, front at iy=0), 13 tall (z).
BODY_W, BODY_D, BODY_H = 16, 18, 13

CHAR_MATERIALS = {
    "#": "Ink",
    "O": "Orange",
    "o": "OrangeLight",
    "s": "OrangeShadow",
    "W": "White",
    "G": "WingGrey",
    "S": "WingShadow",
    "T": "WingTan",
    "v": "InkHighlight",
    "B": "Blush",
    "b": "Brown",
    "L": "BrownLight",
}

# Front face, row 0 = top of the head. 16 x 13 pixels.
FACE_MAP = [
    "################",
    "#oooooooooooooo#",
    "#O###OOOOO###OO#",
    "##OOOOOOOOOOO###",
    "#O####OOOO####O#",
    "#O#W##OOOO#W##O#",
    "#O####OOOO####O#",
    "#O####OOOO####O#",
    "#O##v#OOOO##v#O#",
    "#OOOOO#OO#OOOOO#",
    "#BBOOOO##OOOOBB#",
    "#BBOOOOOOOOOOBB#",
    "################",
]

# Colour of the side walls per depth slice (front -> back).
SIDE_BANDS = [
    "Ink",
    "Orange", "Orange", "Orange", "Orange", "Orange",
    "Stripe", "Stripe",
    "OrangeShadow", "OrangeShadow",
    "Stripe", "Stripe",
    "OrangeShadow", "OrangeShadow",
    "Stripe",
    "BrownLight", "BrownLight",
    "Ink",
]

# Colour of the top plate per depth slice (front -> back). The brown patch
# right behind the head is the "collar" the antennae sit in.
TOP_BANDS = [
    "Ink",
    "OrangeLight",
    "BrownLight", "BrownLight",
    "OrangeLight", "OrangeLight",
    "Stripe", "Stripe",
    "OrangeShadow", "OrangeShadow",
    "Stripe", "Stripe",
    "BrownLight", "BrownLight",
    "Stripe",
    "BrownLight", "BrownLight",
    "Ink",
]

# Wings are flat voxel plates authored in plan view (rows front -> back,
# columns inner -> outer). "." leaves a genuine hole through the wing.
RIGHT_WING_MAP = [
    "..WWWWW...",
    ".WWSWWWW..",
    "WTSGWGSWWW",
    "WSTG.GWWWW",
    "WWGWWGWWW.",
    ".WWWWWW...",
]

LEFT_WING_MAP = [
    ".WWWW...",
    "WWSWWWW.",
    "WWG.GWWW",
    "WWWWGWW.",
    ".WWWW...",
]

# Expression overlays: thin voxel decals covering the face interior.
# "." is transparent (the baked neutral face shows through when no plate is
# active). Exactly one plate is scaled to 1 per animation segment.
FACE_PLATES = {
    "blink": [
        "................",
        ".oooooooooooooo.",
        ".O###OOOOO###OO.",
        ".#OOOOOOOOOOO##.",
        ".OOOOOOOOOOOOOO.",
        ".OOOOOOOOOOOOOO.",
        ".O####OOOO####O.",
        ".OOOOOOOOOOOOOO.",
        ".OOOOOOOOOOOOOO.",
        ".OOOOO#OO#OOOOO.",
        ".BBOOOO##OOOOBB.",
        ".BBOOOOOOOOOOBB.",
        "................",
    ],
    "happy": [
        "................",
        ".oooooooooooooo.",
        ".OOOOOOOOOOOOOO.",
        ".OOOOOOOOOOOOOO.",
        ".OO##OOOOOO##OO.",
        ".O#OO#OOOO#OO#O.",
        ".OOOOOOOOOOOOOO.",
        ".OOOOOOOOOOOOOO.",
        ".OOOO#OOOO#OOOO.",
        ".OOOOO####OOOOO.",
        ".BBOOOOOOOOOOBB.",
        ".BBOOOOOOOOOOBB.",
        "................",
    ],
    "sad": [
        "................",
        ".oooooooooooooo.",
        ".OOO##OOOO##OOO.",
        ".O##OOOOOOOO##O.",
        ".OOOOOOOOOOOOOO.",
        ".OOOOOOOOOOOOOO.",
        ".O####OOOO####O.",
        ".O####OOOO####O.",
        ".O##v#OOOO##v#O.",
        ".OGOOOO##OOOOOO.",
        ".BBOOO#OO#OOOBB.",
        ".BBOOOOOOOOOOBB.",
        "................",
    ],
    "focus": [
        "................",
        ".oooooooooooooo.",
        ".OOOOOOOOOOOOOG.",
        ".O####OOOO####G.",
        ".OOOOOOOOOOOOOO.",
        ".O####OOOO####O.",
        ".O#W##OOOO#W##O.",
        ".O####OOOO####O.",
        ".O##v#OOOO##v#O.",
        ".OOOOO####OOOOO.",
        ".BBOOOOOOOOOOBB.",
        ".BBOOOOOOOOOOBB.",
        "................",
    ],
    "curious": [
        "................",
        ".oooooooooooooo.",
        ".OO##OOOOOO##OO.",
        ".OOOOOOOOOOOOOO.",
        ".O####OOOO####O.",
        ".O#W##OOOO#W##O.",
        ".O####OOOO####O.",
        ".O####OOOO####O.",
        ".O##v#OOOO##v#O.",
        ".OOOOOO##OOOOOO.",
        ".BBOOOO##OOOOBB.",
        ".BBOOOOOOOOOOBB.",
        "................",
    ],
    "sleepy": [
        "................",
        ".oooooooooooooo.",
        ".OOOOOOOOOOOOOO.",
        ".OOOOOOOOOOOOOO.",
        ".OOOOOOOOOOOOOO.",
        ".OOOOOOOOOOOOOO.",
        ".O####OOOO####O.",
        ".O#OO#OOOO#OO#O.",
        ".OOOOOOOOOOOOOO.",
        ".OOOOOO##OOOOOO.",
        ".BBOOOOOOOOOOBB.",
        ".BBOOOOOOOOOOBB.",
        "................",
    ],
    "look_left": [
        "................",
        ".oooooooooooooo.",
        ".O###OOOOO###OO.",
        ".#OOOOOOOOOOO##.",
        ".O####OOOO####O.",
        ".OW###OOOOW###O.",
        ".O####OOOO####O.",
        ".O####OOOO####O.",
        ".O##v#OOOO##v#O.",
        ".OOOOO#OO#OOOOO.",
        ".BBOOOO##OOOOBB.",
        ".BBOOOOOOOOOOBB.",
        "................",
    ],
    "look_right": [
        "................",
        ".oooooooooooooo.",
        ".O###OOOOO###OO.",
        ".#OOOOOOOOOOO##.",
        ".O####OOOO####O.",
        ".O##W#OOOO##W#O.",
        ".O####OOOO####O.",
        ".O####OOOO####O.",
        ".O##v#OOOO##v#O.",
        ".OOOOO#OO#OOOOO.",
        ".BBOOOO##OOOOBB.",
        ".BBOOOOOOOOOOBB.",
        "................",
    ],
}

# Every clip is exactly 8 seconds: frames 1..193 at 24 fps.
END_FRAME = 193


def hex_rgba(value: str, alpha: float = 1.0) -> tuple[float, float, float, float]:
    value = value.removeprefix("#")

    def srgb_to_linear(channel: int) -> float:
        normalized = channel / 255
        if normalized <= 0.04045:
            return normalized / 12.92
        return ((normalized + 0.055) / 1.055) ** 2.4

    return (
        srgb_to_linear(int(value[0:2], 16)),
        srgb_to_linear(int(value[2:4], 16)),
        srgb_to_linear(int(value[4:6], 16)),
        alpha,
    )


def clean_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for datablocks in (
        bpy.data.actions,
        bpy.data.armatures,
        bpy.data.cameras,
        bpy.data.curves,
        bpy.data.lights,
        bpy.data.materials,
        bpy.data.meshes,
    ):
        for datablock in list(datablocks):
            datablocks.remove(datablock)


def make_material(
    name: str,
    color: str,
    *,
    roughness: float = 0.56,
    metallic: float = 0.0,
) -> bpy.types.Material:
    material = bpy.data.materials.new(name)
    material.diffuse_color = hex_rgba(color)
    material.use_nodes = True
    principled = material.node_tree.nodes.get("Principled BSDF")
    if principled:
        principled.inputs["Base Color"].default_value = hex_rgba(color)
        principled.inputs["Roughness"].default_value = roughness
        principled.inputs["Metallic"].default_value = metallic
    return material


def add_empty(
    name: str,
    location: tuple[float, float, float] = (0, 0, 0),
    parent: bpy.types.Object | None = None,
) -> bpy.types.Object:
    obj = bpy.data.objects.new(name, None)
    bpy.context.scene.collection.objects.link(obj)
    obj.empty_display_type = "CUBE"
    obj.empty_display_size = 0.18
    obj.location = location
    if parent:
        obj.parent = parent
    return obj


def voxel_origin(ix: float, iy: float, iz: float) -> tuple[float, float, float]:
    """Lower corner of voxel (ix, iy, iz) in world units, grid centred on X/Y."""
    return (
        (ix - BODY_W / 2) * VOXEL,
        (iy - BODY_D / 2) * VOXEL,
        (iz - (BODY_H - 0.5) / 2) * VOXEL,
    )


# Outward faces of a unit cube: (neighbour offset, four CCW corners).
_CUBE_FACES = (
    ((0, -1, 0), ((0, 0, 0), (1, 0, 0), (1, 0, 1), (0, 0, 1))),
    ((0, 1, 0), ((1, 1, 0), (0, 1, 0), (0, 1, 1), (1, 1, 1))),
    ((-1, 0, 0), ((0, 1, 0), (0, 0, 0), (0, 0, 1), (0, 1, 1))),
    ((1, 0, 0), ((1, 0, 0), (1, 1, 0), (1, 1, 1), (1, 0, 1))),
    ((0, 0, -1), ((0, 1, 0), (1, 1, 0), (1, 0, 0), (0, 0, 0))),
    ((0, 0, 1), ((0, 0, 1), (1, 0, 1), (1, 1, 1), (0, 1, 1))),
)


def add_voxel_object(
    name: str,
    voxels: dict[tuple[int, int, int], str],
    materials: dict[str, bpy.types.Material],
    parent: bpy.types.Object | None = None,
    offset: tuple[float, float, float] = (0.0, 0.0, 0.0),
) -> bpy.types.Object:
    """Build a single flat-shaded mesh from voxels, culling interior faces.

    Vertices are emitted relative to ``offset`` (the parent pivot's world
    location), so parenting needs no matrix fix-ups.
    """
    mesh = bpy.data.meshes.new(name)
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)

    material_slots: dict[str, int] = {}
    for material_name in sorted(set(voxels.values())):
        obj.data.materials.append(materials[material_name])
        material_slots[material_name] = len(obj.data.materials) - 1

    verts: list[tuple[float, float, float]] = []
    faces: list[tuple[int, int, int, int]] = []
    face_materials: list[int] = []
    for (ix, iy, iz), material_name in voxels.items():
        x0, y0, z0 = voxel_origin(ix, iy, iz)
        x0, y0, z0 = x0 - offset[0], y0 - offset[1], z0 - offset[2]
        for (dx, dy, dz), corners in _CUBE_FACES:
            if (ix + dx, iy + dy, iz + dz) in voxels:
                continue
            base = len(verts)
            verts.extend(
                (x0 + cx * VOXEL, y0 + cy * VOXEL, z0 + cz * VOXEL)
                for cx, cy, cz in corners
            )
            faces.append((base, base + 1, base + 2, base + 3))
            face_materials.append(material_slots[material_name])

    mesh.from_pydata(verts, [], faces)
    for polygon, material_index in zip(mesh.polygons, face_materials):
        polygon.material_index = material_index
        polygon.use_smooth = False
    mesh.validate()
    mesh.update()

    if parent:
        obj.parent = parent
    return obj


def add_box(
    name: str,
    location: tuple[float, float, float],
    scale: tuple[float, float, float],
    material: bpy.types.Material,
    *,
    bevel: float = 0.06,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cube_add(location=location)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(material)
    if bevel > 0:
        modifier = obj.modifiers.new(name="Pixel edge", type="BEVEL")
        modifier.width = bevel
        modifier.segments = 1
        modifier.limit_method = "ANGLE"
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.modifier_apply(modifier=modifier.name)
    for polygon in obj.data.polygons:
        polygon.use_smooth = False
    return obj


def body_voxels() -> dict[tuple[int, int, int], str]:
    voxels: dict[tuple[int, int, int], str] = {}
    for ix in range(BODY_W):
        for iy in range(BODY_D):
            for iz in range(BODY_H):
                on_x = ix in (0, BODY_W - 1)
                on_y = iy in (0, BODY_D - 1)
                on_z = iz in (0, BODY_H - 1)
                boundary_count = int(on_x) + int(on_y) + int(on_z)
                if boundary_count == 0:
                    continue
                if boundary_count >= 2:
                    # Box edges read as the 1px ink outline of the pixel art.
                    voxels[(ix, iy, iz)] = "Ink"
                    continue
                if iy == 0:
                    row = FACE_MAP[BODY_H - 1 - iz]
                    voxels[(ix, iy, iz)] = CHAR_MATERIALS[row[ix]]
                elif iz == BODY_H - 1:
                    voxels[(ix, iy, iz)] = TOP_BANDS[iy]
                elif iz == 0:
                    voxels[(ix, iy, iz)] = "Ink"
                elif on_x:
                    voxels[(ix, iy, iz)] = SIDE_BANDS[iy]
                else:  # rear wall
                    voxels[(ix, iy, iz)] = "Stripe"
    return voxels


def wing_voxels(
    wing_map: list[str],
    *,
    sign: float,
    inner_ix: int,
    front_iy: int,
    iz: int,
) -> dict[tuple[int, int, int], str]:
    voxels: dict[tuple[int, int, int], str] = {}
    for row_index, row in enumerate(wing_map):
        for col_index, char in enumerate(row):
            if char == ".":
                continue
            ix = inner_ix + int(sign) * col_index
            voxels[(ix, front_iy + row_index, iz)] = CHAR_MATERIALS[char]
    return voxels


def add_wing(
    side: str,
    sign: float,
    root: bpy.types.Object,
    materials: dict[str, bpy.types.Material],
) -> bpy.types.Object:
    if sign > 0:
        # Positive yaw sweeps the far wing back, matching the reference.
        wing_map, inner_ix, front_iy = RIGHT_WING_MAP, 13, 5
        yaw, tilt = 10.0, -8.0
    else:
        # The near wing sweeps forward over the head in the reference.
        wing_map, inner_ix, front_iy = LEFT_WING_MAP, 2, 5
        yaw, tilt = 10.0, 8.0

    pivot_location = voxel_origin(
        inner_ix + 0.5,
        front_iy + len(wing_map) / 2,
        BODY_H,
    )
    pivot = add_empty(f"Wing_{side}", pivot_location, root)

    voxels = wing_voxels(
        wing_map, sign=sign, inner_ix=inner_ix, front_iy=front_iy, iz=BODY_H
    )
    add_voxel_object(
        f"Wing_{side}_Plate", voxels, materials,
        parent=pivot, offset=pivot_location,
    )

    pivot.rotation_euler = (0, math.radians(tilt), math.radians(yaw))
    return pivot


def add_antenna(
    side: str,
    sign: float,
    root: bpy.types.Object,
    materials: dict[str, bpy.types.Material],
) -> bpy.types.Object:
    if sign < 0:
        stem_ix, stem_iy, stem_height = 4, 2, 3
        bend_ix = stem_ix - 1
    else:
        stem_ix, stem_iy, stem_height = 10, 3, 4
        bend_ix = stem_ix + 1

    top = BODY_H  # first voxel layer above the body
    voxels: dict[tuple[int, int, int], str] = {}
    for step in range(stem_height):
        voxels[(stem_ix, stem_iy, top + step)] = "Ink"
    bend_z = top + stem_height - 1
    voxels[(bend_ix, stem_iy, bend_z)] = "Ink"
    voxels[(bend_ix, stem_iy, bend_z + 1)] = "Ink"

    tip_ix = bend_ix if sign > 0 else bend_ix - 1
    for dx in range(2):
        for dy in range(2):
            for dz in range(2):
                voxels[(tip_ix + dx, stem_iy - 1 + dy, bend_z + 2 + dz)] = "Ink"
    highlight = (tip_ix if sign < 0 else tip_ix + 1, stem_iy - 1, bend_z + 2)
    voxels[highlight] = "InkHighlight"

    pivot_location = voxel_origin(stem_ix + 0.5, stem_iy + 0.5, top)
    pivot = add_empty(f"Antenna_{side}", pivot_location, root)
    add_voxel_object(
        f"Antenna_{side}_Voxels", voxels, materials,
        parent=pivot, offset=pivot_location,
    )
    return pivot


def add_leg(
    side: str,
    row: int,
    sign: float,
    iy: int,
    length: int,
    root: bpy.types.Object,
    materials: dict[str, bpy.types.Material],
) -> bpy.types.Object:
    inner_ix = 2 if sign < 0 else 12
    voxels: dict[tuple[int, int, int], str] = {}
    for dx in range(2):
        voxels[(inner_ix + dx, iy, -1)] = "Brown"
        for depth in range(1, length):
            material = "Ink" if depth == length - 1 else "InkSoft"
            voxels[(inner_ix + dx, iy, -1 - depth)] = material

    pivot_location = voxel_origin(inner_ix + 1.0, iy + 0.5, 0)
    pivot = add_empty(f"Leg_{side}_{row}", pivot_location, root)
    add_voxel_object(
        f"Leg_{side}_{row}_Voxels", voxels, materials,
        parent=pivot, offset=pivot_location,
    )
    return pivot


def add_face_plate(
    name: str,
    face_map: list[str],
    materials: dict[str, bpy.types.Material],
    root: bpy.types.Object,
) -> bpy.types.Object:
    """Thin voxel decal hovering just in front of the face.

    The plate rests at scale 0 (invisible); animation clips scale it to 1 to
    swap Bee's expression.
    """
    gap = 0.012
    thickness = VOXEL * 0.2
    plate_y = -(BODY_D / 2) * VOXEL - gap - thickness / 2
    plate_z = ((0 - (BODY_H - 0.5) / 2) * VOXEL + (BODY_H - (BODY_H - 0.5) / 2) * VOXEL) / 2

    cells: dict[tuple[int, int], str] = {}
    for row_index, row in enumerate(face_map):
        for col_index, char in enumerate(row):
            if char != ".":
                cells[(col_index, BODY_H - 1 - row_index)] = CHAR_MATERIALS[char]

    mesh = bpy.data.meshes.new(name)
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)

    material_slots: dict[str, int] = {}
    for material_name in sorted(set(cells.values())):
        obj.data.materials.append(materials[material_name])
        material_slots[material_name] = len(obj.data.materials) - 1

    half = thickness / 2
    verts: list[tuple[float, float, float]] = []
    faces: list[tuple[int, int, int, int]] = []
    face_materials: list[int] = []
    for (ix, iz), material_name in cells.items():
        x0 = (ix - BODY_W / 2) * VOXEL
        z0 = (iz - (BODY_H - 0.5) / 2) * VOXEL - plate_z
        for (dx, dy, dz), corners in _CUBE_FACES:
            if dy == 1:
                continue  # back face sits against the body
            if dy == 0 and (ix + dx, iz + dz) in cells:
                continue
            base = len(verts)
            verts.extend(
                (
                    x0 + cx * VOXEL,
                    -half + cy * thickness,
                    z0 + cz * VOXEL,
                )
                for cx, cy, cz in corners
            )
            faces.append((base, base + 1, base + 2, base + 3))
            face_materials.append(material_slots[material_name])

    mesh.from_pydata(verts, [], faces)
    for polygon, material_index in zip(mesh.polygons, face_materials):
        polygon.material_index = material_index
        polygon.use_smooth = False
    mesh.validate()
    mesh.update()

    obj.location = (0.0, plate_y, plate_z)
    obj.scale = (0.0, 0.0, 0.0)
    obj.parent = root
    return obj


def add_zzz(
    root: bpy.types.Object,
    materials: dict[str, bpy.types.Material],
) -> bpy.types.Object:
    """Floating pixel "Zz" used by the sleeping clip (rest scale 0)."""
    voxels: dict[tuple[int, int, int], str] = {}

    def z_glyph(ix0: int, iz0: int, size: int) -> None:
        for dx in range(size):
            voxels[(ix0 + dx, 3, iz0)] = "InkSoft"
            voxels[(ix0 + dx, 3, iz0 + size - 1)] = "InkSoft"
        for step in range(1, size - 1):
            voxels[(ix0 + size - 1 - step, 3, iz0 + step)] = "InkSoft"

    z_glyph(11, 15, 3)
    z_glyph(14, 19, 4)

    pivot_location = voxel_origin(14.0, 3.5, 18.0)
    obj = add_voxel_object(
        "Sleep_Zzz", voxels, materials, parent=root, offset=pivot_location
    )
    obj.location = pivot_location
    obj.scale = (0.0, 0.0, 0.0)
    return obj


def add_stinger(
    root: bpy.types.Object,
    materials: dict[str, bpy.types.Material],
) -> bpy.types.Object:
    voxels: dict[tuple[int, int, int], str] = {}
    for ix in (7, 8):
        for iz in (3, 4):
            voxels[(ix, BODY_D, iz)] = "Brown"
    for ix in (7, 8):
        voxels[(ix, BODY_D + 1, 3)] = "Ink"

    pivot_location = voxel_origin(8.0, BODY_D, 4.0)
    pivot = add_empty("Stinger", pivot_location, root)
    add_voxel_object(
        "Stinger_Voxels", voxels, materials,
        parent=pivot, offset=pivot_location,
    )
    return pivot


def build_bee(materials: dict[str, bpy.types.Material]) -> dict[str, bpy.types.Object]:
    root = add_empty(ROOT_NAME)

    add_voxel_object("Body_Voxels", body_voxels(), materials, parent=root)

    antenna_left = add_antenna("Left", -1.0, root, materials)
    antenna_right = add_antenna("Right", 1.0, root, materials)
    wing_left = add_wing("Left", -1.0, root, materials)
    wing_right = add_wing("Right", 1.0, root, materials)

    legs: list[bpy.types.Object] = []
    for row, (iy, length) in enumerate(((5, 3), (9, 3), (13, 3)), start=1):
        legs.append(add_leg("Left", row, -1.0, iy, length, root, materials))
        legs.append(add_leg("Right", row, 1.0, iy, length, root, materials))

    stinger = add_stinger(root, materials)

    faces = {
        name: add_face_plate(f"Face_{name}", face_map, materials, root)
        for name, face_map in FACE_PLATES.items()
    }
    faces["zzz"] = add_zzz(root, materials)

    return {
        "root": root,
        "wing_left": wing_left,
        "wing_right": wing_right,
        "antenna_left": antenna_left,
        "antenna_right": antenna_right,
        "stinger": stinger,
        "legs": legs,
        "faces": faces,
    }


def _action_fcurves(action: bpy.types.Action) -> list[bpy.types.FCurve]:
    try:
        return list(action.fcurves)
    except AttributeError:
        curves: list[bpy.types.FCurve] = []
        for layer in action.layers:
            for strip in layer.strips:
                for channelbag in strip.channelbags:
                    curves.extend(channelbag.fcurves)
        return curves


def add_action(
    obj: bpy.types.Object,
    clip_name: str,
    keyframes: list[dict[str, object]],
    *,
    interpolation: str | None = None,
) -> None:
    action = bpy.data.actions.new(name=f"{clip_name}.{obj.name}")
    action.use_frame_range = True
    action.frame_start = min(int(key["frame"]) for key in keyframes)
    action.frame_end = max(int(key["frame"]) for key in keyframes)

    animation_data = obj.animation_data_create()
    animation_data.action = action
    for keyframe in keyframes:
        frame = int(keyframe["frame"])
        if "location" in keyframe:
            obj.location = keyframe["location"]
            obj.keyframe_insert(data_path="location", frame=frame)
        if "rotation" in keyframe:
            obj.rotation_euler = keyframe["rotation"]
            obj.keyframe_insert(data_path="rotation_euler", frame=frame)
        if "scale" in keyframe:
            obj.scale = keyframe["scale"]
            obj.keyframe_insert(data_path="scale", frame=frame)

    if interpolation:
        for fcurve in _action_fcurves(action):
            for point in fcurve.keyframe_points:
                point.interpolation = interpolation

    animation_data.action = None
    track = animation_data.nla_tracks.new()
    track.name = clip_name
    track.strips.new(clip_name, int(action.frame_start), action)


def visibility_keys(spans: list[tuple[int, int]]) -> list[tuple[int, float]]:
    """Constant-interpolated 0/1 scale keys for an expression plate."""
    keys = {1: 0.0, END_FRAME: 0.0}
    for start, end in spans:
        keys[max(start, 1)] = 1.0
        if end < END_FRAME:
            keys[end] = 0.0
        else:
            keys[END_FRAME] = 1.0
    return sorted(keys.items())


def flutter(period: int, low: float, high: float) -> list[tuple[int, float]]:
    """Alternating wing keys covering the full 8-second clip."""
    keys: list[tuple[int, float]] = []
    frame, up = 1, False
    while frame <= END_FRAME:
        keys.append((frame, high if up else low))
        up = not up
        frame += period
    if keys[-1][0] != END_FRAME:
        keys.append((END_FRAME, keys[0][1]))
    return keys


def add_clip_bundle(
    rig: dict[str, bpy.types.Object],
    clip_name: str,
    root_keys: list[dict[str, object]],
    wing_angles: list[tuple[int, float]],
    antenna_angles: list[tuple[int, float]] | None = None,
    face_segments: list[tuple[int, int, str]] | None = None,
) -> None:
    add_action(rig["root"], clip_name, root_keys)

    for side, wing_key in ((-1.0, "wing_left"), (1.0, "wing_right")):
        wing = rig[wing_key]
        base = wing.rotation_euler[:]
        wing_keys = [
            {
                "frame": frame,
                "rotation": (
                    base[0] + math.radians(side * angle),
                    base[1] + math.radians(side * angle * 0.24),
                    base[2] + math.radians(side * 2),
                ),
            }
            for frame, angle in wing_angles
        ]
        add_action(wing, clip_name, wing_keys)

    if antenna_angles:
        for side, antenna_key in (
            (-1.0, "antenna_left"),
            (1.0, "antenna_right"),
        ):
            antenna = rig[antenna_key]
            add_action(
                antenna,
                clip_name,
                [
                    {
                        "frame": frame,
                        "rotation": (
                            0,
                            math.radians(side * angle),
                            math.radians(side * angle * 0.35),
                        ),
                    }
                    for frame, angle in antenna_angles
                ],
            )

    # Every plate is keyed in every clip so switching clips always resets the
    # expression, even in runtimes that keep the last sampled pose around.
    segments = face_segments or []
    for plate_name, plate in rig["faces"].items():
        spans = [(s, e) for s, e, name in segments if name == plate_name]
        add_action(
            plate,
            clip_name,
            [
                {"frame": frame, "scale": (value, value, value)}
                for frame, value in visibility_keys(spans)
            ],
            interpolation="CONSTANT",
        )


def add_animations(rig: dict[str, bpy.types.Object]) -> None:
    root = rig["root"]
    base = tuple(root.location)
    wing_rest = {
        key: rig[key].rotation_euler[:] for key in ("wing_left", "wing_right")
    }
    deg = math.radians

    # idle: gentle two-breath hover with a couple of blinks.
    add_clip_bundle(
        rig,
        "idle",
        [
            {"frame": 1, "location": base, "rotation": (0, 0, deg(-1.5))},
            {"frame": 49, "location": (0, 0, 0.18), "rotation": (0, deg(1.2), deg(1.5))},
            {"frame": 97, "location": base, "rotation": (0, 0, deg(-1.5))},
            {"frame": 145, "location": (0, 0, 0.18), "rotation": (0, deg(1.2), deg(1.5))},
            {"frame": END_FRAME, "location": base, "rotation": (0, 0, deg(-1.5))},
        ],
        flutter(6, -8, 12),
        [(1, -2), (49, 3), (97, -2), (145, 3), (END_FRAME, -2)],
        [(70, 76, "blink"), (150, 156, "blink")],
    )

    # listening: leans in, antennae perked, curious face.
    add_clip_bundle(
        rig,
        "listening",
        [
            {"frame": 1, "location": base, "rotation": (0, 0, 0)},
            {"frame": 25, "location": (0, -0.10, 0.10), "rotation": (deg(-3), deg(-2), deg(7))},
            {"frame": 73, "location": (0, -0.12, 0.13), "rotation": (deg(-4), deg(2), deg(5))},
            {"frame": 121, "location": (0, -0.10, 0.10), "rotation": (deg(-3), deg(-2), deg(-5))},
            {"frame": 161, "location": (0, -0.11, 0.12), "rotation": (deg(-4), deg(1), deg(6))},
            {"frame": END_FRAME, "location": base, "rotation": (0, 0, 0)},
        ],
        flutter(8, -5, 7),
        [(1, 0), (25, 8), (73, -5), (121, 7), (161, -4), (END_FRAME, 0)],
        [(1, 100, "curious"), (100, 106, "blink"), (106, END_FRAME + 1, "curious")],
    )

    # working: fast buzz, bobbing with determined focus face.
    working_root = []
    for cycle in range(9):
        frame = 1 + cycle * 24
        working_root.append(
            {"frame": frame, "location": base, "rotation": (0, 0, deg(-2))}
        )
        if frame + 12 <= END_FRAME:
            working_root.append(
                {
                    "frame": frame + 12,
                    "location": (0, 0, 0.20),
                    "rotation": (deg(-2), deg(2), deg(2)),
                }
            )
    add_clip_bundle(
        rig,
        "working",
        working_root,
        flutter(3, -18, 23),
        [(1 + i * 24, -4 if i % 2 == 0 else 5) for i in range(9)],
        [(1, END_FRAME + 1, "focus")],
    )

    # waiting: slow sway, glancing left and right, one blink.
    add_clip_bundle(
        rig,
        "waiting",
        [
            {"frame": 1, "location": base, "rotation": (0, 0, 0)},
            {"frame": 49, "location": (0, 0.02, -0.06), "rotation": (deg(2), deg(-3), deg(3))},
            {"frame": 97, "location": base, "rotation": (0, 0, 0)},
            {"frame": 145, "location": (0, -0.02, -0.03), "rotation": (deg(1), deg(3), deg(-3))},
            {"frame": END_FRAME, "location": base, "rotation": (0, 0, 0)},
        ],
        flutter(10, -4, 6),
        [(1, 0), (49, -7), (97, 0), (145, 7), (END_FRAME, 0)],
        [(30, 85, "look_left"), (110, 165, "look_right"), (170, 176, "blink")],
    )

    # success: crouch, spinning jump, second hop, happy wiggle.
    add_clip_bundle(
        rig,
        "success",
        [
            {"frame": 1, "location": base, "rotation": (0, 0, 0), "scale": (1, 1, 1)},
            {"frame": 9, "location": (0, 0, -0.15), "rotation": (0, 0, deg(-5)), "scale": (1.05, 1.05, 0.94)},
            {"frame": 21, "location": (0, 0, 0.85), "rotation": (0, deg(180), deg(4)), "scale": (0.98, 0.98, 1.05)},
            {"frame": 33, "location": (0, 0, 0.12), "rotation": (0, deg(360), deg(-2)), "scale": (1.02, 1.02, 0.97)},
            {"frame": 43, "location": base, "rotation": (0, deg(360), 0), "scale": (1, 1, 1)},
            {"frame": 57, "location": (0, 0, -0.08), "rotation": (0, deg(360), deg(3)), "scale": (1.04, 1.04, 0.95)},
            {"frame": 69, "location": (0, 0, 0.45), "rotation": (0, deg(360), deg(-3)), "scale": (1, 1, 1)},
            {"frame": 81, "location": base, "rotation": (0, deg(360), 0), "scale": (1, 1, 1)},
            {"frame": 105, "location": (0, 0, 0.08), "rotation": (0, deg(360), deg(5)), "scale": (1, 1, 1)},
            {"frame": 129, "location": (0, 0, 0.08), "rotation": (0, deg(360), deg(-5)), "scale": (1, 1, 1)},
            {"frame": 153, "location": (0, 0, 0.06), "rotation": (0, deg(360), deg(4)), "scale": (1, 1, 1)},
            {"frame": END_FRAME, "location": base, "rotation": (0, deg(360), 0), "scale": (1, 1, 1)},
        ],
        flutter(3, -20, 25),
        [(1, 0), (9, 8), (21, -8), (33, 6), (43, 0), (69, -6), (81, 0), (129, 5), (END_FRAME, 0)],
        [(1, END_FRAME + 1, "happy")],
    )

    # failure: droop low, dejected sway, slow recovery.
    add_clip_bundle(
        rig,
        "failure",
        [
            {"frame": 1, "location": base, "rotation": (0, 0, 0)},
            {"frame": 25, "location": (0, 0.06, -0.22), "rotation": (deg(5), deg(-2), deg(-6))},
            {"frame": 57, "location": (0, 0.08, -0.28), "rotation": (deg(7), deg(2), deg(5))},
            {"frame": 89, "location": (0, 0.07, -0.26), "rotation": (deg(6), deg(-1), deg(-4))},
            {"frame": 121, "location": (0, 0.08, -0.28), "rotation": (deg(7), deg(1), deg(3))},
            {"frame": 153, "location": (0, 0.03, -0.18), "rotation": (deg(4), 0, deg(-2))},
            {"frame": END_FRAME, "location": base, "rotation": (0, 0, 0)},
        ],
        flutter(14, -14, -2),
        [(1, 0), (25, -12), (57, -15), (121, -13), (163, -6), (END_FRAME, 0)],
        [(1, END_FRAME + 1, "sad")],
    )

    # sleeping: settled low, slow breathing, drooped wings, floating Zz.
    add_clip_bundle(
        rig,
        "sleeping",
        [
            {"frame": 1, "location": (0, 0, -0.30), "rotation": (deg(2), 0, deg(-2)), "scale": (1, 1, 1)},
            {"frame": 49, "location": (0, 0, -0.26), "rotation": (deg(1), 0, deg(-2)), "scale": (1.0, 1.0, 1.04)},
            {"frame": 97, "location": (0, 0, -0.30), "rotation": (deg(2), 0, deg(-2)), "scale": (1, 1, 1)},
            {"frame": 145, "location": (0, 0, -0.26), "rotation": (deg(1), 0, deg(-2)), "scale": (1.0, 1.0, 1.04)},
            {"frame": END_FRAME, "location": (0, 0, -0.30), "rotation": (deg(2), 0, deg(-2)), "scale": (1, 1, 1)},
        ],
        [(1, -3), (97, -1), (END_FRAME, -3)],
        [(1, -10), (97, -14), (END_FRAME, -10)],
        [(1, END_FRAME + 1, "sleepy"), (1, END_FRAME + 1, "zzz")],
    )

    # Restore the neutral pose for still renders and authoring.
    bpy.context.scene.frame_set(0)
    root.location = base
    root.rotation_euler = (0, 0, 0)
    root.scale = (1, 1, 1)
    for key, rest in wing_rest.items():
        rig[key].rotation_euler = rest
    for key in ("antenna_left", "antenna_right"):
        rig[key].rotation_euler = (0, 0, 0)
    for plate in rig["faces"].values():
        plate.scale = (0.0, 0.0, 0.0)


PoseSnapshot = dict[str, tuple[tuple, tuple, tuple]]


def snapshot_pose() -> PoseSnapshot:
    return {
        obj.name: (
            tuple(obj.location),
            tuple(obj.rotation_euler),
            tuple(obj.scale),
        )
        for obj in bpy.data.objects
    }


def restore_pose(snapshot: PoseSnapshot) -> None:
    for name, (location, rotation, scale) in snapshot.items():
        obj = bpy.data.objects.get(name)
        if obj:
            obj.location = location
            obj.rotation_euler = rotation
            obj.scale = scale


def mute_all_nla_tracks(mute: bool) -> None:
    """NLA evaluation overrides the authored rest pose, so still renders mute
    every track and the export/save paths restore them."""
    for obj in bpy.data.objects:
        if obj.animation_data:
            for track in obj.animation_data.nla_tracks:
                track.mute = mute


def point_camera(camera: bpy.types.Object, target: tuple[float, float, float]) -> None:
    direction = Vector(target) - camera.location
    camera.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def set_render_engine(scene: bpy.types.Scene) -> None:
    for engine in ("BLENDER_EEVEE_NEXT", "BLENDER_EEVEE", "CYCLES"):
        try:
            scene.render.engine = engine
            return
        except TypeError:
            continue


def setup_preview_scene(materials: dict[str, bpy.types.Material]) -> dict[str, bpy.types.Object]:
    scene = bpy.context.scene
    set_render_engine(scene)
    scene.render.resolution_x = 720
    scene.render.resolution_y = 720
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.film_transparent = False
    scene.render.image_settings.color_depth = "8"
    scene.render.fps = FPS

    scene.view_settings.view_transform = "Standard"
    scene.view_settings.look = "None"
    scene.world.color = hex_rgba(PALETTE["Backdrop"])[:3]
    world_nodes = scene.world.node_tree.nodes if scene.world.use_nodes else None
    if not scene.world.use_nodes:
        scene.world.use_nodes = True
        world_nodes = scene.world.node_tree.nodes
    background = world_nodes.get("Background") if world_nodes else None
    if background:
        background.inputs["Color"].default_value = hex_rgba(PALETTE["Backdrop"])
        background.inputs["Strength"].default_value = 0.34

    bpy.ops.object.camera_add(location=(7.4, -15.1, 7.5))
    camera = bpy.context.object
    camera.name = "Preview_Camera"
    camera.data.type = "ORTHO"
    camera.data.ortho_scale = 10.6
    camera.data.lens = 55
    point_camera(camera, (0, 0, 0.18))
    scene.camera = camera

    def area_light(
        name: str,
        location: tuple[float, float, float],
        energy: float,
        size: float,
        color: str,
    ) -> bpy.types.Object:
        bpy.ops.object.light_add(type="AREA", location=location)
        light = bpy.context.object
        light.name = name
        light.data.energy = energy
        light.data.shape = "DISK"
        light.data.size = size
        light.data.color = hex_rgba(color)[:3]
        point_camera(light, (0, 0, 0))
        return light

    key = area_light("Key_Light", (-7.0, -9.0, 11.0), 1275, 6.0, "#FFF4E8")
    fill = area_light("Fill_Light", (8.0, -3.0, 6.0), 610, 5.0, "#DDEBFF")
    rim = area_light("Rim_Light", (2.0, 8.0, 10.0), 850, 4.0, "#FFD9A4")

    add_box(
        "Preview_Floor",
        (0, 0, -3.38),
        (24.0, 24.0, 0.22),
        materials["Floor"],
        bevel=0.10,
    )

    return {"camera": camera, "key": key, "fill": fill, "rim": rim}


def render_stills(
    scene_objects: dict[str, bpy.types.Object],
    rig: dict[str, bpy.types.Object],
) -> None:
    scene = bpy.context.scene
    camera = scene_objects["camera"]
    root = rig["root"]

    # Canonical three-quarter presentation on the calm-hive backdrop.
    scene.render.filepath = str(PREVIEW_DIR / "bee-canonical.png")
    scene.frame_set(0)
    root.rotation_euler = (0, 0, 0)
    camera.location = (7.4, -15.1, 7.5)
    point_camera(camera, (0, 0, 0.18))
    bpy.ops.render.render(write_still=True)

    # Transparent render for direct overlay/difference checking.
    scene.render.film_transparent = True
    scene.render.filepath = str(PREVIEW_DIR / "bee-transparent.png")
    bpy.data.objects["Preview_Floor"].hide_render = True
    bpy.ops.render.render(write_still=True)
    bpy.data.objects["Preview_Floor"].hide_render = False
    scene.render.film_transparent = False

    # Orthographic character sheet views.
    views = {
        "front": ((0, -15.5, 0.5), (0, 0, 0)),
        "right": ((15.5, 0, 0.5), (0, 0, 0)),
        "rear": ((0, 15.5, 0.5), (0, 0, 0)),
        "left": ((-15.5, 0, 0.5), (0, 0, 0)),
        "top": ((0, 0, 16.0), (0, 0, 0)),
    }
    camera.data.ortho_scale = 10.6
    for name, (location, target) in views.items():
        camera.location = location
        point_camera(camera, target)
        scene.render.filepath = str(PREVIEW_DIR / f"bee-{name}.png")
        bpy.ops.render.render(write_still=True)


def render_expressions(
    scene_objects: dict[str, bpy.types.Object],
    rig: dict[str, bpy.types.Object],
) -> None:
    scene = bpy.context.scene
    camera = scene_objects["camera"]
    camera.location = (7.4, -15.1, 7.5)
    point_camera(camera, (0, 0, 0.18))
    for name, plate in rig["faces"].items():
        plate.scale = (1.0, 1.0, 1.0)
        scene.render.filepath = str(PREVIEW_DIR / f"bee-face-{name}.png")
        bpy.ops.render.render(write_still=True)
        plate.scale = (0.0, 0.0, 0.0)


def render_turntable(
    scene_objects: dict[str, bpy.types.Object],
    rig: dict[str, bpy.types.Object],
) -> None:
    scene = bpy.context.scene
    camera = scene_objects["camera"]
    root = rig["root"]
    scene.render.resolution_x = 640
    scene.render.resolution_y = 640
    scene.render.resolution_percentage = 100

    # Render 72 views rather than relying on animation evaluation; this keeps
    # every named state clip untouched in the authoring file.
    radius = math.hypot(7.4, 15.1)
    elevation = 7.5
    total = 72
    for frame in range(total):
        angle = -math.atan2(15.1, 7.4) + (2 * math.pi * frame / total)
        camera.location = (
            radius * math.cos(angle),
            radius * math.sin(angle),
            elevation,
        )
        point_camera(camera, (0, 0, 0.18))
        root.rotation_euler = (0, 0, 0)
        scene.render.filepath = str(FRAME_DIR / f"bee-{frame:03d}.png")
        bpy.ops.render.render(write_still=True)


def export_glb() -> None:
    params = dict(
        filepath=str(GLB_PATH),
        export_format="GLB",
        export_animations=True,
        export_animation_mode="NLA_TRACKS",
        export_merge_animation="NLA_TRACK",
        export_nla_strips=True,
        export_materials="EXPORT",
        export_texcoords=False,
        export_cameras=False,
        export_lights=False,
        export_extras=True,
        export_yup=True,
        export_apply=True,
        # Keep constant channels: expression plates rely on constant 0/1
        # scale tracks in every clip so runtimes always reset the face.
        export_optimize_animation_size=False,
        export_optimize_animation_keep_anim_object=True,
        export_force_sampling=True,
        export_frame_step=1,
    )
    available = bpy.ops.export_scene.gltf.get_rna_type().properties.keys()
    bpy.ops.export_scene.gltf(
        **{key: value for key, value in params.items() if key in available}
    )


def save_source() -> None:
    bpy.context.scene["asset_name"] = "BeeGreat Bee"
    bpy.context.scene["asset_version"] = "2.1.0"
    bpy.context.scene["canonical_reference"] = (
        "apps/mobile/assets/images/bee.webp"
    )
    bpy.context.scene["animation_clips"] = (
        "idle,listening,working,waiting,success,failure,sleeping"
    )
    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND_PATH))


def main() -> None:
    ASSET_DIR.mkdir(parents=True, exist_ok=True)
    PREVIEW_DIR.mkdir(parents=True, exist_ok=True)
    FRAME_DIR.mkdir(parents=True, exist_ok=True)
    clean_scene()

    materials = {
        name: make_material(name, color)
        for name, color in PALETTE.items()
    }
    rig = build_bee(materials)
    rest_pose = snapshot_pose()
    add_animations(rig)

    # Export before adding the camera, lights, and studio floor so the runtime
    # GLB contains only Bee's hierarchy, materials, and animation clips.
    export_glb()
    # Exporting samples every NLA track and leaves the last sampled pose on
    # the objects; restore the authored rest pose for the still renders.
    mute_all_nla_tracks(True)
    restore_pose(rest_pose)
    scene_objects = setup_preview_scene(materials)
    render_stills(scene_objects, rig)
    render_expressions(scene_objects, rig)
    if os.environ.get("BEE_SKIP_TURNTABLE") != "1":
        render_turntable(scene_objects, rig)
    mute_all_nla_tracks(False)
    save_source()

    print(f"Bee source: {BLEND_PATH}")
    print(f"Bee GLB: {GLB_PATH}")
    print(f"Previews: {PREVIEW_DIR}")


if __name__ == "__main__":
    # Blender includes its own arguments before the script path.
    sys.argv = [sys.argv[0]]
    main()
