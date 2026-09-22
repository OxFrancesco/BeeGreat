from pathlib import Path
import json,shutil,zipfile,html,subprocess
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'output/blender/pecu-claim-cards-20260922'
WEB=OUT/'public/pecu/blender-cards-20260922'
WEB.mkdir(parents=True,exist_ok=True)
concepts=json.loads((ROOT/'output/imagegen/pecu-claim-cards-20260922/prompts.json').read_text())['concepts']
files=sorted((OUT/'blends').glob('*.blend'))
assert len(files)==30
for p in files:shutil.copy2(p,WEB/p.name)
for ident,name,_ in concepts:
    shutil.copy2(OUT/'renders'/f'{ident}.png',WEB/f'{ident}.png')
    subprocess.run(['magick',str(WEB/f'{ident}.png'),'-resize','540x720',str(WEB/f'{ident}.webp')],check=True)
for start in range(0,30,5):
    with zipfile.ZipFile(WEB/f'cards-{start+1:02}-{start+5:02}.zip','w',zipfile.ZIP_DEFLATED) as z:
        for p in files[start:start+5]:
            z.write(p,p.name)
with zipfile.ZipFile(WEB/'modeling-source.zip','w',zipfile.ZIP_DEFLATED) as z:
    for p in (ROOT/'tools/pecu-cards').iterdir():
        if p.suffix in ['.py','.md']:z.write(p,p.name)
report='''# Pecu Blender cards

30 editable Blender scenes, with 1080 × 1440 Cycles renders. Each scene contains the original Pecu character, a modeled clay card, and theme-specific props. The concept image is packed for reference; visible artwork uses geometry and procedural materials.

Open a .blend file, use Numpad 0 for the camera, and F12 to render. Select named objects to edit props, materials, lighting, or the mascot. Fonts are packed. The source generator expects the original Pecu idle.blend and numbered concept images at the repository paths shown in build.py.

Validation reopens every file, checks scene identity, editable geometry, packed reference/font assets, render dimensions, and canonical shell/coin geometry. This delivery contains artwork; it does not implement X authentication or claiming.
'''
(OUT/'report.md').write_text(report);(WEB/'report.md').write_text(report)
shutil.copy2(OUT/'validation.json',WEB/'validation.json')
items=[]
for (ident,name,_),p in zip(concepts,files):
    items.append(f'<article id="card-{ident}"><a href="{ident}.png" aria-label="Enlarge {html.escape(name)}"><img src="{ident}.webp" width="540" height="720" loading="lazy" alt="{ident} {html.escape(name)} — Blender render"></a><div><h2>{ident} · {html.escape(name)}</h2><a href="{p.name}" download>Blender file ↓</a></div></article>')
shutil.copy2(OUT/'pecu-all-30.blend',WEB/'pecu-all-30.blend')
links='<a href="pecu-all-30.blend" download>All 30 · Blender project ↓</a>'+''.join(f'<a href="cards-{i+1:02}-{i+5:02}.zip" download>Cards {i+1:02}–{i+5:02} ↓</a>' for i in range(0,30,5))
page='''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Pecu · Blender cards</title><style>
*{box-sizing:border-box;scrollbar-width:none}*::-webkit-scrollbar{display:none}body{margin:0;background:#f9f9f9;color:#202020;font:16px Georgia,serif}main{max-width:1560px;margin:auto;padding:40px 28px}h1{font-size:30px;margin:0 0 12px}p{max-width:650px;line-height:1.6;color:#646464}nav{display:flex;flex-wrap:wrap;gap:8px 24px;margin:20px 0 32px}a{color:inherit;text-underline-offset:4px}nav a{padding:12px 0}section{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:36px 24px}article img{display:block;width:100%;height:auto;border-radius:8px}article div{padding:12px 0;display:flex;justify-content:space-between;align-items:baseline;gap:12px}h2{font-size:16px;margin:0;font-weight:normal}article div a{font-size:14px;white-space:nowrap}footer{display:flex;gap:24px;margin-top:36px}a:focus-visible{outline:2px solid #61422d;outline-offset:5px}@media(max-width:1050px){section{grid-template-columns:repeat(2,minmax(0,1fr))}article div{display:block}article div a{display:inline-block;margin-top:12px}}@media(max-width:600px){main{padding:28px 16px}section{grid-template-columns:1fr}h1{font-size:26px}footer{flex-wrap:wrap}}
</style><main><h1>Pecu · Blender cards</h1><p>All 30 cards modeled in Blender. Open a render to inspect it, or download the editable scene. The scenes include Pecu, props, lighting, and cameras. Individual files also include the original concept reference.</p><nav>'''+links+'''</nav><section>'''+''.join(items)+'''</section><footer><a href="modeling-source.zip">Modeling source</a><a href="report.md">Delivery notes</a><a href="validation.json">Validation</a><a href="collection.mp4">Collection video</a></footer></main></html>'''
(WEB/'index.html').write_text(page)
config={'name':'pecu-blender-cards-20260922','account_id':'157a8b025a13404b16f11ad7078e53f1','compatibility_date':'2026-09-22','workers_dev':False,'preview_urls':False,'routes':[{'pattern':'reports.buddytools.org/pecu/blender-cards-20260922*','zone_id':'68f510acd198c98385d82fa528198af5'}],'assets':{'directory':'./public','html_handling':'auto-trailing-slash','not_found_handling':'none'}}
(OUT/'wrangler.jsonc').write_text(json.dumps(config,indent=2))
for p in WEB.iterdir():assert p.stat().st_size<25*1024*1024,(p,p.stat().st_size)
print('PACKAGED',len(files))
