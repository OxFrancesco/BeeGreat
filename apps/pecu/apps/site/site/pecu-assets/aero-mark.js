// Browser port of AeroMark from @beegreat/sugar src/tui/logo.tsx: the same six
// ribbons on a half-block grid, intro streak, stagger, easing and sweep. Colors
// come from theme/aero.css.
const ROWS = 6;
const TIP = (ROWS - 1) / 2;
const SWEEP = 1.4;
const WIDTH = 22;
const FRAME_MS = 40;
const STAGGER_FRAMES = 3;
const INTRO_FRAMES = 18;
const SWEEP_FRAMES = 30;
const SWEEP_EVERY_MS = 6000;
const RIBBON_PITCH = 3;
const RIBBON_THICKNESS = 2;
const COLUMNS = WIDTH * 2;
const CONTENT_ROWS = ROWS * RIBBON_PITCH - 1;

const easeOut = (t) => 1 - (1 - t) ** 3;
const leftEdge = (row) => SWEEP * Math.abs(row - TIP) ** 1.5;
const rightEdge = (row) => leftEdge(row) + 9 + leftEdge(row) * 0.35;
const revealEdge = (row, frame) =>
  WIDTH * (1 - easeOut(Math.min(1, Math.max(0, frame - row * STAGGER_FRAMES) / INTRO_FRAMES)));
const covered = (column, start, end) => Math.min(column / 2 + 0.5, end) - Math.max(column / 2, start) >= 0.25;

const idleColumns = Array.from({ length: COLUMNS }, (_, column) => column).filter((column) =>
  Array.from({ length: ROWS }, (_, row) => row).some((row) => covered(column, leftEdge(row), rightEdge(row))),
);
const firstColumn = idleColumns[0];
const contentColumns = idleColumns.at(-1) - firstColumn + 1;

const lighten = ([r, g, b], amount) => {
  const mix = (value) => Math.round(value + (255 - value) * Math.min(1, Math.max(0, amount)));
  return `rgb(${mix(r)} ${mix(g)} ${mix(b)})`;
};

function cellColor(base, row, column, phase) {
  if (phase.mode === 'intro') {
    const distance = column - revealEdge(row, phase.frame);
    if (distance < 3) return lighten(base, 0.7 - distance * 0.2);
  } else if (phase.mode === 'sweep') {
    const position = (phase.frame / SWEEP_FRAMES) * (WIDTH + ROWS * 2) - ROWS;
    const distance = Math.abs(column - row * 0.8 - position);
    if (distance < 2.5) return lighten(base, 0.55 * (1 - distance / 2.5));
  }
  return lighten(base, 0);
}

const canvas = document.querySelector('.aero-mark canvas');
const tile = canvas?.closest('.aero');
if (canvas && tile) {
  const context = canvas.getContext('2d');
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
  let colors = [];
  let phase = { mode: reduceMotion.matches ? 'idle' : 'intro', frame: 0 };
  let introDone = reduceMotion.matches;
  let visible = !('IntersectionObserver' in window);
  let seen = false;
  let frame = 0;
  let timer = 0;
  let startedAt = 0;

  const readColors = () => {
    const style = getComputedStyle(canvas);
    colors = Array.from({ length: ROWS }, (_, row) => {
      const hex = style.getPropertyValue(`--aero-ribbon-${row + 1}`).trim().slice(1);
      return [0, 2, 4].map((offset) => parseInt(hex.slice(offset, offset + 2), 16));
    });
  };

  const paint = () => {
    const width = canvas.width;
    const height = canvas.height;
    context.clearRect(0, 0, width, height);
    const unit = Math.max(1, Math.floor(Math.min((width * 0.46) / contentColumns, (height * 0.62) / (CONTENT_ROWS * 2))));
    const originX = Math.round((width - contentColumns * unit) / 2) - firstColumn * unit;
    const originY = Math.round((height - CONTENT_ROWS * 2 * unit) / 2);
    for (let row = 0; row < ROWS; row++) {
      const start = Math.max(leftEdge(row), phase.mode === 'intro' ? revealEdge(row, phase.frame) : 0);
      const end = rightEdge(row);
      const y = originY + row * RIBBON_PITCH * 2 * unit;
      for (let column = 0; column < COLUMNS; column++) {
        if (!covered(column, start, end)) continue;
        context.fillStyle = cellColor(colors[row], row, Math.floor(column / 2), phase);
        context.fillRect(originX + column * unit, y, unit, RIBBON_THICKNESS * 2 * unit);
      }
    }
  };

  const canAnimate = () => !reduceMotion.matches && visible && !document.hidden;

  const stop = () => {
    const interrupted = frame !== 0;
    cancelAnimationFrame(frame);
    clearTimeout(timer);
    frame = 0;
    timer = 0;
    if (phase.mode === 'idle' || (!interrupted && !reduceMotion.matches)) return;
    introDone = true;
    phase = { mode: 'idle', frame: 0 };
    paint();
  };

  const schedule = (delay = SWEEP_EVERY_MS) => {
    clearTimeout(timer);
    timer = canAnimate()
      ? setTimeout(() => {
          timer = 0;
          run(introDone ? 'sweep' : 'intro');
        }, delay)
      : 0;
  };

  const tick = (now) => {
    const elapsed = Math.max(0, now - startedAt) / FRAME_MS;
    const length = phase.mode === 'intro' ? INTRO_FRAMES + ROWS * STAGGER_FRAMES : SWEEP_FRAMES;
    if (elapsed < length) {
      phase = { mode: phase.mode, frame: elapsed };
      paint();
      frame = requestAnimationFrame(tick);
      return;
    }
    frame = 0;
    introDone = true;
    phase = { mode: 'idle', frame: 0 };
    paint();
    schedule();
  };

  const run = (mode) => {
    if (!canAnimate()) return;
    cancelAnimationFrame(frame);
    clearTimeout(timer);
    timer = 0;
    phase = { mode, frame: 0 };
    startedAt = performance.now();
    frame = requestAnimationFrame(tick);
  };

  const resize = () => {
    const box = canvas.getBoundingClientRect();
    canvas.width = Math.round(box.width * devicePixelRatio);
    canvas.height = Math.round(box.height * devicePixelRatio);
    readColors();
    paint();
  };

  const sync = () => {
    if (!canAnimate()) return stop();
    if (frame || timer) return;
    schedule(introDone ? SWEEP_EVERY_MS : seen ? 0 : 240);
    seen = true;
  };

  new ResizeObserver(resize).observe(canvas);
  if (!visible) {
    new IntersectionObserver((entries) => {
      const entry = entries.at(-1);
      visible = entry.isIntersecting && entry.intersectionRatio >= 0.35;
      sync();
    }, { threshold: 0.35 }).observe(canvas);
  }
  tile.addEventListener('pointerenter', () => {
    if (finePointer.matches && introDone && phase.mode === 'idle') run('sweep');
  });
  reduceMotion.addEventListener('change', sync);
  document.addEventListener('visibilitychange', sync);
  resize();
  sync();
}
