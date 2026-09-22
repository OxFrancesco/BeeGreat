import bpy,json,hashlib,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'output/blender/pecu-claim-cards-20260922'
def fingerprint(obj):
    return hashlib.sha256(str([(tuple(v.co)) for v in obj.data.vertices]).encode()).hexdigest()
names=['Shell · rounded coral vault','Coin · solid gold disk']
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'output/blender/pecu-mascot-v2/idle.blend'))
expected={n:fingerprint(bpy.data.objects[n]) for n in names}
results=[]
files=sorted((OUT/'blends').glob('*.blend'))
assert len(files)==30,len(files)
for i,path in enumerate(files,1):
    bpy.ops.wm.open_mainfile(filepath=str(path))
    s=bpy.context.scene
    assert s['card_id']==f'{i:02}'
    assert s.render.film_transparent and s.render.image_settings.color_mode == 'RGBA'
    assert bpy.data.objects['Studio · seamless ivory'].hide_render
    assert s.camera and s.render.resolution_x==1080 and s.render.resolution_y==1440
    assert all(fingerprint(bpy.data.objects[n])==expected[n] for n in names)
    assert (OUT/'renders'/f'{i:02}.png').is_file()
    assert bpy.data.images[s['reference']].packed_file
    assert all(f.packed_file for f in bpy.data.fonts if f.filepath and f.filepath!='<builtin>')
    textures=[n for m in bpy.data.materials if m.use_nodes for n in m.node_tree.nodes if n.type=='TEX_IMAGE']
    assert not textures,'Artwork must be modeled, not image textures'
    for o in s.objects:
        if o.name in ['Crescent cradle','Crescent lamp','Window moon','Sleep moon','Golden crescent boat','Night moon']:
            assert len(o.data.polygons)==194,(path.name,o.name,len(o.data.polygons))
    results.append({'id':s['card_id'],'title':s['card_title'],'file':path.name,'objects':len(s.objects),'meshes':sum(o.type=='MESH' for o in s.objects),'curves':sum(o.type=='CURVE' for o in s.objects),'canonical_shell_and_coin':True,'packed_reference':True,'transparent_surroundings':True,'render':[1080,1440]})
(OUT/'validation.json').write_text(json.dumps({'verified':30,'cards':results},indent=2))
print('VERIFIED 30 EDITABLE BLENDER FILES',flush=True)
