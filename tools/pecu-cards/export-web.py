"""Export the modeled card geometry for interactive web inspection."""
import bpy, sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'output/blender/pecu-claim-cards-20260922'
WEB=ROOT/'apps/pecu/apps/stocks/public/assets/pecu-cards'
ids=set(sys.argv[sys.argv.index('--')+1:]) if '--' in sys.argv else set()
for path in sorted((OUT/'blends').glob('*.blend')):
    if ids and path.name[:2] not in ids:continue
    bpy.ops.wm.open_mainfile(filepath=str(path))
    bpy.ops.object.select_all(action='DESELECT')
    for obj in bpy.context.scene.objects:
        if obj.type in {'MESH','CURVE','FONT','SURFACE'} and not obj.hide_render and not obj.name.startswith('Studio'):
            obj.select_set(True)
            bpy.context.view_layer.objects.active=obj
    bpy.ops.object.convert(target='MESH')
    bpy.ops.export_scene.gltf(filepath=str(WEB/f'{path.name[:2]}.glb'),export_format='GLB',use_selection=True,export_apply=True,export_animations=False,export_cameras=False,export_lights=False,export_draco_mesh_compression_enable=True,export_draco_mesh_compression_level=7)
    print('WEB_CARD',path.name[:2],(WEB/f'{path.name[:2]}.glb').stat().st_size,flush=True)
