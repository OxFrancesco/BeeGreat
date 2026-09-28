// Run with Bun from the repository root after `codeview setup dither-kit`.
import { paintColumn, resample } from '../../../../../../resources/dither-kit/registry/dither-kit/dither-paint.ts';
import { computeBands, buildYScale, buildBandScale } from '../../../../../../resources/dither-kit/registry/dither-kit/scales.ts';
import { fnv1a, xorshift32 } from '../../../../../../resources/dither-kit/registry/dither-kit/pixel.ts';
import { PALETTE } from '../../../../../../resources/dither-kit/registry/dither-kit/palette.ts';
const rows = [{a:10,b:5},{a:20,b:15},{a:30,b:10}];
const output = [];
for (const stack of ['default','stacked','percent']) {
  const bands = computeBands(rows, ['a','b'], stack);
  for (const key of ['a','b']) bands.bands[key].forEach((band,i) => output.push(['band', stack, key, i, ...band].join('\t')));
}
for (const [lo,hi] of [[0,97],[-60,240],[-30,0],[0,0],[0,0.00371]]) output.push(['scale',lo,hi,...buildYScale(lo,hi,200).domain()].join('\t'));
for (const variant of ['gradient','dotted','hatched','solid']) {
  const cells = new Map(); let fillStyle;
  const ctx = {set fillStyle(v) { fillStyle=v; }, fillRect(x,y) { const a=Number(fillStyle.match(/,([^,]+)\)$/)[1]); const previous=cells.get(`${x},${y}`) ?? 0; cells.set(`${x},${y}`,a+previous*(1-a)); }};
  paintColumn(ctx, 3, 2, 14, PALETTE.orange, {variant,intensity:0,dim:1,stacked:false});
  for (let y=0;y<16;y++) output.push(['column',variant,3,y,cells.get(`3,${y}`) ?? 0].join('\t'));
}
for (const name of ['Pecu','Francesco','😀']) {
 const seed=fnv1a(name), random=xorshift32(seed);
 output.push(['hash',name,seed,...Array.from({length:3},()=>random())].join('\t'));
}
output.push(['resample',...resample([2,7,3],7)].join('\t'));
await Bun.write(new URL('../src/test/resources/upstream.tsv',import.meta.url),output.join('\n')+'\n');
console.log(`Wrote ${output.length} upstream parity vectors`);
