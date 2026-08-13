import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Resvg } from '@resvg/resvg-js';

const SOCIAL = new URL('..', import.meta.url).pathname;
const SOURCE = new URL('.', import.meta.url).pathname;
const PROFILE = join(SOCIAL, 'profile');
const BANNER = join(SOCIAL, 'banner');

mkdirSync(PROFILE, { recursive: true });
mkdirSync(BANNER, { recursive: true });

const asDataUri = (path: string) =>
  `data:image/png;base64,${readFileSync(path).toString('base64')}`;

const bee = asDataUri(join(SOURCE, 'bee-trimmed.png'));
const logo = asDataUri(join(SOURCE, 'logo.png'));

const fonts = `
  <style>
    .display { font-family: 'Arial Rounded MT Bold', 'Helvetica Neue', Arial, sans-serif; }
    .body { font-family: 'Helvetica Neue', Arial, sans-serif; }
  </style>`;

const profileSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <defs>${fonts}</defs>
  <rect width="1024" height="1024" fill="#FFDFB5"/>
  <image href="${bee}" x="127" y="197" width="770" height="630" preserveAspectRatio="xMidYMid meet"/>
</svg>`;

const bannerSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1500" height="500" viewBox="0 0 1500 500">
  <defs>${fonts}</defs>
  <rect width="1500" height="500" fill="#644A40"/>
  <circle cx="1240" cy="250" r="206" fill="#FFDFB5"/>
  <g transform="translate(300 56)">
    <image href="${logo}" x="0" y="0" width="54" height="54" preserveAspectRatio="xMidYMid meet"/>
    <text x="68" y="39" fill="#FFFFFF" font-size="32" font-weight="700" class="display">BeeGreat</text>
  </g>
  <text x="300" y="238" fill="#FFFFFF" font-size="82" font-weight="700" class="display">Be great</text>
  <text x="300" y="330" fill="#FFFFFF" font-size="82" font-weight="700" class="display">every day</text>
  <text x="304" y="405" fill="#EADDD6" font-size="28" font-weight="500" class="body">One clear next step at a time.</text>
  <image href="${bee}" x="1022" y="91" width="436" height="356" preserveAspectRatio="xMidYMid meet"/>
</svg>`;

function render(svg: string, output: string) {
  const png = new Resvg(svg, {
    fitTo: { mode: 'original' },
    font: { loadSystemFonts: true, defaultFontFamily: 'Helvetica Neue' },
  }).render().asPng();
  writeFileSync(output, png);
  console.log(output);
}

writeFileSync(join(SOURCE, 'beegreat-profile-monochrome.svg'), profileSvg);
writeFileSync(join(SOURCE, 'beegreat-x-banner.svg'), bannerSvg);
render(profileSvg, join(PROFILE, 'beegreat-bee-profile-monochrome.png'));
render(bannerSvg, join(BANNER, 'beegreat-x-banner.png'));
