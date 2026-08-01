import {
  Canvas,
  Group,
  Path,
  Rect,
  RoundedRect,
  Skia,
} from '@shopify/react-native-skia';
import createQr from 'qrcode-generator';
import { useEffect, useMemo } from 'react';
import {
  Easing,
  interpolate,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { Spacing } from '@/constants/theme';

const HONEY = '#FAB52A';
const INK = '#43230F';
const PAPER = '#FFF9EC';
// ISO/IEC 18004 recommends a four-module quiet zone around QR symbols.
const QUIET_MODULES = 4;

function buildQrPath(value: string, size: number) {
  const qr = createQr(0, 'M');
  qr.addData(value);
  qr.make();
  const count = qr.getModuleCount();
  const cell = size / (count + QUIET_MODULES * 2);
  const radius = cell * 0.32;
  const path = Skia.Path.Make();
  for (let row = 0; row < count; row++) {
    for (let column = 0; column < count; column++) {
      if (!qr.isDark(row, column)) continue;
      path.addRRect(
        Skia.RRectXY(
          Skia.XYWHRect(
            (column + QUIET_MODULES) * cell,
            (row + QUIET_MODULES) * cell,
            cell * 1.04,
            cell * 1.04,
          ),
          radius,
          radius,
        ),
      );
    }
  }
  return path;
}

/** BeeGreat's reusable QR renderer with a quiet honey scan-line reveal. */
export function HoneyQrCode({ value, size }: { value: string; size: number }) {
  const reducedMotion = useReducedMotion();
  const path = useMemo(() => buildQrPath(value, size), [size, value]);
  const progress = useSharedValue(reducedMotion ? 1 : 0);

  useEffect(() => {
    if (reducedMotion) {
      progress.value = 1;
      return;
    }
    progress.value = 0;
    progress.value = withDelay(
      140,
      withTiming(1, { duration: 640, easing: Easing.out(Easing.cubic) }),
    );
  }, [progress, reducedMotion, value]);

  const revealClip = useDerivedValue(() => ({
    x: 0,
    y: 0,
    width: size,
    height: size * progress.value,
  }));
  const scanY = useDerivedValue(() =>
    Math.min(size - 2, size * progress.value),
  );
  const scanOpacity = useDerivedValue(() =>
    interpolate(progress.value, [0, 0.05, 0.92, 1], [0, 0.9, 0.9, 0]),
  );

  return (
    <Canvas style={{ width: size, height: size }}>
      <RoundedRect
        x={0}
        y={0}
        width={size}
        height={size}
        r={Spacing.two}
        color={PAPER}
      />
      <Group clip={revealClip}>
        <Path path={path} color={INK} />
      </Group>
      <Rect
        x={0}
        y={scanY}
        width={size}
        height={2}
        color={HONEY}
        opacity={scanOpacity}
      />
    </Canvas>
  );
}
