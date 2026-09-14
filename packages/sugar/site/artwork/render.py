import bpy, math, sys
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parent.parent
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
def material(name,color):
 m=bpy.data.materials.new(name); m.diffuse_color=(*color,1); m.use_nodes=True
 p=m.node_tree.nodes.get('Principled BSDF'); p.inputs['Base Color'].default_value=(*color,1); p.inputs['Roughness'].default_value=.72
 noise=m.node_tree.nodes.new('ShaderNodeTexNoise');noise.inputs['Scale'].default_value=95;noise.inputs['Detail'].default_value=2
 bump=m.node_tree.nodes.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.16;bump.inputs['Distance'].default_value=.025
 m.node_tree.links.new(noise.outputs['Fac'],bump.inputs['Height']);m.node_tree.links.new(bump.outputs['Normal'],p.inputs['Normal'])
 return m
def rgb(value):
 c=[int(value[i:i+2],16)/255 for i in (0,2,4)]
 return tuple(v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in c)
purple=material('Aero pale blue clay',rgb('9cadff')); dark=material('Aero midnight clay',rgb('26283b')); screen=material('Recessed charcoal screen',rgb('171824')); cream=material('Aero ivory prompt',rgb('f5f3e6')); gold=material('Aero ivory coin',rgb('f5f3e6')); peach=material('Aero blue chart',rgb('2660f5')); rim=material('Coin rim',rgb('fffdf2')); floor=material('Pale blue backdrop',rgb('e9edff'))

def cube(name,loc,scale,mat,r=.15):
 bpy.ops.mesh.primitive_cube_add(size=1,location=loc); o=bpy.context.object;o.name=name;o.dimensions=scale;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 o.data.materials.append(mat); b=o.modifiers.new('Soft clay edges','BEVEL');b.width=r;b.segments=8;o.modifiers.new('Weighted corner normals','WEIGHTED_NORMAL');return o
def curve(name,points,r,mat):
 c=bpy.data.curves.new(name,'CURVE');c.dimensions='3D';c.bevel_depth=r;c.bevel_resolution=6;s=c.splines.new('POLY');s.points.add(len(points)-1)
 for p,v in zip(s.points,points):p.co=(*v,1)
 o=bpy.data.objects.new(name,c);bpy.context.collection.objects.link(o);o.data.materials.append(mat)
 for v in (points[0],points[-1]):
  bpy.ops.mesh.primitive_uv_sphere_add(segments=24,ring_count=12,radius=r,location=v);bpy.context.object.data.materials.append(mat);bpy.context.object.parent=o; bpy.context.object.matrix_parent_inverse=o.matrix_world.inverted()
 return o
def coin(name,loc,rotation):
 bpy.ops.mesh.primitive_cylinder_add(vertices=96,radius=.51,depth=.22,location=loc,rotation=rotation);o=bpy.context.object;o.name=name;o.data.materials.append(gold);b=o.modifiers.new('Rounded coin edge','BEVEL');b.width=.055;b.segments=5;o.modifiers.new('Coin normals','WEIGHTED_NORMAL')
 normal=o.rotation_euler.to_matrix()@Vector((0,0,1));pos=Vector(loc)+normal*.12
 bpy.ops.mesh.primitive_torus_add(major_radius=.395,minor_radius=.024,major_segments=96,minor_segments=12,location=pos,rotation=rotation);bpy.context.object.data.materials.append(rim);bpy.context.object.parent=o;bpy.context.object.matrix_parent_inverse=o.matrix_world.inverted()
 o['action']='coin'
 return o
cube('Rounded display plinth',(0,0,.35),(4.15,1.9,.7),purple,.32)
body=cube('Monitor body',(-.62,.10,1.86),(2.36,.74,2.3),dark,.3)
cut=cube('Screen cavity cutter',(-.62,-.31,1.86),(1.84,.7,1.78),screen,.22)
bpy.context.view_layer.objects.active=cut
for mod in list(cut.modifiers):bpy.ops.object.modifier_apply(modifier=mod.name)
bpy.context.view_layer.objects.active=body
for mod in list(body.modifiers):bpy.ops.object.modifier_apply(modifier=mod.name)
mod=body.modifiers.new('Inset screen cavity','BOOLEAN');mod.operation='DIFFERENCE';mod.object=cut;bpy.ops.object.modifier_apply(modifier=mod.name);bpy.data.objects.remove(cut,do_unlink=True)
cube('Recessed display',(-.62,.015,1.86),(1.8,.08,1.75),screen,.2)
curve('Prompt chevron',[(-1.15,-.065,2.12),(-.87,-.065,1.89),(-1.15,-.065,1.65)],.077,cream)
curve('Prompt cursor',[(-.66,-.065,1.63),(-.32,-.065,1.63)],.07,cream)
for i,h in enumerate([.52,.84,1.18]):cube('Chart column '+str(i),(.73+i*.45,-.18,.7+h/2),(.43,.49,h),peach,.17)
coin('Front upright coin',(-1.08,-1.31,.47),(math.radians(63),math.radians(18),math.radians(-12)))
coin('Flat coin',(-1.86,-1.36,.065),(0,0,0))

def aim(o,p):o.rotation_euler=(Vector(p)-o.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add(location=(-2.7,-12,5.3));cam=bpy.context.object;aim(cam,(-.12,0,1.44));cam.data.type='ORTHO';cam.data.ortho_scale=5.45;bpy.context.scene.camera=cam
for name,loc,power,size in [('Large softbox',(-3,-4,7),650,5),('Fill',(4,-2,4),260,4),('Rim',(1,4,6),450,3)]:
 bpy.ops.object.light_add(type='AREA',location=loc);o=bpy.context.object;o.name=name;o.data.energy=power;o.data.shape='DISK';o.data.size=size;aim(o,(0,0,1))
s=bpy.context.scene;s.render.engine='CYCLES';s.cycles.samples=64;s.cycles.use_denoising=True;s.render.resolution_x=1200;s.render.resolution_y=1200;s.render.resolution_percentage=100;s.world.use_nodes=True;s.world.node_tree.nodes.get('Background').inputs[0].default_value=(.79,.77,.87,1);s.world.node_tree.nodes.get('Background').inputs[1].default_value=.7;s.view_settings.view_transform='AgX';s.view_settings.look='AgX - Medium High Contrast';s.view_settings.exposure=.7
s.render.film_transparent=True;s.render.image_settings.color_mode='RGBA';s.render.image_settings.file_format='PNG';s.render.filepath=str(ROOT/'public/aero-blender.png')
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'artwork/aero.blend'))
bpy.ops.object.select_all(action='DESELECT')
for obj in bpy.context.scene.objects:
 if obj.type in {'MESH','CURVE'}:obj.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(ROOT/'public/aero-scene.glb'),export_format='GLB',use_selection=True,export_apply=True,export_extras=True)
if '--export-only' not in sys.argv:bpy.ops.render.render(write_still=True)
