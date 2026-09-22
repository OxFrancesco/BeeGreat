"""Render the existing 30 scenes with transparent surroundings, preserving their artwork."""
import bpy, sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'output/blender/pecu-claim-cards-20260922'
ids=set(sys.argv[sys.argv.index('--')+1:]) if '--' in sys.argv else set()
for path in sorted((OUT/'blends').glob('*.blend')):
    if ids and path.name[:2] not in ids:continue
    bpy.ops.wm.open_mainfile(filepath=str(path))
    scene=bpy.context.scene
    bpy.data.objects['Studio · seamless ivory'].hide_render=True
    scene.render.film_transparent=True
    scene.render.image_settings.color_mode='RGBA'
    scene.render.filepath=str(OUT/'renders'/f'{scene["card_id"]}.png')
    bpy.ops.wm.save_as_mainfile(filepath=str(path),compress=True)
    bpy.ops.render.render(write_still=True)
    print('TRANSPARENT_CARD',scene['card_id'],flush=True)
