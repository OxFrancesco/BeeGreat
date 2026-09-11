import { Box3, Matrix3, Matrix4, Vector3 } from 'three';
import { OBB } from 'three/addons/math/OBB.js';

const gap = .008;

function collider(object) {
  object.updateWorldMatrix(true, true);
  const inverse = object.matrixWorld.clone().invert();
  const bounds = new Box3();
  object.traverse((child) => {
    if (!child.isMesh) return;
    child.geometry.computeBoundingBox();
    bounds.union(child.geometry.boundingBox.clone().applyMatrix4(new Matrix4().multiplyMatrices(inverse, child.matrixWorld)));
  });
  const center = bounds.getCenter(new Vector3());
  const halfSize = bounds.getSize(new Vector3()).multiplyScalar(.5);
  const box = new OBB();
  const update = () => {
    object.updateWorldMatrix(true, false);
    box.set(new Vector3(), halfSize.clone(), new Matrix3()).applyMatrix4(object.matrixWorld);
    box.center.copy(center).applyMatrix4(object.matrixWorld);
    return box;
  };
  return { object, update, box: update() };
}

// The separating-axis test also gives the interval of forward movement that
// would overlap each box. Move just beyond those intervals, without a physics loop.
function blockedInterval(a, b) {
  const aAxes = [new Vector3(), new Vector3(), new Vector3()];
  const bAxes = [new Vector3(), new Vector3(), new Vector3()];
  a.rotation.extractBasis(...aAxes);
  b.rotation.extractBasis(...bAxes);
  const axes = [...aAxes, ...bAxes];
  for (const x of aAxes) for (const y of bAxes) axes.push(new Vector3().crossVectors(x, y));
  const delta = a.center.clone().sub(b.center);
  const aSize = a.halfSize.toArray(), bSize = b.halfSize.toArray();
  let enter = -Infinity, exit = Infinity;
  for (const axis of axes) {
    if (axis.lengthSq() < 1e-12) continue;
    axis.normalize();
    let radius = gap;
    for (let i = 0; i < 3; i++) radius += Math.abs(axis.dot(aAxes[i])) * aSize[i] + Math.abs(axis.dot(bAxes[i])) * bSize[i];
    const distance = delta.dot(axis), speed = axis.z;
    if (Math.abs(speed) < 1e-8) {
      if (Math.abs(distance) > radius) return null;
      continue;
    }
    const first = (-radius - distance) / speed, last = (radius - distance) / speed;
    enter = Math.max(enter, Math.min(first, last));
    exit = Math.min(exit, Math.max(first, last));
    if (enter > exit) return null;
  }
  return { enter, exit };
}

export function createCollisionGuard(coins, obstacles) {
  const moving = coins.map(collider), fixed = obstacles.map(collider);
  function resolve() {
    const obstacleBoxes = fixed.map((item) => item.update());
    moving.forEach((item) => item.update());
    for (const item of moving) {
      const others = [...obstacleBoxes, ...moving.filter((other) => other !== item).map((other) => other.box)];
      const intervals = others.map((box) => blockedInterval(item.box, box)).filter(Boolean).sort((a, b) => a.enter - b.enter);
      let forward = 0;
      for (const interval of intervals) {
        if (interval.enter > forward) break;
        if (interval.exit >= forward) forward = interval.exit + gap;
      }
      if (forward > 0) {
        const position = item.object.getWorldPosition(new Vector3());
        position.z += forward;
        item.object.position.copy(item.object.parent.worldToLocal(position));
        item.update();
      }
    }
  }
  function overlaps() {
    const obstacleBoxes = fixed.map((item) => item.update());
    moving.forEach((item) => item.update());
    return moving.some((item, index) => [...obstacleBoxes, ...moving.slice(index + 1).map((other) => other.box)].some((box) => item.box.intersectsOBB(box)));
  }
  return { resolve, overlaps };
}
