import { Canvas, Group, Path, Rect } from '@shopify/react-native-skia';
import { useMemo } from 'react';

import { makeRoundedPolygonPath } from '@/components/hex-avatar';

/** Honeycomb palette shared with the hex avatar and sign-in scene. */
const Comb = {
  wax: '#FFF3DC',
  honey: '#FAB52A',
  stroke: '#FAB52A',
} as const;

function makeHexPath(size: number, inset: number, cornerRadius: number) {
  const c = size / 2;
  const radius = c - inset;
  const points = Array.from({ length: 6 }, (_, i) => {
    const angle = (Math.PI / 180) * (60 * i - 90);
    return { x: c + radius * Math.cos(angle), y: c + radius * Math.sin(angle) };
  });
  return makeRoundedPolygonPath(points, cornerRadius);
}

/**
 * A single honeycomb cell that fills with honey from the bottom as
 * `progress` (0..1) grows. Goals are combs; work fills them.
 */
export function CombCell({ size, progress }: { size: number; progress: number }) {
  const strokeWidth = Math.max(1.5, size / 24);
  const path = useMemo(() => makeHexPath(size, strokeWidth / 2, size / 8), [size, strokeWidth]);
  const clamped = Math.min(1, Math.max(0, progress));
  const fillHeight = size * clamped;

  return (
    <Canvas style={{ width: size, height: size }}>
      <Path path={path} color={Comb.wax} />
      <Group clip={path}>
        <Rect x={0} y={size - fillHeight} width={size} height={fillHeight} color={Comb.honey} />
      </Group>
      <Path path={path} style="stroke" strokeWidth={strokeWidth} color={Comb.stroke} />
    </Canvas>
  );
}
