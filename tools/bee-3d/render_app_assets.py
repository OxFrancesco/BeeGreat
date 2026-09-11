"""Render and install the approved yellow voxel Bee's mobile, web, and docs assets.

Run after build_minecraft_bee.py and animate_minecraft_bee.py:
    blender --background --python tools/bee-3d/render_app_assets.py
Requires img2webp on PATH. Render frames stay in /tmp/beegreat-mascot-assets.
"""
from pathlib import Path
import json
import math
import shutil
import subprocess
import sys
import bpy

ROOT=Path(__file__).resolve().parents[2]
SOURCE=ROOT/'assets/bee-3d/minecraft-yellow/bee-animated.blend'
IMAGES=ROOT/'apps/mobile/assets/images'
ASSETS=IMAGES/'bee'
FRAMES=Path('/tmp/beegreat-mascot-assets')
STILLS={'idle':1,'fly':25,'happy':21,'sad':33,'thinking':25,'fail':43,'succeed':65}
ASSETS.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(SOURCE))
scene=bpy.context.scene
scene.render.engine='BLENDER_EEVEE'; scene.eevee.taa_render_samples=24
scene.render.resolution_x=512; scene.render.resolution_y=512; scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG'; scene.render.image_settings.color_mode='RGBA'
scene.render.film_transparent=True
bpy.data.objects['Preview_Floor'].hide_render=True
scene.camera.data.ortho_scale=11.4
root=bpy.data.objects['Bee_Root']


def activate(name):
    for o in bpy.data.objects:
        if o.animation_data:
            for t in o.animation_data.nla_tracks:t.mute=t.name!=name
    scene.frame_set(1)


manifest={}
for name,still_frame in STILLS.items():
    activate(name)
    folder=FRAMES/name; folder.mkdir(parents=True,exist_ok=True)
    for frame in range(1,97):
        scene.frame_set(frame); scene.render.filepath=str(folder/f'{frame:04d}.png')
        bpy.ops.render.render(write_still=True)
    output=ASSETS/f'{name}.webp'
    command=['img2webp','-min_size','-loop','1' if name in ('fail','succeed') else '0','-lossy','-q','86','-m','4']
    for frame in range(1,97):command.extend(['-d',str(41 if frame%3==2 else 42),str(folder/f'{frame:04d}.png')])
    command.extend(['-o',str(output)]); subprocess.run(command,check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    shutil.copy2(folder/f'{still_frame:04d}.png',ASSETS/f'{name}-still.png')
    manifest[name]={'width':512,'height':512,'durationMs':4000,'frames':96,'loop':name not in ('fail','succeed'),'bytes':output.stat().st_size}
    print('APP_ASSET_READY',name,manifest[name],flush=True)

# Existing asset paths stay valid for docs and every legacy consumer.
shutil.copy2(ASSETS/'idle.webp',IMAGES/'bee.webp')
shutil.copy2(ASSETS/'idle-still.png',IMAGES/'bee-static.png')
for mood,clip in {'awful':'sad','bad':'fail','okay':'idle','good':'happy','great':'succeed'}.items():
    shutil.copy2(ASSETS/f'{clip}-still.png',IMAGES/'moods'/f'bee-{mood}.png')

# A voxel head mirror and coat keep the healthcare mascot recognizable.
activate('idle'); scene.frame_set(1)
for o in bpy.data.objects:
    if o.animation_data:
        for t in o.animation_data.nla_tracks:t.mute=True
root.location=(0,0,0);root.rotation_euler=(0,0,0);root.scale=(1,1,1)
for o in root.children_recursive:
    if o.name.startswith('Face_') or o.name=='Sleep_Zzz':o.scale=(0,0,0)
for name,tilt in [('Wing_Left',8),('Wing_Right',-8)]:bpy.data.objects[name].rotation_euler=(0,math.radians(tilt),math.radians(10))
sys.dont_write_bytecode=True;sys.path.insert(0,str(Path(__file__).resolve().parent))
import build_bee as bee
teal=bee.make_material('Doctor teal','#256D70')
white=bee.make_material('Doctor coat','#FAFDFF')
silver=bee.make_material('Doctor head mirror','#B8CDD2')
def box(name,loc,dim,material):
    o=bee.add_box(name,loc,dim,material,bevel=.012);o.parent=root;return o
box('Doctor headband',(0,-2.965,1.56),(5.12,.17,.28),teal)
for x,z,w,h in [(0,1.75,.90,.90),(0,1.75,1.12,.46)]:box('Doctor mirror',(x,-3.12,z),(w,.16,h),silver)
box('Doctor mirror highlight',(-.16,-3.21,1.90),(.23,.03,.23),white)
for sign in (-1,1):
    box('Doctor coat side',(sign*2.54,.0,-1.45),(.16,5.45,.82),white)
    box('Doctor coat front',(sign*1.61,-2.96,-1.72),(1.72,.17,.52),white)
    box('Doctor collar',(sign*1.0,-3.01,-1.45),(.40,.15,.44),white)
scene.render.resolution_x=600;scene.render.resolution_y=600
scene.render.filepath=str(IMAGES/'bee-doctor.png');bpy.ops.render.render(write_still=True)
(ASSETS/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
for name in ('bee.webp','bee-static.png'):shutil.copy2(IMAGES/name,ROOT/'apps/beedocs/public/assets'/name)
shutil.copy2(SOURCE,ROOT/'assets/bee-3d/bee.blend')
shutil.copy2(SOURCE.with_suffix('.glb'),ROOT/'assets/bee-3d/bee.glb')
print('APP_MASCOT_ASSETS_INSTALLED',flush=True)
