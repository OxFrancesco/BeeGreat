const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
if (!reduceMotion.matches) document.documentElement.classList.add('motion-ready');

// Both mascot clips need transparency. Safari cannot play VP9 alpha, so it gets
// HEVC with alpha; everyone else gets the WebM. <source> order cannot be trusted
// because Safari claims VP9 support but drops the alpha channel.
const probe = document.createElement('video');
const safari = /apple/i.test(navigator.vendor) && !/crios|fxios|edgios/i.test(navigator.userAgent);
const hevc = probe.canPlayType('video/mp4; codecs="hvc1.1.6.L93.B0"');
const webm = probe.canPlayType('video/webm; codecs="vp9"');
const pickSource = (video) => (safari && hevc ? video.dataset.hevc : webm ? video.dataset.webm : null);

// Bento tiles rise in once, staggered by their --i index, when 12% visible.
const tiles = document.querySelectorAll('.bento');
if ('IntersectionObserver' in window && !reduceMotion.matches) {
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add('arriving');
      observer.unobserve(entry.target);
    }
  }, { threshold: 0.12 });
  for (const tile of tiles) observer.observe(tile);
} else {
  for (const tile of tiles) tile.classList.add('arriving');
}

// Hero reveal: plays once and holds its last frame. Reduced motion, a missing
// alpha codec, autoplay refusal and playback errors all fall back to the poster.
const stage = document.querySelector('.stage');
const reveal = stage.querySelector('.reveal');
const still = stage.querySelector('.reveal-still');
const showStill = () => {
  still.hidden = false;
  stage.classList.add('is-still');
};
const revealSource = pickSource(reveal);
if (reduceMotion.matches || !revealSource) {
  showStill();
} else {
  reveal.addEventListener('error', showStill);
  reveal.src = revealSource;
  const attempt = reveal.play();
  if (attempt) attempt.catch(showStill);
}

// Idle snail on the agent tile. The poster stays until frames flow.
const snail = document.querySelector('.snail');
const loop = snail?.querySelector('.snail-loop');
let snailVisible = !('IntersectionObserver' in window);
const loopSource = loop ? pickSource(loop) : null;
const syncPlayback = () => {
  document.documentElement.classList.toggle('motion-ready', !reduceMotion.matches);
  if (reduceMotion.matches || document.hidden) {
    reveal.pause();
    if (reduceMotion.matches) showStill();
  } else if (revealSource && !reveal.ended && !stage.classList.contains('is-still')) {
    reveal.play()?.catch(showStill);
  }
  if (!loop || !loopSource) return;
  if (reduceMotion.matches || document.hidden || !snailVisible) {
    loop.pause();
    if (reduceMotion.matches) snail.classList.remove('is-live');
    return;
  }
  if (!loop.getAttribute('src')) {
    loop.src = loopSource;
    loop.load();
  }
  loop.play()?.catch(() => snail.classList.remove('is-live'));
};
if (loop && loopSource) {
  loop.addEventListener('playing', () => {
    if (!reduceMotion.matches) snail.classList.add('is-live');
  });
  loop.addEventListener('error', () => snail.classList.remove('is-live'));
  if ('IntersectionObserver' in window) {
    const watcher = new IntersectionObserver((entries) => {
      snailVisible = entries.some((entry) => entry.isIntersecting);
      syncPlayback();
    }, { threshold: 0.2 });
    watcher.observe(snail);
  }
}
reduceMotion.addEventListener('change', syncPlayback);
document.addEventListener('visibilitychange', syncPlayback);
syncPlayback();
