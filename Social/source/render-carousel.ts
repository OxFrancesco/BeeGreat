import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Resvg } from '@resvg/resvg-js';

const ROOT = new URL('..', import.meta.url).pathname;
const SOURCE = new URL('.', import.meta.url).pathname;
const OUTPUT = join(ROOT, 'carousel');
const WIDTH = 1600;
const HEIGHT = 900;

mkdirSync(OUTPUT, { recursive: true });

const palette = {
  ink: '#202020',
  inkSoft: '#646464',
  canvas: '#F9F9F9',
  surface: '#FCFCFC',
  muted: '#EFEFEF',
  selected: '#E8E8E8',
  line: '#D8D8D8',
  brown: '#644A40',
  brownInk: '#FFFFFF',
  honey: '#FFDFB5',
  honeyStrong: '#F5BD62',
  honeyInk: '#582D1D',
  honeyTile: '#FFF0C2',
};

const files = {
  texture: join(SOURCE, 'cover-texture.png'),
  logo: join(SOURCE, 'logo.png'),
  bee: join(SOURCE, 'bee.png'),
  beeGreat: join(SOURCE, 'bee-great.png'),
  focus: join(SOURCE, 'screenshots/01-bee-focus-1320x2868.png'),
  goals: join(SOURCE, 'screenshots/02-goals-plan-1320x2868.png'),
  hive: join(SOURCE, 'screenshots/03-hive-progress-1320x2868.png'),
  voice: join(SOURCE, 'screenshots/04-voice-with-bee-1320x2868.png'),
  mind: join(SOURCE, 'screenshots/05-mind-bookmarks-1320x2868.png'),
};

function dataUri(path: string) {
  const ext = path.endsWith('.webp') ? 'webp' : 'png';
  return `data:image/${ext};base64,${readFileSync(path).toString('base64')}`;
}

const image = {
  texture: dataUri(files.texture),
  logo: dataUri(files.logo),
  bee: dataUri(files.bee),
  beeGreat: dataUri(files.beeGreat),
  focus: dataUri(files.focus),
  goals: dataUri(files.goals),
  hive: dataUri(files.hive),
  voice: dataUri(files.voice),
  mind: dataUri(files.mind),
};

function multiline(
  lines: string[],
  x: number,
  y: number,
  size: number,
  lineHeight: number,
  options: { fill?: string; weight?: number; family?: 'display' | 'body'; anchor?: 'start' | 'middle' } = {},
) {
  const fill = options.fill ?? palette.ink;
  const weight = options.weight ?? 600;
  const family = options.family === 'body' ? 'var(--body)' : 'var(--display)';
  const anchor = options.anchor ?? 'start';
  return `<text x="${x}" y="${y}" fill="${fill}" font-size="${size}" font-weight="${weight}" font-family="${family}" text-anchor="${anchor}">${lines
    .map((line, index) => `<tspan x="${x}" dy="${index === 0 ? 0 : lineHeight}">${line}</tspan>`)
    .join('')}</text>`;
}

function brand(page: number, dark = false, x = 92) {
  const ink = dark ? palette.brownInk : palette.ink;
  const soft = dark ? '#EADDD6' : palette.inkSoft;
  return `
    <g transform="translate(${x} 54)">
      <image href="${image.logo}" x="0" y="0" width="62" height="62" preserveAspectRatio="xMidYMid meet"/>
      <text x="74" y="45" fill="${ink}" font-size="36" font-weight="700" font-family="var(--display)">BeeGreat</text>
    </g>
    <text x="1560" y="96" fill="${soft}" font-size="24" font-weight="600" font-family="var(--body)" text-anchor="end">0${page} / 04</text>`;
}

function phone(id: string, href: string, x: number, y: number, width: number, height: number) {
  return `
    <g filter="url(#phoneShadow)">
      <rect x="${x - 7}" y="${y - 7}" width="${width + 14}" height="${height + 14}" rx="64" fill="#191919"/>
      <image href="${href}" x="${x}" y="${y}" width="${width}" height="${height}" preserveAspectRatio="xMidYMid slice" clip-path="url(#${id})"/>
      <rect x="${x}" y="${y}" width="${width}" height="${height}" rx="56" fill="none" stroke="#201E18" stroke-width="2"/>
    </g>
    <clipPath id="${id}"><rect x="${x}" y="${y}" width="${width}" height="${height}" rx="56"/></clipPath>`;
}

function hexBullet(x: number, y: number) {
  return `<path d="M${x + 13} ${y}h18l9 15.5-9 15.5H${x + 13}L${x + 4} ${y + 15.5}Z" fill="${palette.honeyTile}" stroke="${palette.honeyStrong}" stroke-width="1.5"/>`;
}

function base(content: string, background = palette.canvas, extraDefs = '') {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
    <defs>
      <style>
        :root { --display: 'Arial Rounded MT Bold', 'Helvetica Neue', Arial, sans-serif; --body: 'Helvetica Neue', Arial, sans-serif; }
      </style>
      <filter id="phoneShadow" x="-30%" y="-30%" width="160%" height="170%">
        <feDropShadow dx="0" dy="18" stdDeviation="24" flood-color="#4A2E20" flood-opacity=".16"/>
      </filter>
      <filter id="softShadow" x="-30%" y="-30%" width="160%" height="170%">
        <feDropShadow dx="0" dy="10" stdDeviation="18" flood-color="#4A2E20" flood-opacity=".10"/>
      </filter>
      ${extraDefs}
    </defs>
    <rect width="1600" height="900" fill="${background}"/>
    ${content}
  </svg>`;
}

const slides = [
  {
    filename: '01-meet-beegreat.png',
    svg: base(`
      <image href="${image.texture}" width="1600" height="900" preserveAspectRatio="xMidYMid slice" opacity=".82"/>
      <rect x="0" y="0" width="950" height="900" fill="${palette.canvas}" opacity=".45"/>
      ${brand(1)}
      <rect x="92" y="176" width="232" height="42" rx="21" fill="${palette.honey}"/>
      <text x="208" y="205" fill="${palette.honeyInk}" font-size="21" font-weight="700" font-family="var(--body)" text-anchor="middle">Your personal agent</text>
      ${multiline(['One clear', 'next step.'], 92, 333, 106, 104)}
      ${multiline(
        ['Tell Bee what you want to achieve.', 'Leave knowing exactly what to do next.'],
        98,
        590,
        32,
        46,
        { fill: palette.inkSoft, weight: 500, family: 'body' },
      )}
      <rect x="92" y="724" width="514" height="66" rx="33" fill="${palette.brown}"/>
      <text x="349" y="768" fill="${palette.brownInk}" font-size="25" font-weight="700" font-family="var(--body)" text-anchor="middle">Focus without the busywork</text>
      ${phone('coverPhone', image.focus, 1118, 80, 350, 760)}
      <image href="${image.bee}" x="870" y="565" width="292" height="292" preserveAspectRatio="xMidYMid meet"/>
    `),
  },
  {
    filename: '02-from-intention-to-plan.png',
    svg: base(`
      ${brand(2)}
      <path d="M725 120h730c38 0 68 30 68 68v604c0 38-30 68-68 68H725Z" fill="${palette.honey}" opacity=".72"/>
      ${multiline(['Say it once.', 'Bee shapes', 'the plan.'], 92, 220, 68, 70)}
      ${multiline(
        ['Talk or type naturally. Bee turns an intention', 'into one goal, one project, and a clear Highlight.'],
        98,
        430,
        27,
        40,
        { fill: palette.inkSoft, weight: 500, family: 'body' },
      )}
      <g transform="translate(98 575)">
        ${hexBullet(0, 0)}
        <text x="60" y="25" fill="${palette.ink}" font-size="25" font-weight="600" font-family="var(--body)">Talk or type with Bee</text>
        ${hexBullet(0, 66)}
        <text x="60" y="91" fill="${palette.ink}" font-size="25" font-weight="600" font-family="var(--body)">Review the plan before it is created</text>
        ${hexBullet(0, 132)}
        <text x="60" y="157" fill="${palette.ink}" font-size="25" font-weight="600" font-family="var(--body)">Start with today’s one Highlight</text>
      </g>
      ${phone('focusPhone', image.focus, 810, 145, 310, 673)}
      ${phone('goalsPhone', image.goals, 1173, 145, 310, 673)}
    `),
  },
  {
    filename: '03-progress-you-can-feel.png',
    svg: base(`
      <rect x="0" y="0" width="612" height="900" fill="#F4EDE6"/>
      <path d="M0 744C210 676 379 710 612 603V900H0Z" fill="${palette.honey}" opacity=".76"/>
      ${brand(3, false, 704)}
      ${phone('hivePhone', image.hive, 144, 94, 360, 782)}
      ${multiline(['Progress you', 'can actually feel.'], 704, 230, 74, 80)}
      ${multiline(
        ['Complete your Highlight and the whole system', 'responds—your Hive, Honey, score, and GolieBee.'],
        710,
        425,
        28,
        41,
        { fill: palette.inkSoft, weight: 500, family: 'body' },
      )}
      <g transform="translate(710 568)">
        <rect width="242" height="142" rx="28" fill="${palette.honey}"/>
        <text x="28" y="46" fill="${palette.honeyInk}" font-size="22" font-weight="600" font-family="var(--body)">Honey</text>
        <text x="28" y="108" fill="${palette.honeyInk}" font-size="54" font-weight="700" font-family="var(--display)">+5</text>
        <rect x="264" width="288" height="142" rx="28" fill="${palette.surface}" stroke="${palette.line}" stroke-width="2"/>
        <text x="292" y="46" fill="${palette.inkSoft}" font-size="22" font-weight="600" font-family="var(--body)">Honeycomb Score</text>
        <text x="292" y="108" fill="${palette.ink}" font-size="54" font-weight="700" font-family="var(--display)">+1</text>
        <rect x="574" width="214" height="142" rx="28" fill="${palette.surface}" stroke="${palette.line}" stroke-width="2"/>
        <image href="${image.beeGreat}" x="592" y="15" width="92" height="92" preserveAspectRatio="xMidYMid meet"/>
        <text x="685" y="68" fill="${palette.ink}" font-size="22" font-weight="700" font-family="var(--body)">GolieBee</text>
        <text x="685" y="99" fill="${palette.inkSoft}" font-size="19" font-weight="500" font-family="var(--body)">grows with you</text>
      </g>
      <text x="710" y="795" fill="${palette.brown}" font-size="28" font-weight="700" font-family="var(--display)">Do the work. Watch the Hive fill.</text>
    `),
  },
  {
    filename: '04-your-system-in-your-pocket.png',
    svg: base(`
      ${brand(4)}
      <rect x="66" y="134" width="764" height="706" rx="44" fill="${palette.surface}" stroke="${palette.line}" stroke-width="2"/>
      <rect x="350" y="152" width="440" height="670" rx="40" fill="${palette.honey}" opacity=".54"/>
      ${phone('voicePhone', image.voice, 116, 168, 288, 625)}
      ${phone('mindPhone', image.mind, 505, 168, 288, 625)}
      ${multiline(['Your whole system,', 'in your pocket.'], 914, 220, 65, 72)}
      <g transform="translate(914 398)">
        ${hexBullet(0, 0)}
        <text x="62" y="25" fill="${palette.ink}" font-size="25" font-weight="600" font-family="var(--body)">Talk or type with Bee</text>
        ${hexBullet(0, 62)}
        <text x="62" y="87" fill="${palette.ink}" font-size="25" font-weight="600" font-family="var(--body)">Plan goals and Highlights</text>
        ${hexBullet(0, 124)}
        <text x="62" y="149" fill="${palette.ink}" font-size="25" font-weight="600" font-family="var(--body)">Grow your Hive and GolieBees</text>
        ${hexBullet(0, 186)}
        <text x="62" y="211" fill="${palette.ink}" font-size="25" font-weight="600" font-family="var(--body)">Save sites, posts, and videos to Mind</text>
        ${hexBullet(0, 248)}
        <text x="62" y="273" fill="${palette.ink}" font-size="25" font-weight="600" font-family="var(--body)">Track mood, water, and journal entries</text>
        ${hexBullet(0, 310)}
        <text x="62" y="335" fill="${palette.ink}" font-size="25" font-weight="600" font-family="var(--body)">Connect power-ups and work tools</text>
      </g>
      <rect x="914" y="784" width="508" height="3" rx="2" fill="${palette.honeyStrong}"/>
      <text x="914" y="833" fill="${palette.brown}" font-size="27" font-weight="700" font-family="var(--display)">One calm place to move forward.</text>
    `),
  },
];

for (const [index, slide] of slides.entries()) {
  const svgPath = join(SOURCE, `${String(index + 1).padStart(2, '0')}-${slide.filename.replace(/\.png$/, '')}.svg`);
  const outputPath = join(OUTPUT, slide.filename);
  const normalizedSvg = slide.svg
    .replaceAll('var(--display)', "'Arial Rounded MT Bold', 'Helvetica Neue', Arial, sans-serif")
    .replaceAll('var(--body)', "'Helvetica Neue', Arial, sans-serif");
  writeFileSync(svgPath, normalizedSvg);
  const rendered = new Resvg(normalizedSvg, {
    fitTo: { mode: 'width', value: WIDTH },
    font: { loadSystemFonts: true, defaultFontFamily: 'Helvetica Neue' },
  }).render();
  writeFileSync(outputPath, rendered.asPng());
  console.log(outputPath);
}
