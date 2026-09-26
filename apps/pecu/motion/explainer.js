// Deterministic timeline for the Pecu explainer. `window.__seek(t)` renders any
// moment exactly (used by render.ts); without `?render` it plays in real time.
(() => {
  const DURATION = 70;
  const stage = document.getElementById("stage");
  const rendering = new URLSearchParams(location.search).has("render");
  if (rendering) document.documentElement.classList.add("render");

  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const outQuint = (p) => 1 - (1 - p) ** 5;
  const outBack = (p) => { const c = 1.6; return 1 + (c + 1) * (p - 1) ** 3 + c * (p - 1) ** 2; };

  const scenes = [...document.querySelectorAll(".scene")].map((el) => ({
    el,
    start: Number(el.dataset.start),
    end: Number(el.dataset.end),
    step: Number(el.dataset.step || 0),
    items: [...el.querySelectorAll(".a")],
    videos: [...el.querySelectorAll("video")],
    counters: [...el.querySelectorAll("[data-count]")],
  }));

  // Measure natural heights of chat messages while every scene is laid out.
  scenes.forEach((s) => { s.el.style.visibility = "visible"; });
  const heights = new Map();
  document.querySelectorAll('[data-fx="grow"]').forEach((el) => heights.set(el, el.offsetHeight));
  scenes.forEach((s) => { s.el.style.visibility = ""; });

  const DUR = { up: 0.8, left: 0.9, right: 0.9, pop: 0.6, fade: 0.8, grow: 0.5 };

  function applyItem(el, lt) {
    const fx = el.dataset.fx || "up";
    const tIn = Number(el.dataset.in || 0);
    const p = clamp((lt - tIn) / DUR[fx]);
    const out = el.dataset.out ? clamp((lt - Number(el.dataset.out)) / 0.2) : 0;
    const e = outQuint(p);
    let opacity = clamp(p * 1.6) * (1 - out);
    let transform = "";
    switch (fx) {
      case "up": transform = `translateY(${(1 - e) * 48}px)`; break;
      case "left": transform = `translateX(${(1 - e) * -120}px)`; break;
      case "right": transform = `translateX(${(1 - e) * 120}px)`; break;
      case "pop": transform = `scale(${0.82 + 0.18 * outBack(p)})`; break;
      case "fade": break;
      case "grow": {
        const h = heights.get(el) || 0;
        const g = e * (1 - outQuint(out));
        el.style.height = `${h * g}px`;
        el.style.marginTop = `${18 * g}px`;
        el.style.paddingTop = el.style.paddingBottom = g < 1 ? `${Math.min(20, h / 2) * g}px` : "";
        transform = `translateY(${(1 - e) * 24}px) scale(${0.94 + 0.06 * e})`;
        opacity = clamp(p * 2) * (1 - out);
        break;
      }
    }
    el.style.opacity = String(opacity);
    el.style.transform = transform;
  }

  function sceneOpacity(s, t, i) {
    const fadeIn = i === 0 ? 1 : clamp((t - s.start) / 0.45);
    const fadeOut = i === scenes.length - 1 ? 1 : clamp((s.end - t) / 0.4);
    return Math.min(fadeIn, fadeOut);
  }

  const hooks = {
    counters(s, lt) {
      s.counters.forEach((el) => {
        const [start, dur, from, to, dec] = el.dataset.count.split(",").map(Number);
        const v = from + (to - from) * outQuint(clamp((lt - start) / dur));
        el.textContent = v.toFixed(dec);
      });
    },
    typing(s, lt) {
      s.el.querySelectorAll(".typing i").forEach((dot, k) => {
        dot.style.transform = `translateY(${Math.sin(lt * 9 - k * 0.9) * -6}px)`;
      });
    },
    confirm(s, lt) {
      const expiry = s.el.querySelector("#expiry");
      if (!expiry) return;
      const left = Math.max(0, 600 - Math.max(0, Math.floor(lt - 2)));
      expiry.textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`;
      const spin = s.el.querySelector(".spinner");
      spin.style.transform = `rotate(${lt * 400}deg)`;
      const done = clamp((lt - 6.8) / 0.4);
      s.el.querySelector(".state.pending").style.opacity = String(1 - done);
      const doneEl = s.el.querySelector(".state.done");
      doneEl.style.opacity = String(done);
      doneEl.style.transform = `scale(${0.9 + 0.1 * outBack(done)})`;
      s.el.querySelector(".status .link").style.opacity = String(clamp((lt - 7.1) / 0.4));
    },
  };

  const chrome = document.querySelector(".chrome");
  const progress = document.getElementById("progress");
  const steps = [...progress.children];

  function render(t) {
    scenes.forEach((s, i) => {
      const visible = t >= s.start && t < s.end + (i === scenes.length - 1 ? 1 : 0);
      s.el.style.visibility = visible ? "visible" : "hidden";
      if (!visible) return;
      const lt = t - s.start;
      s.el.style.opacity = String(sceneOpacity(s, t, i));
      s.items.forEach((el) => applyItem(el, lt));
      hooks.counters(s, lt);
      hooks.typing(s, lt);
      hooks.confirm(s, lt);
    });

    const [a, b] = chrome.dataset.sceneRange.split(",").map(Number);
    chrome.style.opacity = String(Math.min(clamp((t - a) / 0.5), clamp((b - t) / 0.4)));

    const active = scenes.find((s) => t >= s.start && t < s.end);
    const stepScenes = scenes.filter((s) => s.step);
    const first = stepScenes[0].start, last = stepScenes[stepScenes.length - 1].end;
    progress.style.opacity = String(Math.min(clamp((t - first) / 0.5), clamp((last - t) / 0.4)));
    const current = active && active.step ? active.step : 0;
    steps.forEach((el, k) => {
      el.classList.toggle("on", k + 1 === current);
      el.classList.toggle("done", k + 1 < current);
    });
  }

  function videoTarget(v, lt) {
    if (v.dataset.clip) { const [a, b] = v.dataset.clip.split(",").map(Number); return clamp(lt, a, b); }
    const loop = Number(v.dataset.loop);
    return lt % (loop - 0.04);
  }

  function seekVideo(v, time) {
    if (Math.abs(v.currentTime - time) < 1e-3 && v.readyState >= 2) return Promise.resolve();
    return new Promise((resolve) => {
      v.addEventListener("seeked", () => resolve(), { once: true });
      v.currentTime = time;
    });
  }

  const nextFrame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

  window.__duration = DURATION;
  window.__ready = Promise.all([
    document.fonts.ready,
    ...[...document.querySelectorAll("video")].map((v) => v.readyState >= 2 ? null :
      new Promise((r) => v.addEventListener("loadeddata", r, { once: true }))),
    ...[...document.images].map((img) => img.decode().catch(() => {})),
  ]);
  window.__seek = async (t) => {
    render(t);
    const waits = [];
    scenes.forEach((s) => {
      if (t < s.start || t >= s.end + 1) return;
      s.videos.forEach((v) => { v.pause(); waits.push(seekVideo(v, videoTarget(v, t - s.start))); });
    });
    await Promise.all(waits);
    await nextFrame();
  };

  if (rendering) return;

  const fit = () => { stage.style.transform = `scale(${Math.min(innerWidth / 1920, innerHeight / 1080)})`; };
  addEventListener("resize", fit);
  fit();

  const scrubber = document.getElementById("scrubber");
  const clock = document.getElementById("clock");
  let origin = performance.now();
  let paused = false;
  let pausedAt = 0;
  const now = () => paused ? pausedAt : ((performance.now() - origin) / 1000) % DURATION;
  const jump = (t) => { origin = performance.now() - t * 1000; pausedAt = t; };

  scrubber.addEventListener("input", () => jump(Number(scrubber.value)));
  addEventListener("keydown", (e) => {
    if (e.code !== "Space") return;
    e.preventDefault();
    if (paused) { jump(pausedAt); paused = false; } else { pausedAt = now(); paused = true; }
  });

  function tick() {
    const t = now();
    render(t);
    scenes.forEach((s) => {
      const on = t >= s.start && t < s.end + 1;
      s.videos.forEach((v) => {
        if (!on || paused) { v.pause(); if (paused && on) v.currentTime = videoTarget(v, t - s.start); return; }
        const target = videoTarget(v, t - s.start);
        if (Math.abs(v.currentTime - target) > 0.25) v.currentTime = target;
        if (v.dataset.clip && target >= Number(v.dataset.clip.split(",")[1])) v.pause();
        else if (v.paused) v.play().catch(() => {});
      });
    });
    scrubber.value = String(t);
    clock.textContent = `${t.toFixed(1)}s`;
    requestAnimationFrame(tick);
  }
  window.__ready.then(() => requestAnimationFrame(tick));
})();
