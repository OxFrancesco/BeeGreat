import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { honeyState } from './state';

declare const IS_BOTTLE: boolean;
declare const HIVE_GLB: string;
declare const HIVE_EMPTY: string;
declare global {
  interface Window {
    hive: { setState: (state: { balance: number }) => void; reset: () => void };
  }
}

const host = document.querySelector<HTMLElement>('#hive')!;
const fallback = document.querySelector<HTMLImageElement>('#fallback')!;
fallback.src = HIVE_EMPTY;
let root: THREE.Object3D | undefined;
let fill: THREE.Object3D | undefined;
let surface: THREE.Object3D | undefined;
let balance = 0;
let draw = () => {};
const startingYaw = -0.55;
let yaw = startingYaw;

function applyState() {
  const state = IS_BOTTLE ? { ratio: Math.max(0, Math.min(1, balance / 2000)), label: `${balance} of 2000 millilitres` } : honeyState(balance);
  host.setAttribute('aria-label', `${state.label}. Drag left or right to rotate. Arrow keys rotate. Home resets.`);
  fallback.alt = `${state.label}. 3D view unavailable.`;
  if (fill && surface) {
    fill.visible = surface.visible = state.ratio > 0;
    fill.scale.y = Math.max(0.0001, state.ratio);
    surface.position.y = Number(fill.userData.baseHeight) + Number(fill.userData.fillHeight) * state.ratio;
  }
  draw();
}

window.hive = {
  setState(state) {
    if (typeof state?.balance !== 'number') return;
    balance = state.balance;
    applyState();
  },
  reset() {
    yaw = startingYaw;
    if (root) root.rotation.y = yaw;
    draw();
  },
};
window.addEventListener('message', (event) => {
  if (event.source === window.parent && event.data?.type === 'hive-state') window.hive.setState(event.data);
});
applyState();

async function start() {
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setClearColor(0, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  host.append(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-2.6, 2.6, 2.6, -2.6, 0.1, 50);
  camera.position.set(0, 5.4, 9);
  camera.lookAt(0, 1.65, 0);
  scene.add(new THREE.HemisphereLight(0xfff1db, 0x4c3027, 2.5));
  const key = new THREE.DirectionalLight(0xfff2d9, 3);
  key.position.set(-3, 7, 5);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xffb85c, 1);
  rim.position.set(4, 4, -3);
  scene.add(rim);
  let pendingFrame = 0;
  draw = () => {
    const width = Math.max(1, window.innerWidth);
    const height = Math.max(1, window.innerHeight);
    host.style.width = `${width}px`;
    host.style.height = `${height}px`;
    camera.left = -(IS_BOTTLE ? 2.1 : 2.6) * width / height;
    camera.right = (IS_BOTTLE ? 2.1 : 2.6) * width / height;
    camera.top = IS_BOTTLE ? 2.1 : 2.6;
    camera.bottom = -camera.top;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
    renderer.render(scene, camera);
    if (pendingFrame || document.hidden) return;
    pendingFrame = requestAnimationFrame(() => {
      pendingFrame = 0;
      renderer.render(scene, camera);
    });
  };
  window.addEventListener('resize', draw);
  window.visualViewport?.addEventListener('resize', draw);
  const bytes = Uint8Array.from(atob(HIVE_GLB), (char) => char.charCodeAt(0));
  const gltf = await new GLTFLoader().parseAsync(bytes.buffer, '');
  root = gltf.scene;
  fill = root.getObjectByName(IS_BOTTLE ? 'Water_Fill' : 'Honey_Fill');
  surface = root.getObjectByName(IS_BOTTLE ? 'Water_Surface' : 'Honey_Surface');
  if (!fill || !surface) throw new Error('Hive honey meshes are missing');
  root.rotation.y = yaw;
  scene.add(root);
  fallback.hidden = true;
  host.dataset.ready = 'true';
  applyState();

  let pointer: { id: number; x: number; y: number; yaw: number; horizontal: boolean } | undefined;
  host.addEventListener('pointerdown', (event) => {
    if (!event.isPrimary || event.button !== 0) return;
    pointer = { id: event.pointerId, x: event.clientX, y: event.clientY, yaw, horizontal: false };
  });
  host.addEventListener('pointermove', (event) => {
    if (!pointer || pointer.id !== event.pointerId) return;
    const dx = event.clientX - pointer.x;
    const dy = event.clientY - pointer.y;
    if (!pointer.horizontal) {
      if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 8) { pointer = undefined; return; }
      if (Math.abs(dx) < 5) return;
      pointer.horizontal = true;
      host.setPointerCapture(event.pointerId);
    }
    yaw = pointer.yaw + dx / host.clientWidth * Math.PI * 2;
    root!.rotation.y = yaw;
    draw();
  });
  const endDrag = () => { pointer = undefined; };
  host.addEventListener('pointerup', endDrag);
  host.addEventListener('pointercancel', endDrag);
  host.addEventListener('lostpointercapture', (event) => {
    if (event.target === host) endDrag();
  });
  host.addEventListener('keydown', (event) => {
    if (event.key === 'Home') window.hive.reset();
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      yaw += event.key === 'ArrowLeft' ? -Math.PI / 12 : Math.PI / 12;
      root!.rotation.y = yaw;
      draw();
    } else return;
    event.preventDefault();
  });
  host.addEventListener('dblclick', window.hive.reset);
  document.addEventListener('visibilitychange', draw);
  renderer.domElement.addEventListener('webglcontextlost', (event) => {
    event.preventDefault();
    fallback.hidden = false;
    host.dataset.ready = 'false';
  });
  renderer.domElement.addEventListener('webglcontextrestored', () => {
    fallback.hidden = true;
    host.dataset.ready = 'true';
    draw();
  });
  window.addEventListener('pagehide', (event) => {
    if (event.persisted) return;
    cancelAnimationFrame(pendingFrame);
    window.removeEventListener('resize', draw);
    window.visualViewport?.removeEventListener('resize', draw);
    scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.geometry.dispose();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach((material) => material.dispose());
      }
    });
    renderer.dispose();
  });
}

start().catch((error: unknown) => {
  fallback.hidden = false;
  host.dataset.ready = 'false';
  console.error('Hive 3D:', error);
});
