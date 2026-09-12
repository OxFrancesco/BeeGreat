"""Original Bee Healthy bottle. Blender source, GLB and transparent previews."""
from pathlib import Path
import math
import bpy
from mathutils import Vector
ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'assets/water-3d'
OUT.mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
colors = {'Edge':'#3F2922','Wax':'#FFE0A2','Honey':'#ECA933','Cap':'#B97024','Glass':'#84B8BA','Water':'#319DBC','Surface':'#77D3E3','Highlight':'#D4F5F0','Base':'#416D73'}
mats = {}
for name, color in colors.items():
    rgb = [int(color[i:i+2],16)/255 for i in (1,3,5)]
    rgb = [v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in rgb]
    mat = bpy.data.materials.new(name); mat.diffuse_color=(*rgb,1); mat.use_nodes=True
    bsdf=mat.node_tree.nodes.get('Principled BSDF'); bsdf.inputs['Base Color'].default_value=(*rgb,1); bsdf.inputs['Roughness'].default_value=.62
    mats[name]=mat
shell=[]
def box(name, low, high, mat, collect=True):
    low,high=Vector(low),Vector(high)
    bpy.ops.mesh.primitive_cube_add(size=1, location=(low+high)/2)
    obj=bpy.context.object;obj.name=name;obj.dimensions=high-low
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);obj.data.materials.append(mats[mat])
    if collect:shell.append(obj)
    return obj
def hexagon(name, radius, bottom, depth, mat):
    bpy.ops.mesh.primitive_cylinder_add(vertices=6,radius=radius,depth=depth,location=(0,0,bottom+depth/2),rotation=(0,0,math.pi/6))
    obj=bpy.context.object;obj.name=name;obj.data.materials.append(mats[mat]);shell.append(obj)
    return obj
# Thick faceted base and open front chamber. Discrete edges match Bee's blockwork.
box('Base edge',(-.72,-.55,0),(.72,.55,.16),'Edge')
box('Base wax inset',(-.65,-.56,.16),(.65,.56,.25),'Wax')
box('Base glass',(-.64,-.5,.25),(.64,.5,.34),'Base')
for x in (-.71,.59):
    box('Corner', (x,-.55,.25),(x+.12,.55,2.62),'Edge')
    box('Corner highlight',(x+.025,-.575,.34),(x+.075,-.55,2.52),'Wax')
box('Back glass',(-.59,.45,.32),(.59,.54,2.6),'Glass')
for x in (-.59,.51):box('Side glass',(x,-.47,.32),(x+.08,.45,2.6),'Glass')
box('Shoulder edge',(-.7,-.55,2.6),(.7,.55,2.75),'Edge')
box('Shoulder',(-.59,-.47,2.75),(.59,.47,2.86),'Glass')
box('Shoulder step',(-.46,-.38,2.86),(.46,.38,2.96),'Glass')
box('Neck',(-.3,-.3,2.96),(.3,.3,3.1),'Base')
# Actual six-sided screw cap, with a smaller inset hexagon and voxel bee mark.
hexagon('Hex cap seal',.49,3.07,.10,'Edge')
hexagon('Hexagonal honey cap',.51,3.17,.24,'Cap')
hexagon('Hexagonal top lip',.52,3.41,.08,'Honey')
hexagon('Hexagonal wax inset',.39,3.49,.045,'Wax')
box('Cap bee body',(-.11,-.08,3.538),(.11,.08,3.565),'Honey')
box('Cap bee stripe',(-.025,-.085,3.54),(.025,.085,3.575),'Edge')
for x in (-.18,.1):box('Cap bee wing',(x,-.08,3.54),(x+.08,.08,3.57),'Highlight')
# Molded measure ticks remain visible even when empty.
for i in range(1,9):
    z=.34+i*.265
    box('Measure tick',(.40,-.565,z),(.57,-.54,z+.032),'Wax')
box('Glass shine',(-.49,-.565,.55),(-.445,-.54,1.65),'Highlight')
box('Glass shine pixel',(-.49,-.565,1.72),(-.445,-.54,1.86),'Highlight')
# Small rear honeycomb detail.
hexagon('Rear emblem source',.1,0,.01,'Honey').hide_render=True
shell.pop().hide_set(True)
bpy.data.objects.remove(bpy.data.objects['Rear emblem source'],do_unlink=True)
box('Rear label',(-.33,.545,1.1),(.33,.57,1.8),'Wax')
for z in (1.3,1.47,1.64):box('Rear label line',(-.23,.57,z),(.23,.58,z+.045),'Edge')
bpy.ops.object.select_all(action='DESELECT')
for obj in shell:obj.select_set(True)
bpy.context.view_layer.objects.active=shell[0];bpy.ops.object.join();structure=bpy.context.object;structure.name='Bottle_Shell'
water=box('Water_Fill',(-.505,-.46,.34),(.505,.44,2.56),'Water',False)
bpy.context.scene.cursor.location=(0,0,.34);bpy.context.view_layer.objects.active=water;bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
water['baseHeight']=.34;water['fillHeight']=2.22;water['capacity']=2000
surface=box('Water_Surface',(-.505,-.46,2.55),(.505,.44,2.57),'Surface',False)
bpy.context.scene.cursor.location=(0,0,2.56);bpy.context.view_layer.objects.active=surface;bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
root=bpy.data.objects.new('Bottle_Root',None);bpy.context.collection.objects.link(root)
for obj in (structure,water,surface):obj.parent=root
bpy.ops.object.select_all(action='DESELECT')
for obj in (root,structure,water,surface):obj.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(OUT/'water-bottle.glb'),export_format='GLB',use_selection=True,export_extras=True)
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=24
scene.render.resolution_x=600;scene.render.resolution_y=800;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGBA';scene.render.film_transparent=True
scene.view_settings.view_transform='Standard';scene.world.use_nodes=True;scene.world.node_tree.nodes.get('Background').inputs['Strength'].default_value=.6
def point(obj):obj.rotation_euler=(Vector((0,0,1.7))-obj.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add(location=(4,-8,5.3));camera=bpy.context.object;camera.data.type='ORTHO';camera.data.ortho_scale=4.3;point(camera);scene.camera=camera
for pos,power in [((-4,-6,7),600),((5,-1,5),350),((0,5,6),450)]:
    bpy.ops.object.light_add(type='AREA',location=pos);lamp=bpy.context.object;lamp.data.energy=power;lamp.data.size=5;point(lamp)
def fill(ratio):
    water.scale.z=max(.001,ratio);surface.location.z=.34+2.22*ratio;water.hide_render=surface.hide_render=ratio<=0
fill(.5);bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'water-bottle.blend'))
for name,ratio in [('bottle-preview',.5),('bottle-empty',0),('bottle-full',1)]:
    fill(ratio);scene.render.filepath=str(OUT/(name+'.png'));bpy.ops.render.render(write_still=True)
scene.render.resolution_x=240;scene.render.resolution_y=320;fill(0);scene.render.filepath=str(OUT/'bottle-fallback.png');bpy.ops.render.render(write_still=True)
