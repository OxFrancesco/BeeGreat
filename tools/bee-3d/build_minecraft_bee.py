"""Rebuild the canonical voxel Bee in bright yellow with subtle modeled edge detail."""
from pathlib import Path
import sys
import bpy
import bmesh
sys.path.insert(0,str(Path(__file__).resolve().parent))
sys.dont_write_bytecode=True
import build_bee as bee
import bee_appearance

OUT=Path(__file__).resolve().parents[2]/'assets/bee-3d/minecraft-yellow'
OUT.mkdir(parents=True,exist_ok=True)
bee.ASSET_DIR=OUT; bee.PREVIEW_DIR=OUT; bee.BLEND_PATH=OUT/'bee-minecraft.blend'; bee.GLB_PATH=OUT/'bee-minecraft.glb'
bee.PALETTE.update(bee_appearance.PALETTE)
bee.clean_scene()
materials={name:bee.make_material(name,color,roughness=.7) for name,color in bee.PALETTE.items()}
rig=bee.build_bee(materials)
# Weld the voxel surface before adding a tiny, single-facet edge chamfer.
# The square silhouette, face pixel map and stepped wings remain canonical.
for o in list(bpy.context.scene.objects):
    if o.type!='MESH' or o.name.startswith('Face_'):continue
    bm=bmesh.new(); bm.from_mesh(o.data); bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.00001)
    bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces)); bm.to_mesh(o.data); bm.free()
    bevel=o.modifiers.new('One-facet voxel edge','BEVEL'); bevel.width=.016; bevel.segments=1; bevel.limit_method='ANGLE'
# Two subtle extra yellow pixel shades on the sides, no changes to the face.
body=bpy.data.objects['Body_Voxels']
for name,color in [(name,bee_appearance.PALETTE[name]) for name in ('Yellow_pixel_light','Yellow_pixel_shadow')]:
    m=bee.make_material(name,color,roughness=.72); body.data.materials.append(m)
for p in body.data.polygons:
    name=body.data.materials[p.material_index].name
    if name not in ('Orange','OrangeShadow') or abs(p.normal.x)<.9:continue
    x,y,z=p.center
    cell=round(y/bee.VOXEL)*13+round(z/bee.VOXEL)*7
    if cell%17==0:p.material_index=len(body.data.materials)-2
    elif cell%23==0:p.material_index=len(body.data.materials)-1
bee_appearance.apply_materials()
rest=bee.snapshot_pose(); bee.add_animations(rig); bee.export_glb()
bee.mute_all_nla_tracks(True); bee.restore_pose(rest)
studio=bee.setup_preview_scene(materials); scene=bpy.context.scene
bpy.data.objects['Preview_Floor'].dimensions.x=200
bpy.data.objects['Preview_Floor'].dimensions.y=200
scene.render.engine='CYCLES'; scene.cycles.samples=32; scene.cycles.use_denoising=True
scene.render.resolution_x=1200; scene.render.resolution_y=1200
# Neutral light preserves the requested clean yellow.
for key in ('key','fill','rim'):studio[key].data.color=(1,1,1)
scene.frame_set(0); rig['root'].rotation_euler=(0,0,0)
cam=studio['camera']; cam.location=(7.4,-15.1,7.5); bee.point_camera(cam,(0,0,.18))
for screen in bpy.data.screens:
    for area in screen.areas:
        if area.type=='VIEW_3D':
            area.spaces.active.region_3d.view_perspective='CAMERA'; area.spaces.active.shading.type='MATERIAL'; area.spaces.active.overlay.show_overlays=False
scene['design']='Canonical Minecraft-style pixel Bee, bright yellow, one-facet chamfers'
scene['canonical_reference']='apps/mobile/assets/images/bee.webp'
for obj in bpy.data.objects:
    if obj.animation_data:
        for track in obj.animation_data.nla_tracks:track.mute=track.name!='idle'
scene.frame_set(1)
bpy.ops.wm.save_as_mainfile(filepath=str(bee.BLEND_PATH))
bee.mute_all_nla_tracks(True); bee.restore_pose(rest)
scene.render.filepath=str(OUT/'bee-portrait.png'); bpy.ops.render.render(write_still=True)
scene.render.film_transparent=True; bpy.data.objects['Preview_Floor'].hide_render=True
scene.render.filepath=str(OUT/'bee-transparent.png'); bpy.ops.render.render(write_still=True)
scene.render.film_transparent=False; bpy.data.objects['Preview_Floor'].hide_render=False
for name,loc in [('front',(0,-15.5,2)),('rear',(8,15.5,7))]:
    cam.location=loc; bee.point_camera(cam,(0,0,.18)); scene.render.filepath=str(OUT/f'bee-{name}.png'); bpy.ops.render.render(write_still=True)
print('MINECRAFT_BEE_COMPLETE')
