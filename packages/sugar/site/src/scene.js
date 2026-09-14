import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createCollisionGuard } from './scene-collisions.js';
import { applyCoinFlip, applyChartHeight, ease } from './scene-motion.js';

const host = document.querySelector('.scene-view');
const controlsBar = document.querySelector('.scene-controls');
const status = document.querySelector('#scene-status');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(-2.725, 2.725, 2.725, -2.725, .1, 100);
camera.position.set(-2.7, 5.3, 12);
const initialPosition = camera.position.clone();
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' });
} catch {
  status.textContent = '3D is unavailable in this browser. The Blender render is shown instead.';
}
if (renderer) initialize().catch(() => {
  renderer.dispose();
  renderer.domElement.remove();
  host.classList.remove('scene-ready');
  controlsBar.hidden = true;
  status.textContent = '3D could not load. The Blender render is shown instead.';
});

async function initialize() {
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const canvas = renderer.domElement;
  canvas.tabIndex = 0;
  canvas.setAttribute('role', 'img');
  host.append(canvas);
  const orbit = new OrbitControls(camera, canvas);
  const mobileInteraction = matchMedia('(max-width: 760px), (pointer: coarse)');
  const syncRotation = () => {
    orbit.enabled = !mobileInteraction.matches;
    canvas.style.touchAction = mobileInteraction.matches ? 'auto' : 'none';
    canvas.classList.toggle('rotation-disabled', mobileInteraction.matches);
    controlsBar.querySelector('span').textContent = mobileInteraction.matches ? 'Tap an object.' : 'Drag to rotate. Tap an object.';
    canvas.setAttribute('aria-label', `Interactive Aero clay scene. ${mobileInteraction.matches ? 'Use arrow keys to rotate.' : 'Drag or use arrow keys to rotate.'} Use the buttons below to animate objects.`);
  };
  syncRotation();
  mobileInteraction.addEventListener('change', syncRotation);
  orbit.target.set(-.12, 1.44, 0);
  orbit.enablePan = false;
  orbit.enableZoom = false;
  orbit.enableDamping = false;
  orbit.rotateSpeed = .65;
  orbit.minPolarAngle = .35;
  orbit.maxPolarAngle = Math.PI / 2 + .12;
  orbit.update();
  scene.add(new THREE.HemisphereLight(0xf1f4ff, 0x7184b1, 2.2));
  const key = new THREE.DirectionalLight(0xfff9ef, 3.1);
  key.position.set(-3, 7, 4);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -5; key.shadow.camera.right = 5;
  key.shadow.camera.top = 5; key.shadow.camera.bottom = -5;
  key.shadow.normalBias = .025; key.shadow.bias = -.0001;
  key.shadow.radius = 4;
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xc5d7ff, 1.4);
  fill.position.set(4, 3, -2); scene.add(fill);
  const gltf = await new GLTFLoader().loadAsync('/aero-scene.glb');
  const model = gltf.scene;
  scene.add(model);
  const coins = [], bars = [], prompts = [], obstacles = [];
  model.traverse((object) => {
    if (object.isMesh) { object.castShadow = true; object.receiveShadow = true; }
    if (object.userData.action === 'coin') coins.push(object);
    if (object.name.startsWith('Chart_column')) bars.push(object);
    if (object.name.startsWith('Prompt_')) prompts.push(object);
    if (/^(Monitor_body|Rounded_display_plinth|Chart_column)/.test(object.name)) obstacles.push(object);
  });
  const collisions = createCollisionGuard(coins, obstacles);
  collisions.resolve();
  const coinOrigins = coins.map((coin) => ({ quaternion: coin.quaternion.clone(), position: coin.position.clone() }));
  const barOrigins = bars.map((bar) => ({ scale: bar.scale.clone(), position: bar.position.clone(), height: new THREE.Box3().setFromObject(bar).getSize(new THREE.Vector3()).y }));
  const markCanvas = document.createElement('canvas');
  markCanvas.width = 528; markCanvas.height = 408;
  const context = markCanvas.getContext('2d');
  const texture = new THREE.CanvasTexture(markCanvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(1.64, 1.40), new THREE.MeshBasicMaterial({ map: texture }));
  screen.position.set(-.62, 1.86, .043);
  screen.visible = false;
  screen.name = 'Aero_animation'; scene.add(screen);
  const jobs = new Map();
  let frame = 0, visible = true, chartRaised = false;
  const draw = () => { collisions.resolve(); renderer.render(scene, camera); };
  const tick = (now) => {
    frame = 0;
    if (!visible || document.hidden) return;
    for (const [name, job] of jobs) {
      const progress = Math.min(1, (now - job.start) / job.duration);
      job.update(progress);
      if (progress === 1) { jobs.delete(name); job.done?.(); }
    }
    draw();
    if (jobs.size) frame = requestAnimationFrame(tick);
  };
  const wake = () => { if (!frame && visible && !document.hidden) frame = requestAnimationFrame(tick); };
  const animate = (name, duration, update, done) => {
    jobs.set(name, { start: performance.now(), duration: reducedMotion.matches ? 1 : duration, update, done });
    wake();
  };
  function flip(selected = coins) {
    if (jobs.has('coins')) return;
    animate('coins', 1100, (t) => {
      applyCoinFlip(coins, coinOrigins, selected, t, reducedMotion.matches);
    }, () => { status.textContent = 'Coins flipped.'; });
  }
  function raiseChart() {
    if (jobs.has('chart')) return;
    chartRaised = !chartRaised;
    const starts = bars.map((bar) => bar.scale.y);
    animate('chart', 850, (t) => applyChartHeight(bars, barOrigins, starts, chartRaised, t), () => { status.textContent = chartRaised ? 'Chart raised. Click again to lower it.' : 'Chart returned to its original height.'; });
  }
  // Same six ribbons, 40 ms frames, stagger, easing and sweep as the TUI's AeroMark.
  const colors = ['#5b6b9c', '#2f5ee6', '#7fb2ff', '#eef0f5', '#ef4a2f', '#b8352a'];
  function paintMark(mode, frameNumber) {
    context.fillStyle = '#171824'; context.fillRect(0, 0, 528, 408);
    const unit = 19, offsetX = 48, offsetY = 50;
    colors.forEach((color, row) => {
      const left = 1.4 * Math.abs(row - 2.5) ** 1.5;
      const right = left + 9 + left * .35;
      const edge = mode === 'intro' ? 22 * (1 - ease(Math.min(1, Math.max(0, frameNumber - row * 3) / 18))) : 0;
      for (let column = 0; column < 44; column++) {
        const x = column / 2;
        if (x + .5 < Math.max(left, edge) || x > right) continue;
        const sweep = frameNumber / 30 * 34 - 6;
        const distance = mode === 'intro' ? x - edge : Math.abs(x - row * .8 - sweep);
        const light = mode === 'intro' ? Math.max(0, .7 - distance * .2) : mode === 'sweep' ? Math.max(0, .55 * (1 - distance / 2.5)) : 0;
        context.fillStyle = new THREE.Color(color).lerp(new THREE.Color('white'), Math.min(.8, light)).getStyle();
        context.fillRect(offsetX + x * unit, offsetY + row * 3 * unit, unit / 2 + .1, unit * 2);
      }
    });
    texture.needsUpdate = true;
  }
  function playAero() {
    if (jobs.has('aero')) return;
    prompts.forEach((object) => object.visible = false);
    screen.visible = true;
    if (reducedMotion.matches) { paintMark('idle', 0); draw(); status.textContent = 'Aero mark displayed with reduced motion.'; return; }
    animate('aero', 3600, (t) => {
      const elapsed = t * 3600;
      paintMark(elapsed < 1440 ? 'intro' : elapsed < 2100 ? 'idle' : 'sweep', elapsed < 1440 ? elapsed / 40 : (elapsed - 2100) / 40);
    }, () => { paintMark('idle', 0); status.textContent = 'Aero animation played.'; });
  }
  function reset() {
    jobs.clear(); chartRaised = false;
    coins.forEach((coin, i) => { coin.quaternion.copy(coinOrigins[i].quaternion); coin.position.copy(coinOrigins[i].position); });
    bars.forEach((bar, i) => { bar.scale.copy(barOrigins[i].scale); bar.position.copy(barOrigins[i].position); });
    prompts.forEach((object) => object.visible = true); screen.visible = false;
    camera.position.copy(initialPosition); orbit.target.set(-.12, 1.44, 0); orbit.update(); draw();
    status.textContent = 'Scene reset.';
  }
  document.querySelector('[data-scene="coins"]').addEventListener('click', () => flip());
  document.querySelector('[data-scene="chart"]').addEventListener('click', raiseChart);
  document.querySelector('[data-scene="aero"]').addEventListener('click', playAero);
  document.querySelector('[data-scene="reset"]').addEventListener('click', reset);
  const raycaster = new THREE.Raycaster();
  let pressed = null;
  canvas.addEventListener('pointerdown', (event) => { pressed = { x: event.clientX, y: event.clientY }; });
  canvas.addEventListener('pointercancel', () => { pressed = null; });
  canvas.addEventListener('pointerup', (event) => {
    if (!pressed || Math.hypot(event.clientX - pressed.x, event.clientY - pressed.y) > 6) { pressed = null; return; }
    pressed = null;
    const rect = canvas.getBoundingClientRect();
    raycaster.setFromCamera(new THREE.Vector2((event.clientX - rect.left) / rect.width * 2 - 1, 1 - (event.clientY - rect.top) / rect.height * 2), camera);
    const hit = raycaster.intersectObjects([model, screen], true)[0];
    if (!hit) return;
    let object = hit.object;
    while (object) {
      if (coins.includes(object)) { flip([object]); return; }
      if (bars.includes(object)) { raiseChart(); return; }
      if (/Monitor|Recessed|Prompt|Aero_animation/.test(object.name)) { playAero(); return; }
      object = object.parent;
    }
  });
  canvas.addEventListener('keydown', (event) => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home'].includes(event.key)) return;
    event.preventDefault();
    if (event.key === 'Home') { reset(); return; }
    const spherical = new THREE.Spherical().setFromVector3(camera.position.clone().sub(orbit.target));
    spherical.theta += event.key === 'ArrowLeft' ? .15 : event.key === 'ArrowRight' ? -.15 : 0;
    spherical.phi = THREE.MathUtils.clamp(spherical.phi + (event.key === 'ArrowUp' ? -.1 : event.key === 'ArrowDown' ? .1 : 0), orbit.minPolarAngle, orbit.maxPolarAngle);
    camera.position.copy(new THREE.Vector3().setFromSpherical(spherical).add(orbit.target)); orbit.update(); draw();
  });
  orbit.addEventListener('change', draw);
  const resize = new ResizeObserver(() => { renderer.setSize(host.clientWidth, host.clientHeight, false); draw(); });
  resize.observe(host);
  new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; if (visible) wake(); }, { threshold: 0 }).observe(host);
  document.addEventListener('visibilitychange', wake);
  canvas.addEventListener('webglcontextlost', (event) => { event.preventDefault(); jobs.clear(); host.classList.remove('scene-ready'); controlsBar.hidden = true; status.textContent = '3D paused. Reload to restore it.'; });
  controlsBar.hidden = false; host.classList.add('scene-ready'); draw();
}
