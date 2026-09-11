"""Create Bee's rounded 3D redesign. Run with Blender --background --python this_file."""
import math
from pathlib import Path
import bpy
from mathutils import Vector

OUT = Path(__file__).resolve().parents[2] / 'assets/bee-3d/cute-v2'
OUT.mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)

def mat(name, color, rough=.4, metallic=0, subsurface=0):
    m=bpy.data.materials.new(name); m.diffuse_color=(*color,1); m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF'); p.inputs['Base Color'].default_value=(*color,1)
    p.inputs['Roughness'].default_value=rough; p.inputs['Metallic'].default_value=metallic
    p.inputs['Subsurface Weight'].default_value=subsurface
    return m
honey=mat('Honey • soft golden shell',(0.95,.48,.075),.34,0,.07)
face=mat('Face • warm custard',(1,.64,.16),.38,0,.09)
brown=mat('Stripes • cocoa',(0.085,.038,.023),.42)
ink=mat('Eyes • espresso glass',(.018,.009,.012),.13)
caramel=mat('Eye rims • caramel',(.42,.18,.035),.33)
blush=mat('Cheeks • peach',(.98,.24,.17),.5,0,.16)
white=mat('Catchlights • warm white',(1,.97,.88),.18)
wingmat=mat('Wings • pearly cream',(.82,.92,.97),.26,.13,.07)
veinmat=mat('Wing veins • pale blue',(.56,.73,.79),.36,.12)
sole=mat('Feet • toasted honey',(.3,.125,.045),.45)
root=bpy.data.objects.new('Bee • move this to pose the character',None); bpy.context.collection.objects.link(root)
parts=[]
def finish(o,name,m):
    o.name=name; o.data.materials.append(m); o.parent=root; parts.append(o)
    if o.type=='MESH':
        for p in o.data.polygons:p.use_smooth=True
    return o

def cube(name,loc,scale,bevel,m):
    bpy.ops.mesh.primitive_cube_add(size=1,location=loc); o=bpy.context.object; o.dimensions=scale
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    mod=o.modifiers.new('Soft sculpted corners','BEVEL'); mod.width=bevel; mod.segments=8
    o.modifiers.new('Weighted normals','WEIGHTED_NORMAL')
    return finish(o,name,m)

def ball(name,loc,scale,m):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=48,ring_count=32,location=loc)
    o=bpy.context.object; o.scale=scale
    return finish(o,name,m)

def line(name,points,radius,m):
    c=bpy.data.curves.new(name,'CURVE'); c.dimensions='3D'; c.resolution_u=24; c.bevel_depth=radius; c.bevel_resolution=5
    s=c.splines.new('BEZIER'); s.bezier_points.add(len(points)-1)
    for b,p in zip(s.bezier_points,points):b.co=p; b.handle_left_type='AUTO'; b.handle_right_type='AUTO'
    o=bpy.data.objects.new(name,c); bpy.context.collection.objects.link(o); return finish(o,name,m)

cube('Body • rounded honey cube',(0,0,2.0),(2.55,2.42,2.35),.53,honey)
# Rounded bands wrap the full body, with their ends buried in the golden shell.
for i,y in enumerate((.12,.91)):
    cube(f'Cocoa band {i+1}',(0,y,2.0),(2.574,.31,2.374),.15,brown)
# The broad face preserves the square silhouette of the pixel original.
cube('Face • rounded custard cushion',(0,-1.025,2.02),(2.37,.45,2.16),.215,face)
for sign,side in ((-1,'Left'),(1,'Right')):
    x=sign*.55
    ball(side+' eye socket',(x,-1.262,2.19),(.355,.084,.47),caramel)
    ball(side+' eye',(x,-1.321,2.20),(.302,.132,.411),ink)
    ball(side+' main eye sparkle',(x-.092,-1.443,2.36),(.084,.027,.109),white)
    ball(side+' small eye sparkle',(x+.094,-1.448,2.075),(.037,.018,.043),white)
    ball(side+' blush',(sign*.88,-1.253,1.69),(.205,.037,.123),blush)
    for j in range(3):
        ball(side+f' cheek freckle {j}',(sign*(.77+j*.088),-1.291,1.705+(.027 if j==1 else 0)),(.018,.009,.021),caramel)
    line(side+' friendly eyebrow',[(x-.20,-1.253,2.80),(x,-1.276,2.86),(x+.17,-1.254,2.82)],.039,brown)
    line(side+' antenna',[(sign*.61,-.57,3.02),(sign*.69,-.52,3.42),(sign*.84,-.53,3.71),(sign*.98,-.57,3.79)],.058,brown)
    ball(side+' antenna velvet tip',(sign*.98,-.57,3.8),(.155,.14,.175),brown)
    ball(side+' antenna honey inset',(sign*1.0,-.68,3.85),(.068,.043,.072),honey)
    arm=ball(side+' little arm',(sign*1.28,-.64,1.63),(.19,.245,.36),honey); arm.rotation_euler[1]=sign*-.33
    ball(side+' mitten',(sign*1.37,-.73,1.42),(.19,.22,.19),face)
    line(side+' mitten crease',[(sign*1.41,-.935,1.49),(sign*1.44,-.946,1.44),(sign*1.44,-.938,1.40)],.012,caramel)
    ball(side+' foot',(sign*.69,-.35,.76),(.30,.39,.23),brown)
    ball(side+' foot pad',(sign*.69,-.59,.77),(.21,.15,.14),sole)
# Curved smile, a tiny lower lip, and dimples.
line('Smile', [(-.29,-1.27,1.69),(-.17,-1.306,1.57),(0,-1.317,1.535),(.17,-1.306,1.57),(.29,-1.27,1.69)],.036,brown)
ball('Lower lip',(0,-1.277,1.445),(.13,.025,.033),honey)
for s in (-1,1):ball('Smile dimple', (s*.292,-1.271,1.69),(.046,.022,.046),caramel)
# Each wing is a real softly domed mesh with a rolled rim and inset veins.
def wing(side,sign,small=False):
    origin=Vector((sign*1.0,.49,2.85)); length=1.50 if not small else 1.06
    direction=Vector((sign*(.75 if not small else .97),.12,.66 if not small else .13)).normalized()
    across=Vector((sign*-.63,0,.77)) if not small else Vector((sign*-.13,0,.99))
    width=.40 if not small else .29
    verts=[tuple(origin)]; rings=18; n=48
    for j in range(1,rings):
        t=j/rings; center=origin+direction*(length*t); w=width*(math.sin(math.pi*t)**.65)
        for k in range(n):
            a=2*math.pi*k/n; p=center+across*(w*math.cos(a))+Vector((0,.065*math.sin(a)*math.sin(math.pi*t),0)); verts.append(tuple(p))
    tip=len(verts); verts.append(tuple(origin+direction*length)); faces=[]
    for k in range(n):faces.append((0,1+k,1+(k+1)%n))
    for j in range(rings-2):
        a=1+j*n; b=a+n
        for k in range(n):faces.append((a+k,b+k,b+(k+1)%n,a+(k+1)%n))
    a=1+(rings-2)*n
    for k in range(n):faces.append((a+k,tip,a+(k+1)%n))
    mesh=bpy.data.meshes.new(side+' wing mesh'); mesh.from_pydata(verts,[],faces); mesh.update()
    o=bpy.data.objects.new(side+' '+('lower' if small else 'upper')+' wing',mesh); bpy.context.collection.objects.link(o); finish(o,o.name,wingmat)
    # outline follows both edges without lying on a coplanar face
    pts=[]
    for t in [i/32 for i in range(33)]:pts.append(tuple(origin+direction*(length*t)+across*(width*math.sin(math.pi*t)**.65)+Vector((0,-.015,0))))
    for t in [i/32 for i in range(31,-1,-1)]:pts.append(tuple(origin+direction*(length*t)-across*(width*math.sin(math.pi*t)**.65)+Vector((0,-.015,0))))
    line(side+' wing rolled edge '+str(small),pts,.018,white)
    line(side+' wing central vein '+str(small),[tuple(origin+direction*(length*t)+Vector((0,-.07*math.sin(math.pi*t)-.006,0))) for t in (0,.25,.5,.75,.96)],.014,veinmat)
    for t in (.32,.52,.70):
        for edge in (-1,1):
            endt=min(t+.16,.92)
            line(side+' wing branching vein', [tuple(origin+direction*(length*t)+Vector((0,-.077,0))),tuple(origin+direction*(length*(t+.09))+across*(edge*width*.42)+Vector((0,-.063,0))),tuple(origin+direction*(length*endt)+across*(edge*width*math.sin(math.pi*endt)**.65*.86)+Vector((0,-.035,0)))],.009,veinmat)
for sign,side in ((-1,'Left'),(1,'Right')):
    wing(side,sign,True); wing(side,sign)
    ball(side+' wing joint',(sign*1.03,.48,2.88),(.16,.15,.15),honey)
ball('Rounded tail nub',(0,1.28,1.88),(.22,.29,.23),brown)
# A gentle hover loop on the root, exported with the model.
for frame,z in ((1,0),(25,.10),(49,0)):
    root.location.z=z; root.keyframe_insert(data_path='location',frame=frame)
if root.animation_data:root.animation_data.action.name='Bee gentle hover'
scene=bpy.context.scene; scene.frame_end=49; scene.render.fps=24; scene.frame_set(1)
# Studio is separate from the exported character.
floor=mat('Studio • warm ivory',(.77,.71,.60),.75)
bpy.ops.mesh.primitive_plane_add(size=200); plane=bpy.context.object; plane.name='Studio floor'; plane.data.materials.append(floor)
world=bpy.data.worlds.new('Cream studio'); scene.world=world; world.use_nodes=True; world.node_tree.nodes['Background'].inputs[0].default_value=(.72,.78,.87,1); world.node_tree.nodes['Background'].inputs[1].default_value=.35

def aim(o,at):o.rotation_euler=(Vector(at)-o.location).to_track_quat('-Z','Y').to_euler()
for name,loc,power,size,color in [('Key',(-3,-5,8),850,5,(1,.88,.71)),('Fill',(5,-3,4),600,4,(.75,.86,1)),('Rim',(1,4,7),1100,3,(1,.88,.65))]:
    bpy.ops.object.light_add(type='AREA',location=loc); o=bpy.context.object; o.name=name; o.data.energy=power; o.data.shape='DISK'; o.data.size=size; o.data.color=color; aim(o,(0,0,2))
bpy.ops.object.camera_add(location=(5,-10,5.3)); cam=bpy.context.object; cam.name='Portrait camera'; aim(cam,(0,0,2.2)); cam.data.type='ORTHO'; cam.data.ortho_scale=6.4; scene.camera=cam
scene.render.engine='CYCLES'; scene.cycles.samples=40; scene.cycles.use_denoising=True
scene.render.resolution_x=1200; scene.render.resolution_y=1200; scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG'; scene.render.image_settings.color_mode='RGBA'
scene.view_settings.view_transform='AgX'
# Save a usable material-preview opening view.
for screen in bpy.data.screens:
    for area in screen.areas:
        if area.type=='VIEW_3D':
            area.spaces.active.region_3d.view_perspective='CAMERA'
            area.spaces.active.shading.type='MATERIAL'
bpy.ops.object.select_all(action='DESELECT')
root.select_set(True)
for o in parts:o.select_set(True)
bpy.context.view_layer.objects.active=root
# Convert curves only in the export copy so Blender retains editable splines.
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'bee-cute.blend'))
curves=[o for o in parts if o.type=='CURVE']
bpy.ops.object.select_all(action='DESELECT')
for o in curves:o.select_set(True)
bpy.context.view_layer.objects.active=curves[0]; bpy.ops.object.convert(target='MESH')
bpy.ops.object.select_all(action='DESELECT')
root.select_set(True)
for o in root.children:o.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(OUT/'bee-cute.glb'),export_format='GLB',use_selection=True,export_apply=True,export_animations=True,export_cameras=False,export_lights=False)
scene.render.filepath=str(OUT/'bee-cute-portrait.png'); bpy.ops.render.render(write_still=True)
plane.hide_render=True; scene.render.film_transparent=True
scene.render.filepath=str(OUT/'bee-cute-transparent.png'); bpy.ops.render.render(write_still=True)
plane.hide_render=False; scene.render.film_transparent=False
cam.location=(0,-11,3.7); aim(cam,(0,0,2.2)); scene.render.filepath=str(OUT/'bee-cute-front.png'); bpy.ops.render.render(write_still=True)
cam.location=(5,9,5); aim(cam,(0,0,2.2)); scene.render.filepath=str(OUT/'bee-cute-back.png'); bpy.ops.render.render(write_still=True)
print('BEE_ASSETS_COMPLETE',OUT)
