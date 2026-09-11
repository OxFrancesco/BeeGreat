import { describe, expect, test } from 'bun:test';
import { Box3, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createCollisionGuard } from './scene-collisions.js';
import { applyCoinFlip, applyChartHeight } from './scene-motion.js';

const modelPath = process.env.AERO_SCENE_MODEL;
if (!modelPath) throw new Error('Set AERO_SCENE_MODEL to public/aero-scene.glb.');
async function loadScene() {
  const gltf = await new GLTFLoader().parseAsync(await Bun.file(modelPath).arrayBuffer(), '');
  const coins = [], bars = [], obstacles = [];
  gltf.scene.traverse((object) => {
    if (object.userData.action === 'coin') coins.push(object);
    if (object.name.startsWith('Chart_column')) bars.push(object);
    if (/^(Monitor_body|Rounded_display_plinth|Chart_column)/.test(object.name)) obstacles.push(object);
  });
  const guard = createCollisionGuard(coins, obstacles);
  guard.resolve();
  const origins = coins.map((coin) => ({ position: coin.position.clone(), quaternion: coin.quaternion.clone() }));
  const barOrigins = bars.map((bar) => ({ position: bar.position.clone(), scale: bar.scale.clone(), height: new Box3().setFromObject(bar).getSize(new Vector3()).y }));
  return { coins, bars, guard, origins, barOrigins };
}

describe('Blender animation clearance', () => {
  for (const selected of ['both', 'first', 'second']) {
    test(`${selected} coin flip stays clear while the chart changes height`, async () => {
      const { coins, bars, guard, origins, barOrigins } = await loadScene();
      const targets = selected === 'both' ? coins : [coins[selected === 'first' ? 0 : 1]];
      for (const raised of [true, false]) {
        const starts = bars.map((bar) => bar.scale.y);
        for (let frame = 0; frame <= 600; frame++) {
          const t = frame / 600;
          applyCoinFlip(coins, origins, targets, t, false);
          applyChartHeight(bars, barOrigins, starts, raised, t);
          guard.resolve();
          expect(guard.overlaps()).toBe(false);
          for (const coin of coins) {
            expect(Number.isFinite(coin.position.z)).toBe(true);
            expect(coin.position.z).toBeLessThan(3);
          }
        }
      }
    });
  }
  test('repeated flips, reduced motion and Reset stay stable', async () => {
    const { coins, guard, origins } = await loadScene();
    for (let run = 0; run < 10; run++) {
      for (let frame = 0; frame <= 120; frame++) {
        applyCoinFlip(coins, origins, coins, frame / 120, false);
        guard.resolve();
        expect(guard.overlaps()).toBe(false);
      }
      applyCoinFlip(coins, origins, coins, 1, true);
      guard.resolve();
      coins.forEach((coin, i) => {
        expect(coin.position.distanceTo(origins[i].position)).toBeLessThan(1e-6);
        expect(coin.quaternion.angleTo(origins[i].quaternion)).toBeLessThan(1e-6);
      });
    }
  });
});
