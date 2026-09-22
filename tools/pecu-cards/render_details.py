import bpy,sys,math
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'output/blender/pecu-claim-cards-20260922'
p=next((OUT/'blends').glob('01-*.blend'))
bpy.ops.wm.open_mainfile(filepath=str(p));s=bpy.context.scene
s.render.resolution_x=900;s.render.resolution_y=1200;s.cycles.samples=32
prefs=bpy.context.preferences.addons['cycles'].preferences;prefs.compute_device_type='METAL';prefs.get_devices()
for d in prefs.devices:d.use=d.type=='METAL'
s.cycles.device='GPU'
for name,pos in [('side',(15,-20,11)),('back',(-9,22,10))]:
    s.camera.location=pos;s.camera.rotation_euler=(Vector((0,0,4.5))-s.camera.location).to_track_quat('-Z','Y').to_euler()
    s.render.filepath=str(OUT/f'geometry-{name}.png');bpy.ops.render.render(write_still=True)
