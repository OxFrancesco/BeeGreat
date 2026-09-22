import bpy
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'output/blender/pecu-claim-cards-20260922'
bpy.ops.wm.read_factory_settings(use_empty=True)
blank=bpy.context.scene
paths=sorted((OUT/'blends').glob('*.blend'))
assert len(paths)==30
for path in paths:
    with bpy.data.libraries.load(str(path),link=False) as (source,target):target.scenes=source.scenes
    print('APPENDED',path.name,flush=True)
bpy.context.window.scene=next(s for s in bpy.data.scenes if s.get('card_id')=='01')
bpy.data.scenes.remove(blank)
assert len(bpy.data.scenes)==30
for scene in bpy.data.scenes:
    if 'reference' in scene:del scene['reference']
readme=bpy.data.texts.new('START HERE')
readme.write('Pecu: 30 clay collectible cards\n\nChoose a numbered scene in the top-right Scene dropdown. Each is a complete editable 3D card with its own camera and lighting. Numpad 0: camera. F12: render. Individual scene files and PNG renders are in the adjacent blends/ and renders/ directories.\n\nFull-resolution concept references are packed in the individual scene files in blends/. This combined project contains modeled geometry and procedural clay materials.\n')
bpy.ops.file.pack_all()
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'pecu-all-30.blend'),compress=True)
print('SAVED 30-SCENE COLLECTION',flush=True)
