import { MathUtils, Quaternion, Vector3 } from 'three';
export const ease = (t) => 1 - (1 - t) ** 3;
const flipAxis = new Vector3(1, 0, 0);
export function applyCoinFlip(coins, origins, selected, t, reducedMotion) {
  coins.forEach((coin, i) => {
    if (!selected.includes(coin)) return;
    coin.quaternion.copy(origins[i].quaternion).multiply(new Quaternion().setFromAxisAngle(flipAxis, reducedMotion ? 0 : ease(t) * Math.PI * 2));
    coin.position.copy(origins[i].position);
    coin.position.y += reducedMotion ? 0 : Math.sin(t * Math.PI) * .65;
  });
}
export function applyChartHeight(bars, origins, starts, raised, t) {
  bars.forEach((bar, i) => {
    const original = origins[i];
    const target = original.scale.y * (raised ? 1.35 : 1);
    bar.scale.y = MathUtils.lerp(starts[i], target, ease(t));
    bar.position.y = original.position.y + original.height * (bar.scale.y / original.scale.y - 1) / 2;
  });
}
