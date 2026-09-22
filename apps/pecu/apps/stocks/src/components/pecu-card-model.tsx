import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { Button } from "./ui/button";

export default function PecuCardModel({ id, name, image }: { id: number; name: string; image: string }) {
  const host = useRef<HTMLDivElement>(null);
  const actions = useRef<{ reset(): void; flip(): void } | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const element = host.current!;
    let disposed = false;
    let model: THREE.Group | undefined;
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true }); }
    catch { setFailed(true); return; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.toneMapping = THREE.AgXToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const canvas = renderer.domElement;
    canvas.tabIndex = 0;
    canvas.setAttribute("role", "img");
    canvas.setAttribute("aria-label", `${name}, interactive 3D card. Drag or use arrow keys to turn. Pinch, scroll, or use plus and minus to zoom. Home resets the view.`);
    element.appendChild(canvas);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(28, 0.75, 0.1, 100);
    camera.position.set(2.9, 5.2, 23);
    const controls = new OrbitControls(camera, canvas);
    controls.enablePan = false;
    controls.minDistance = 11;
    controls.maxDistance = 32;
    controls.minPolarAngle = 0.15;
    controls.maxPolarAngle = Math.PI - 0.15;
    controls.rotateSpeed = 0.65;
    controls.update();
    controls.saveState();
    const pmrem = new THREE.PMREMGenerator(renderer);
    const room = new RoomEnvironment();
    const environment = pmrem.fromScene(room, 0.04);
    room.dispose();
    scene.environment = environment.texture;
    scene.environmentIntensity = 0.55;
    scene.add(new THREE.HemisphereLight(0xffffff, 0xc7b6a6, 1.25));
    const key = new THREE.DirectionalLight(0xfff4e6, 3.2);
    key.position.set(-7, 10, 12);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    Object.assign(key.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: 0.1, far: 40 });
    key.shadow.normalBias = 0.025;
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xffffff, 1.2);
    fill.position.set(8, 2, -6);
    scene.add(fill);
    const render = () => { if (!disposed) renderer.render(scene, camera); };
    controls.addEventListener("change", render);
    const resize = () => {
      const { width, height } = element.getBoundingClientRect();
      renderer.setSize(width, height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      render();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    const turn = (horizontal: number, vertical = 0, zoom = 1) => {
      const orbit = new THREE.Spherical().setFromVector3(camera.position.clone().sub(controls.target));
      orbit.theta += horizontal;
      orbit.phi = THREE.MathUtils.clamp(orbit.phi + vertical, 0.15, Math.PI - 0.15);
      orbit.radius = THREE.MathUtils.clamp(orbit.radius * zoom, 11, 32);
      camera.position.copy(controls.target).add(new THREE.Vector3().setFromSpherical(orbit));
      controls.update();
      render();
    };
    actions.current = { reset: () => controls.reset(), flip: () => turn(Math.PI) };
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") turn(-0.15);
      else if (event.key === "ArrowRight") turn(0.15);
      else if (event.key === "ArrowUp") turn(0, -0.15);
      else if (event.key === "ArrowDown") turn(0, 0.15);
      else if (["+", "="].includes(event.key)) turn(0, 0, 0.9);
      else if (event.key === "-") turn(0, 0, 1.1);
      else if (event.key === "Home") controls.reset();
      else return;
      event.preventDefault();
    };
    canvas.addEventListener("keydown", keyboard);
    const draco = new DRACOLoader().setDecoderPath("/assets/pecu-cards/draco/").setWorkerLimit(2);
    const loader = new GLTFLoader().setDRACOLoader(draco);
    const disposeModel = (object: THREE.Group) => object.traverse((node) => {
      if (!(node instanceof THREE.Mesh)) return;
      node.geometry.dispose();
      for (const material of Array.isArray(node.material) ? node.material : [node.material]) material.dispose();
    });
    loader.load(`/assets/pecu-cards/${String(id).padStart(2, "0")}.glb`, (gltf) => {
      if (disposed) { disposeModel(gltf.scene); return; }
      model = gltf.scene;
      model.position.sub(new THREE.Box3().setFromObject(model).getCenter(new THREE.Vector3()));
      model.traverse((node) => { if (node instanceof THREE.Mesh) { node.castShadow = true; node.receiveShadow = true; } });
      scene.add(model);
      resize();
      setReady(true);
    }, undefined, () => { if (!disposed) setFailed(true); });
    return () => {
      disposed = true;
      actions.current = null;
      observer.disconnect();
      controls.dispose();
      canvas.removeEventListener("keydown", keyboard);
      draco.dispose();
      if (model) disposeModel(model);
      environment.dispose();
      pmrem.dispose();
      key.shadow.map?.dispose();
      renderer.dispose();
      canvas.remove();
    };
  }, [id, name]);
  return <div className="pecu-card-interactive">
    <div className="pecu-card-model" ref={host} data-ready={ready}>
      {!ready && <img src={image} alt={name} width={540} height={720} />}
    </div>
    {ready ? <><div className="pecu-card-controls"><Button variant="ghost" size="sm" onClick={() => actions.current?.flip()}>Turn over</Button><Button variant="ghost" size="sm" onClick={() => actions.current?.reset()}>Reset view</Button></div><p className="pecu-card-hint">Drag to turn · Pinch or scroll to zoom</p></> : <p className="pecu-card-hint" role="status">{failed ? "3D view unavailable. Showing your card image." : "Loading 3D view…"}</p>}
  </div>;
}
