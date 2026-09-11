"""Author and render seven named voxel Bee animation clips in Blender."""
import math,sys,json,os,shutil
from pathlib import Path
import bpy
sys.path.insert(0,str(Path(__file__).resolve().parent))
sys.dont_write_bytecode=True
import build_bee as bee
OUT=Path(__file__).resolve().parents[2]/'assets/bee-3d/minecraft-yellow'
bpy.ops.wm.open_mainfile(filepath=str(OUT/'bee-minecraft.blend'))
bee.END_FRAME=97
root=bpy.data.objects['Bee_Root']
rig={'root':root,'wing_left':bpy.data.objects['Wing_Left'],'wing_right':bpy.data.objects['Wing_Right'],'antenna_left':bpy.data.objects['Antenna_Left'],'antenna_right':bpy.data.objects['Antenna_Right'],'faces':{n:bpy.data.objects['Sleep_Zzz' if n=='zzz' else 'Face_'+n] for n in list(bee.FACE_PLATES)+['zzz']}}
legs=[o for o in bpy.data.objects if o.type=='EMPTY' and o.name.startswith('Leg_')]
for o in bpy.data.objects:
    if o.animation_data:o.animation_data_clear()
for a in list(bpy.data.actions):bpy.data.actions.remove(a)
root.location=(0,0,0); root.rotation_euler=(0,0,0); root.scale=(1,1,1)
for key in ('antenna_left','antenna_right'):rig[key].rotation_euler=(0,0,0)
rig['wing_left'].rotation_euler=(0,math.radians(8),math.radians(10))
rig['wing_right'].rotation_euler=(0,math.radians(-8),math.radians(10))
for o in rig['faces'].values():o.scale=(0,0,0)
rest=bee.snapshot_pose()
def pose(f,x=0,y=0,z=0,rx=0,ry=0,rz=0):return {'frame':f,'location':(x,y,z),'rotation':tuple(math.radians(v) for v in (rx,ry,rz)),'scale':(1,1,1)}
clips={
'idle':([pose(1),pose(25,z=.13,rz=1.5),pose(49),pose(73,z=.13,rz=-1.5),pose(97)],bee.flutter(6,-9,12),[(1,0),(25,3),(49,0),(73,-3),(97,0)],[(46,50,'blink')]),
'fly':([pose(1),pose(13,z=.6,rx=-5),pose(25,x=-.7,z=.95,ry=-7,rz=-7),pose(49,x=.7,z=.75,ry=7,rz=7),pose(73,x=-.25,z=1.0,ry=-3),pose(85,z=.6),pose(97)],bee.flutter(3,-34,38),[(1,0),(25,7),(49,-5),(73,4),(97,0)],[(69,73,'blink')]),
'happy':([pose(1),pose(9,z=-.10,rz=-4),pose(21,z=.55,ry=-5,rz=6),pose(33,z=.06,rz=-5),pose(45,z=.43,ry=5,rz=5),pose(57,z=.05,rz=-4),pose(73,z=.16,rz=3),pose(97)],bee.flutter(4,-18,25),[(1,0),(21,10),(33,-7),(45,8),(57,-5),(73,3),(97,0)],[(1,98,'happy')]),
'sad':([pose(1,z=-.20,rx=7,ry=-3),pose(33,z=-.34,rx=10,ry=-5),pose(65,z=-.26,rx=8,ry=3),pose(97,z=-.20,rx=7,ry=-3)],bee.flutter(16,-20,-10),[(1,-13),(33,-18),(65,-15),(97,-13)],[(1,98,'sad')]),
 'thinking':([pose(1,ry=-7),pose(25,z=.12,ry=-12,rz=-5),pose(49,z=.05,ry=9,rz=6),pose(73,z=.13,ry=5,rz=3),pose(97,ry=-7)],bee.flutter(9,-7,10),[(1,5),(25,14),(49,-10),(73,8),(97,5)],[(1,25,'curious'),(25,43,'look_left'),(43,61,'look_right'),(61,82,'focus'),(82,98,'curious')]),
'fail':([pose(1),pose(9,z=.13,rx=-3),pose(15,x=-.23,z=-.12,rz=-8),pose(21,x=.23,z=-.20,rz=8),pose(27,x=-.16,z=-.23,rz=-5),pose(33,x=.11,z=-.23,rz=4),pose(43,z=-.32,rx=10),pose(69,z=-.26,rx=7),pose(97)],bee.flutter(12,-16,0),[(1,0),(15,8),(27,-12),(43,-19),(69,-12),(97,0)],[(10,18,'blink'),(18,87,'sad')]),
'succeed':([pose(1),pose(9,z=-.14,rz=-6),pose(21,z=.85,rz=70),pose(33,z=1.0,rz=220),pose(45,z=.30,rz=360),pose(53,z=.02,rz=360),pose(65,z=.48,ry=5,rz=365),pose(77,z=.04,rz=357),pose(97,rz=360)],bee.flutter(3,-25,34),[(1,0),(9,-7),(21,13),(45,-6),(65,9),(77,-4),(97,0)],[(1,98,'happy')]),
}
for name,(keys,wings,antennae,expressions) in clips.items():
    bee.mute_all_nla_tracks(True); bee.restore_pose(rest)
    bee.add_clip_bundle(rig,name,keys,wings,antennae,expressions)
    for i,leg in enumerate(legs):
        amount=10 if name in ('fly','happy','succeed') else 3
        bee.add_action(leg,name,[{'frame':f,'rotation':(math.radians(amount*sign*(1 if i%2 else -1)),0,0)} for f,sign in ((1,0),(25,1),(49,-1),(73,1),(97,0))])
    # Clamp Bezier handles to avoid unplanned overshoot between authored poses.
    for o in bpy.data.objects:
        if not o.animation_data:continue
        for track in o.animation_data.nla_tracks:
            if track.name!=name:continue
            for strip in track.strips:
                for fc in bee._action_fcurves(strip.action):
                    for p in fc.keyframe_points:
                        if p.interpolation=='BEZIER':p.handle_left_type='AUTO_CLAMPED'; p.handle_right_type='AUTO_CLAMPED'
scene=bpy.context.scene; scene.frame_start=1; scene.frame_end=97; scene.render.fps=24

def activate(name):
    bee.mute_all_nla_tracks(True); bee.restore_pose(rest)
    for o in bpy.data.objects:
        if o.animation_data:
            for track in o.animation_data.nla_tracks:track.mute=track.name!=name
    scene.frame_set(1)

verification={}
for name in clips:
    activate(name); positions=[]; wings=[]
    for f in range(1,98):
        scene.frame_set(f); positions.append(list(root.location)); wings.append(list(rig['wing_left'].rotation_euler))
        visible=[n for n,o in rig['faces'].items() if max(o.scale)>.5]
        assert len(visible)<=1,(name,f,visible)
    assert len(set(tuple(p) for p in positions))>1,name
    assert len(set(tuple(p) for p in wings))>1,name
    verification[name]={'duration_seconds':4,'root_moves':True,'wings_move':True,'single_expression':True}
(OUT/'animation-verification.json').write_text(json.dumps(verification,indent=2))
# Export the character hierarchy, excluding the studio.
bee.mute_all_nla_tracks(False)
bpy.ops.object.select_all(action='DESELECT')
root.select_set(True)
for o in root.children_recursive:o.select_set(True)
bpy.context.view_layer.objects.active=root
bpy.ops.export_scene.gltf(filepath=str(OUT/'bee-animated.glb'),export_format='GLB',use_selection=True,export_apply=True,export_animations=True,export_animation_mode='NLA_TRACKS',export_merge_animation='NLA_TRACK',export_nla_strips=True,export_optimize_animation_size=False,export_optimize_animation_keep_anim_object=True,export_force_sampling=True,export_frame_step=1,export_cameras=False,export_lights=False)
activate('fly')
scene.camera.location=(7.4,-15.1,7.5); scene.camera.data.ortho_scale=12.3; bee.point_camera(scene.camera,(0,0,.45))
scene['animation_clips']=','.join(clips)
scene['animation_usage']='Play one NLA clip at a time. Fly is enabled on opening. All clips last 4 seconds at 24 fps.'
scene.render.engine='CYCLES'; scene.cycles.samples=32
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'bee-animated.blend'))
# Eevee preview movies use the actual animated scene and its studio lighting.
scene.render.engine='BLENDER_EEVEE'; scene.eevee.taa_render_samples=16
scene.render.resolution_x=640; scene.render.resolution_y=640; scene.render.resolution_percentage=100
for name in list(clips)[1:]:
    activate(name)
    folder=OUT/'animation-frames'/name; folder.mkdir(parents=True,exist_ok=True)
    for f in range(1,97):
        scene.frame_set(f); scene.render.filepath=str(folder/f'{f:04d}.png'); bpy.ops.render.render(write_still=True)
    still_frames={'fly':25,'happy':21,'sad':33,'thinking':25,'fail':43,'succeed':65}
    shutil.copy2(folder/f'{still_frames[name]:04d}.png',OUT/f'{name}.png')
    print('CLIP_RENDERED',name,flush=True)
print('ANIMATIONS_COMPLETE',flush=True)

# Encode the preview movies after Blender finishes rendering every frame.
import subprocess
for name in list(clips)[1:]:
    subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-framerate','24','-i',str(OUT/'animation-frames'/name/'%04d.png'),'-c:v','libx264','-crf','19','-pix_fmt','yuv420p','-movflags','+faststart',str(OUT/(name+'.mp4'))],check=True)
(OUT/'clips.txt').write_text(''.join("file '"+name+".mp4'\n" for name in list(clips)[1:]))
subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-f','concat','-safe','0','-i',str(OUT/'clips.txt'),'-c','copy','-movflags','+faststart',str(OUT/'bee-animation-reel.mp4')],check=True)
