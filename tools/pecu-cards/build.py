"""Build and render one or more editable Pecu clay cards in Blender."""
import argparse
import hashlib
import json
import math
import random
import sys
from pathlib import Path

import bpy
from mathutils import Vector

HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[1]
sys.path.insert(0,str(HERE))
from clay import *
import themes

OUT=ROOT/'output/blender/pecu-claim-cards-20260922'
REFERENCES=ROOT/'output/imagegen/pecu-claim-cards-20260922'
SOURCE=ROOT/'output/blender/pecu-mascot-v2/idle.blend'
CONCEPTS=json.loads((REFERENCES/'prompts.json').read_text())['concepts']
PALETTES=[
 ('cream','sage','sage'),('lavender','plum','lavender'),('cream','teal','sand'),
 ('yellow','sky','ice'),('terracotta','forest','sage'),('lilac','plum','lavender'),
 ('cream','blush','pink'),('terracotta','plum','plum'),('teal','teal','sand'),
 ('sand','cream','sand'),('ivory','blush','pink'),('cream','mint','sage'),
 ('blush','lavender','lavender'),('sage','cream','sand'),('ivory','terracotta','ochre'),
 ('ice','sky','snow'),('cream','blush','pink'),('blush','coral','pink'),
 ('ivory','cream','ivory'),('wood','forest','wood'),('ice','sky','ice'),
 ('ivory','blush','sand'),('ivory','sky','lavender'),('indigo','plum','sage'),
 ('cream','lavender','sand'),('cream','sage','sage'),('cream','indigo','cream'),
 ('burgundy','wood','burgundy'),('lavender','blush','sage'),('ivory','ochre','cream')]


def rounded_rect(w,h,r,z=4.5,y=.12):
    pts=[]
    for x,zz,start in [(w/2-r,h/2-r,0),(-w/2+r,h/2-r,90),(-w/2+r,-h/2+r,180),(w/2-r,-h/2+r,270)]:
        for i in range(9):
            a=math.radians(start+i*90/8)
            pts.append((x+r*math.cos(a),y,z+zz+r*math.sin(a)))
    return pts


def build(ident,preview=False):
    index=int(ident)-1;_,name,description=CONCEPTS[index]
    random.seed(int(ident)*1021)
    bpy.ops.wm.open_mainfile(filepath=str(SOURCE))
    s=bpy.context.scene;s.name=f'{ident} {name}';s.frame_set(1)
    for o in s.objects:
        o.animation_data_clear()
        if o.data:
            o.data.animation_data_clear()
            if hasattr(o.data,'shape_keys') and o.data.shape_keys:o.data.shape_keys.animation_data_clear()
    s.frame_start=1;s.frame_end=1;s.timeline_markers.clear()
    palette()
    for matname in ['Shell · soft coral','Body · butter yellow']:
        m=bpy.data.materials[matname];p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Roughness'].default_value=.63
        n=m.node_tree.nodes.new('ShaderNodeTexNoise');n.inputs['Scale'].default_value=30;n.inputs['Detail'].default_value=3
        b=m.node_tree.nodes.new('ShaderNodeBump');b.inputs['Strength'].default_value=.18;b.inputs['Distance'].default_value=.021
        m.node_tree.links.new(n.outputs['Fac'],b.inputs['Height']);m.node_tree.links.new(b.outputs['Normal'],p.inputs['Normal'])
    frame,inset,shelf=PALETTES[index]
    pts=rounded_rect(6.5,8.8,.55)
    profile('Card / solid backing',[(x,z-4.5) for x,y,z in pts],(0,1.13,4.5),.62,frame,.08)
    pts=rounded_rect(5.88,8.0,.5)
    profile('Card / recessed stage',[(x,z-4.5) for x,y,z in pts],(0,.72,4.5),.32,inset,.05)
    line('Card / continuous hand rolled rim',rounded_rect(6.05,8.3,.58,y=.25),.15,frame,True)
    box('Card / stage floor',(0,-.08,1.28),(5.70,1.7,.45),shelf,.18)
    box('Card / name plaque',(0,-.61,.67),(5.45,.2,.65),frame,.16)
    label=text('Card / title',name,(0,-.765,.53),.36,'brown' if frame not in ['indigo','burgundy','wood','teal','terracotta','lilac'] else 'ivory')
    bpy.context.view_layer.update()
    if label.dimensions.x>4.95:label.scale*=4.95/label.dimensions.x
    disk('Card / number seal',(-2.39,.00,8.08),.42,.13,frame)
    text('Card / number',ident,(-2.39,-.10,7.91),.43,'brown' if frame not in ['indigo','burgundy','wood','teal','terracotta','lilac'] else 'ivory')
    root=bpy.data.objects['PECU · character'];root.location=(-.22,-.25,1.65);root.scale=(1.05,)*3
    themes.BUILDERS[index](root)
    floor=bpy.data.objects['Studio · seamless ivory'];floor.is_shadow_catcher=False;floor.hide_render=True
    s.render.film_transparent=True
    s.world.node_tree.nodes['Background'].inputs[0].default_value=(.93,.90,.83,1)
    s.world.node_tree.nodes['Background'].inputs[1].default_value=.45
    lighting=[('Studio · large key',(-4,-7,12),1250,7),('Studio · soft fill',(5,-6,8),500,6),('Studio · coral rim',(-3,3,11),1000,5)]
    for n,pos,power,size in lighting:
        light=bpy.data.objects[n];light.location=pos;light.data.energy=power;light.data.size=size
        light.rotation_euler=(Vector((0,0,4))-light.location).to_track_quat('-Z','Y').to_euler()
    s.camera.location=(2.9,-23,9.7)
    s.camera.rotation_euler=(Vector((0,0,4.5))-s.camera.location).to_track_quat('-Z','Y').to_euler()
    s.camera.data.type='ORTHO';s.camera.data.ortho_scale=10.25
    s.render.resolution_x=600 if preview else 1080;s.render.resolution_y=800 if preview else 1440;s.render.resolution_percentage=100
    s.render.image_settings.file_format='PNG';s.render.image_settings.color_mode='RGBA'
    s.render.engine='CYCLES';s.cycles.samples=24 if preview else 64;s.cycles.use_denoising=True;s.cycles.adaptive_threshold=.035
    s.view_settings.view_transform='AgX'
    prefs=bpy.context.preferences.addons['cycles'].preferences
    prefs.compute_device_type='METAL';prefs.get_devices()
    for device in prefs.devices:device.use=device.type=='METAL'
    s.cycles.device='GPU' if any(d.use for d in prefs.devices) else 'CPU'
    reference=bpy.data.images.load(str(REFERENCES/(ident+'.png')),check_existing=True)
    reference.name=f'{ident} / concept reference';reference.use_fake_user=True;reference.pack()
    guide=bpy.data.texts.new('READ ME / '+name)
    guide.write(f'{ident} {name}\n\n'+description+'\n\nAll visible elements are editable 3D geometry. The original image is packed as a reference only. Numpad 0 opens the camera; F12 renders. Objects are named by their role. The Pecu character retains the source body, shell, eyes and inset coin.\n')
    s['card_id']=ident;s['card_title']=name;s['reference']=reference.name;s['generator']='tools/pecu-cards/build.py'
    for screen in bpy.data.screens:
        for area in screen.areas:
            if area.type=='VIEW_3D':
                area.spaces.active.region_3d.view_perspective='CAMERA';area.spaces.active.shading.type='MATERIAL'
    bpy.ops.object.select_all(action='DESELECT')
    bpy.context.view_layer.objects.active=root
    root.select_set(True)
    s.render.filepath=str(OUT/'renders'/f'{ident}{"-preview" if preview else ""}.png')
    if not preview:
        bpy.ops.file.pack_all()
        bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'blends'/f'{ident}-{name.lower().replace(" ","-")}.blend'),compress=True)
    bpy.ops.render.render(write_still=True)
    print('CARD_RENDERED',ident,name,len(s.objects),flush=True)


if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--ids',default='01');parser.add_argument('--preview',action='store_true')
    args=parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    for ident in args.ids.split(','):build(ident.zfill(2),args.preview)
